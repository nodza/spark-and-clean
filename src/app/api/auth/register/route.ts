import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { attachUnclaimedBookingsByEmail } from "@/lib/attachGuestBookings";
import { checkRateLimit } from "@/lib/rateLimit";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { normalizeUserRole } from "@/types/user";
import {
  validateCustomerName,
  validateEmail,
  validateSaPhone,
} from "@/lib/bookingValidation";
import {
  validatePasswordConfirm,
  validatePasswordNotEmail,
  validatePasswordStrength,
} from "@/lib/passwordRules";
import { toPublicApiError } from "@/lib/publicApiError";

/**
 * Create a password-based **client** account (never admin/technician)
 * and attach every unclaimed booking that shares this email.
 */
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
    const requestedRoleRaw = String(body.role ?? "")
      .trim()
      .toLowerCase();
    if (
      requestedRoleRaw &&
      requestedRoleRaw !== "client" &&
      requestedRoleRaw !== "customer"
    ) {
      return NextResponse.json(
        { error: "Public registration is for customer accounts only" },
        { status: 403 }
      );
    }
    // Ignore any client-supplied role / adminTier — always force client (SCW-29 / SCW-30 / SCW-31).
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");
    const name = String(body.name || "").trim().replace(/\s+/g, " ");
    const phone = String(body.phone || "").trim();
    const bookingId = String(body.bookingId || "").trim();
    const isStandaloneSignup = !bookingId;

    const emailErr = validateEmail(email);
    if (emailErr) {
      return NextResponse.json({ error: emailErr }, { status: 400 });
    }

    if (isStandaloneSignup) {
      const nameErr = validateCustomerName(name);
      if (nameErr) {
        return NextResponse.json({ error: nameErr }, { status: 400 });
      }
      const phoneErr = validateSaPhone(phone);
      if (phoneErr) {
        return NextResponse.json({ error: phoneErr }, { status: 400 });
      }
    }

    const passwordErr =
      validatePasswordStrength(password) ||
      validatePasswordNotEmail(password, email);
    if (passwordErr) {
      return NextResponse.json({ error: passwordErr }, { status: 400 });
    }

    const confirmErr = validatePasswordConfirm(password, confirmPassword);
    if (confirmErr) {
      return NextResponse.json({ error: confirmErr }, { status: 400 });
    }

    await connectDB();

    const existing = await User.findOne({ email }).select("+passwordHash");
    if (existing && normalizeUserRole(existing.role) !== "client") {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Log in to attach this booking.",
          code: "ACCOUNT_EXISTS",
        },
        { status: 409 }
      );
    }
    if (existing?.passwordHash) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Log in to attach this booking.",
          code: "ACCOUNT_EXISTS",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let user;
    if (existing) {
      // Legacy passwordless client → convert into a full account
      await User.updateOne(
        { _id: existing._id },
        {
          $set: {
            passwordHash,
            name: name || existing.name,
            phone: phone || existing.phone,
            role: "client",
            adminTier: null,
            mustChangePassword: false,
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
        mustChangePassword: false,
        lastLoginAt: new Date(),
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: "Could not create account." },
        { status: 500 }
      );
    }

    if (bookingId) {
      await Booking.updateOne(
        { id: bookingId, "customer.email": email },
        { $set: { userId: user._id } }
      );
    }

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
          error:
            "An account with this email already exists. Log in to attach this booking.",
          code: "ACCOUNT_EXISTS",
        },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Register failed";
    console.error("[api/auth/register]", message);
    return NextResponse.json(
      {
        error: toPublicApiError(
          err,
          "Could not create your account. Please try again."
        ),
      },
      { status: 500 }
    );
  }
}
