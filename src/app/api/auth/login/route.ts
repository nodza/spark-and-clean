import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/session";
import type { UserRole } from "@/types/user";

function sessionFromUser(user: {
  _id: { toString(): string };
  email: unknown;
  name?: unknown;
  phone?: unknown;
  role?: unknown;
  driverProfileId?: unknown;
}) {
  return {
    id: String(user._id),
    email: String(user.email),
    name: user.name ? String(user.name) : undefined,
    phone: user.phone ? String(user.phone) : undefined,
    role: (user.role as UserRole) || "CUSTOMER",
    driverProfileId: user.driverProfileId
      ? String(user.driverProfileId)
      : undefined,
  };
}

/**
 * Customers: email-only (password optional if provided).
 * Admin / driver: password required.
 * Unknown email: guest CUSTOMER session for portal tracking.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const roleFilter = body.role as UserRole | undefined;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    await connectDB();

    const query: Record<string, unknown> = { email, isActive: true };
    if (roleFilter) query.role = roleFilter;

    const user = await User.findOne(query).select("+passwordHash").lean();

    // No Mongo user — open guest portal session (customer email gate)
    if (!user) {
      if (roleFilter && roleFilter !== "CUSTOMER") {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      const guest = {
        id: `guest:${email}`,
        email,
        role: "CUSTOMER" as const,
        guest: true,
      };
      const token = await createSessionToken(guest);
      await setSessionCookie(token, 60 * 60 * 24 * 2);
      return NextResponse.json({ user: guest });
    }

    const role = (user.role as UserRole) || "CUSTOMER";

    if (role === "CUSTOMER") {
      if (password) {
        if (
          typeof user.passwordHash !== "string" ||
          !(await bcrypt.compare(password, user.passwordHash))
        ) {
          return NextResponse.json(
            { error: "Invalid email or password" },
            { status: 401 }
          );
        }
      }

      await User.updateOne(
        { _id: user._id },
        { $set: { lastLoginAt: new Date() } }
      );

      const sessionUser = sessionFromUser(user);
      const token = await createSessionToken(sessionUser);
      await setSessionCookie(token);
      return NextResponse.json({ user: sessionUser });
    }

    // ADMIN / DRIVER — password required
    if (!password) {
      return NextResponse.json(
        {
          error: "Password required for staff accounts",
          requiresPassword: true,
          role,
        },
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
