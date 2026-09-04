import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/session";
import { normalizeUserRole } from "@/types/user";

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rateLimit = checkRateLimit(`auth-register:${ip}`, 5, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const body = await request.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const bookingId = String(body.bookingId || "").trim();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 }
      );
    }
    if (password.toLowerCase() === email) {
      return NextResponse.json(
        { error: "Password must not be the same as your email." },
        { status: 400 }
      );
    }

    await connectDB();

    const existing = await User.findOne({ email }).select("+passwordHash");
    if (existing && normalizeUserRole(existing.role) !== "client") {
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in." },
        { status: 409 }
      );
    }
    if (existing?.passwordHash) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let user;
    if (existing) {
      await User.updateOne(
        { _id: existing._id },
        {
          $set: {
            passwordHash,
            name: name || existing.name,
            phone: phone || existing.phone,
            role: "client",
            adminTier: null,
            lastLoginAt: new Date(),
          },
        }
      );
      user = await User.findById(existing._id);
    } else {
      user = await User.create({
        email,
        passwordHash,
        name: name || undefined,
        phone: phone || undefined,
        role: "client",
        adminTier: null,
        emailVerifiedAt: null,
        emailVerified: false,
        disabledAt: null,
        isActive: true,
        lastLoginAt: new Date(),
      });
    }

    if (!user) {
      return NextResponse.json({ error: "Could not create account" }, { status: 500 });
    }

    if (bookingId) {
      await Booking.updateOne(
        { id: bookingId, "customer.email": email },
        { $set: { userId: user._id } }
      );
    }

    const sessionUser = {
      id: String(user._id),
      email: String(user.email),
      name: user.name ? String(user.name) : undefined,
      phone: user.phone ? String(user.phone) : undefined,
      role: "client" as const,
      adminTier: null,
    };

    const token = await createSessionToken(sessionUser);
    await setSessionCookie(token);

    return NextResponse.json({ user: sessionUser }, { status: 201 });
  } catch (err) {
    // Duplicate email unique index
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Register failed";
    console.error("[api/auth/register]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
