import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();

    if (!email || password.length < 6) {
      return NextResponse.json(
        { error: "Valid email and password (min 6 chars) required" },
        { status: 400 }
      );
    }

    await connectDB();

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      passwordHash,
      name: name || undefined,
      phone: phone || undefined,
      role: "CUSTOMER",
      emailVerified: false,
      isActive: true,
      lastLoginAt: new Date(),
    });

    const sessionUser = {
      id: String(user._id),
      email: String(user.email),
      name: user.name ? String(user.name) : undefined,
      phone: user.phone ? String(user.phone) : undefined,
      role: "CUSTOMER" as const,
    };

    const token = await createSessionToken(sessionUser);
    await setSessionCookie(token);

    return NextResponse.json({ user: sessionUser }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Register failed";
    console.error("[api/auth/register]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
