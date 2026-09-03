import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { PasswordResetToken } from "@/models/PasswordResetToken";
import {
  FORGOT_PASSWORD_PUBLIC_MESSAGE,
  RESET_TOKEN_TTL_MS,
  generateResetToken,
  hashResetToken,
} from "@/lib/passwordReset";
import { getAppBaseUrl, sendPasswordResetEmail } from "@/lib/mail";

const PUBLIC_BODY = { message: FORGOT_PASSWORD_PUBLIC_MESSAGE };

/**
 * Always returns the same public message (known vs unknown / disabled emails).
 * Timing: short fixed pad so responses feel similar.
 */
export async function POST(request: Request) {
  const started = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    if (email && email.includes("@")) {
      await connectDB();

      const user = await User.findOne({
        email,
        $and: [
          {
            $or: [{ disabledAt: null }, { disabledAt: { $exists: false } }],
          },
          {
            $or: [{ isActive: true }, { isActive: { $exists: false } }],
          },
        ],
      }).lean();

      if (user) {
        const rawToken = generateResetToken();
        const tokenHash = hashResetToken(rawToken);
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
        const userId = new Types.ObjectId(String(user._id));

        await PasswordResetToken.updateMany(
          { userId, usedAt: null },
          { $set: { usedAt: new Date() } }
        );

        await PasswordResetToken.create({
          userId,
          tokenHash,
          expiresAt,
          usedAt: null,
        });

        const resetUrl = `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
        const expiresInMinutes = Math.round(RESET_TOKEN_TTL_MS / 60000);

        try {
          await sendPasswordResetEmail({
            to: email,
            resetUrl,
            expiresInMinutes,
          });
        } catch (err) {
          console.error("[api/auth/forgot-password] email failed", err);
        }
      } else if (process.env.NODE_ENV !== "production") {
        // Dev-only: explain empty terminal — public API response stays identical
        console.log(
          `[email] forgot-password: no active user for "${email}" — no reset URL to log (same public UI by design)`
        );
      }
    }

    await padTiming(started);
    return NextResponse.json(PUBLIC_BODY);
  } catch (err) {
    console.error("[api/auth/forgot-password]", err);
    await padTiming(started);
    return NextResponse.json(PUBLIC_BODY);
  }
}

async function padTiming(started: number, minMs = 400) {
  const elapsed = Date.now() - started;
  if (elapsed < minMs) {
    await new Promise((r) => setTimeout(r, minMs - elapsed));
  }
}
