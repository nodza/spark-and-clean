import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { PasswordResetToken } from "@/models/PasswordResetToken";
import { AuthSession } from "@/models/AuthSession";
import {
  hashResetToken,
  validatePasswordStrength,
} from "@/lib/passwordReset";
import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
} from "@/lib/session";
import {
  normalizeUserRole,
  type AdminTier,
} from "@/types/user";

const INVALID_TOKEN_MESSAGE =
  "This reset link is invalid or has expired. Request a new link.";

/**
 * Set a new password with a one-time reset token.
 * On success: update hash, mark token used, invalidate prior sessions, issue new session.
 * Role is never changed.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawToken = String(body.token || "").trim();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!rawToken) {
      return NextResponse.json(
        { error: INVALID_TOKEN_MESSAGE },
        { status: 400 }
      );
    }

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 }
      );
    }

    await connectDB();

    const tokenHash = hashResetToken(rawToken);
    const tokenDoc = await PasswordResetToken.findOne({ tokenHash }).select(
      "+tokenHash"
    );

    if (!tokenDoc) {
      return NextResponse.json(
        { error: INVALID_TOKEN_MESSAGE },
        { status: 400 }
      );
    }

    if (tokenDoc.usedAt) {
      return NextResponse.json(
        { error: INVALID_TOKEN_MESSAGE },
        { status: 400 }
      );
    }

    if (new Date(tokenDoc.expiresAt).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: INVALID_TOKEN_MESSAGE },
        { status: 400 }
      );
    }

    const user = await User.findById(tokenDoc.userId).select(
      "+passwordHash email name phone role adminTier driverProfileId disabledAt"
    );

    if (!user || user.disabledAt) {
      return NextResponse.json(
        { error: INVALID_TOKEN_MESSAGE },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // Subtract 1s so the new JWT (second-precision iat) is not treated as pre-reset
    const invalidatedAt = new Date(Date.now() - 1000);
    const now = new Date();
    const userId = new Types.ObjectId(String(user._id));

    // updateOne avoids document.save() middleware pitfalls under Next.js HMR
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          passwordHash,
          sessionsInvalidatedAt: invalidatedAt,
        },
      }
    );

    tokenDoc.usedAt = now;
    await tokenDoc.save();

    // Invalidate any ledger sessions; JWT cookies are rejected via sessionsInvalidatedAt
    await AuthSession.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: now } }
    );

    // Mark any other outstanding reset tokens used
    await PasswordResetToken.updateMany(
      { userId, usedAt: null, _id: { $ne: tokenDoc._id } },
      { $set: { usedAt: now } }
    );

    const role = normalizeUserRole(user.role);
    const sessionUser = {
      id: String(user._id),
      email: String(user.email),
      name: user.name ? String(user.name) : undefined,
      phone: user.phone ? String(user.phone) : undefined,
      role,
      adminTier:
        role === "admin" &&
        (user.adminTier === "full" || user.adminTier === "marketing-only")
          ? (user.adminTier as AdminTier)
          : null,
      driverProfileId: user.driverProfileId
        ? String(user.driverProfileId)
        : undefined,
    };

    await clearSessionCookie();
    const jwt = await createSessionToken(sessionUser);
    await setSessionCookie(jwt);

    const loginPath =
      role === "technician" ? "/tech" : role === "admin" ? "/login" : "/login";
    const homePath =
      role === "technician"
        ? "/tech/dashboard"
        : role === "admin"
          ? "/admin"
          : "/dashboard";

    return NextResponse.json({
      user: sessionUser,
      loginPath,
      homePath,
      message: "Password updated.",
    });
  } catch (err) {
    console.error("[api/auth/reset-password]", err);
    return NextResponse.json(
      {
        error:
          "We could not reset your password. Request a new link and try again.",
      },
      { status: 400 }
    );
  }
}

/** Optional probe: is this token still usable? Never 500. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawToken = String(url.searchParams.get("token") || "").trim();
    if (!rawToken) {
      return NextResponse.json({ valid: false, error: INVALID_TOKEN_MESSAGE });
    }

    await connectDB();
    const tokenHash = hashResetToken(rawToken);
    const tokenDoc = await PasswordResetToken.findOne({ tokenHash });

    if (
      !tokenDoc ||
      tokenDoc.usedAt ||
      new Date(tokenDoc.expiresAt).getTime() <= Date.now()
    ) {
      return NextResponse.json({ valid: false, error: INVALID_TOKEN_MESSAGE });
    }

    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error("[api/auth/reset-password GET]", err);
    return NextResponse.json({ valid: false, error: INVALID_TOKEN_MESSAGE });
  }
}
