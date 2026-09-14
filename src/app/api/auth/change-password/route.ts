import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import {
  createSessionToken,
  getSession,
  setSessionCookie,
} from "@/lib/session";
import { accountIsDisabled } from "@/lib/adminAuth";
import { validatePasswordStrength } from "@/lib/passwordRules";
import { normalizeUserRole, type AdminTier } from "@/types/user";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.guest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(session.id).select("+passwordHash");
    if (!user || accountIsDisabled(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      typeof user.passwordHash !== "string" ||
      !(await bcrypt.compare(currentPassword, user.passwordHash))
    ) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await user.save();

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
      mustChangePassword: false,
    };

    const token = await createSessionToken(sessionUser);
    await setSessionCookie(token);
    return NextResponse.json({ user: sessionUser });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Password change failed";
    console.error("[api/auth/change-password]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
