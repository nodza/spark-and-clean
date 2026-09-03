import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import {
  isClientRole,
  normalizeUserRole,
  type AdminTier,
} from "@/types/user";

function sessionFromUser(user: {
  _id: { toString(): string };
  email: unknown;
  name?: unknown;
  phone?: unknown;
  role?: unknown;
  adminTier?: unknown;
  driverProfileId?: unknown;
}) {
  const role = normalizeUserRole(user.role);
  return {
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
}

/**
 * Credentials login only (email + password).
 * Guests are not given a session — they track via /booking/[id].
 * Clients, admins, and technicians all require a password.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const roleFilterRaw = body.role as string | undefined;
    const roleFilter = roleFilterRaw
      ? normalizeUserRole(roleFilterRaw)
      : undefined;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    await connectDB();

    const query: Record<string, unknown> = {
      email,
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
      disabledAt: null,
    };
    if (roleFilter) {
      if (roleFilter === "client") {
        query.role = { $in: ["client", "CUSTOMER"] };
      } else if (roleFilter === "technician") {
        query.role = { $in: ["technician", "DRIVER"] };
      } else if (roleFilter === "admin") {
        query.role = { $in: ["admin", "ADMIN"] };
      }
    }

    const user = await User.findOne(query).select("+passwordHash").lean();

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (
      typeof user.passwordHash !== "string" ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const role = normalizeUserRole(user.role);
    if (roleFilter && !isClientRole(roleFilter) && role !== roleFilter) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date() } }
    );

    const sessionUser = sessionFromUser(user);
    const token = await createSessionToken(sessionUser);
    await setSessionCookie(token);
    return NextResponse.json({ user: sessionUser });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    console.error("[api/auth/login]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
