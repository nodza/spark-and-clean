import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { attachUnclaimedBookingsByEmail } from "@/lib/attachGuestBookings";
import { createSessionToken, setSessionCookie } from "@/lib/session";

/**
 * Create a password-based **client** account (never admin/technician)
 * and attach every unclaimed booking that shares this email.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    await connectDB();

    const existing = await User.findOne({ email }).select("+passwordHash").lean();
    if (existing) {
      return NextResponse.json(
        {
          error: "An account with this email already exists. Log in to attach this booking.",
          code: "ACCOUNT_EXISTS",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
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

    const userId = String(user._id);
    const attached = await attachUnclaimedBookingsByEmail(userId, email);

    const sessionUser = {
      id: userId,
      email: String(user.email),
      name: user.name ? String(user.name) : undefined,
      phone: user.phone ? String(user.phone) : undefined,
      role: "client" as const,
      adminTier: null,
    };

    const token = await createSessionToken(sessionUser);
    await setSessionCookie(token);

    return NextResponse.json(
      { user: sessionUser, attachedBookingIds: attached.ids },
      { status: 201 }
    );
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return NextResponse.json(
        {
          error: "An account with this email already exists. Log in to attach this booking.",
          code: "ACCOUNT_EXISTS",
        },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Register failed";
    console.error("[api/auth/register]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
