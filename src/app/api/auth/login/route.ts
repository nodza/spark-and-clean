import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/session";
import type { UserRole } from "@/types/user";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const roleFilter = body.role as UserRole | undefined;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const query: Record<string, unknown> = { email, isActive: true };
    if (roleFilter) query.role = roleFilter;

    const user = await User.findOne(query).select("+passwordHash").lean();
    if (!user || typeof user.passwordHash !== "string") {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    const sessionUser = {
      id: String(user._id),
      email: String(user.email),
      name: user.name ? String(user.name) : undefined,
      role: (user.role as UserRole) || "CUSTOMER",
      driverProfileId: user.driverProfileId
        ? String(user.driverProfileId)
        : undefined,
    };

    const token = await createSessionToken(sessionUser);
    await setSessionCookie(token);

    return NextResponse.json({ user: sessionUser });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    console.error("[api/auth/login]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
