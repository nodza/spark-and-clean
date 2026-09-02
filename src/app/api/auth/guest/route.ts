import { NextResponse } from "next/server";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/session";

/**
 * Continue as guest after booking — short-lived client session keyed by checkout email.
 * Does not create a User document; used to view /booking/[id] privately.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const bookingId = String(body.bookingId || "").trim();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const sessionUser = {
      id: `guest:${email}`,
      email,
      name: name || undefined,
      phone: phone || undefined,
      role: "client" as const,
      adminTier: null,
      guest: true,
    };

    const token = await createSessionToken(sessionUser);
    // 2 days — matches guest JWT expiry
    await setSessionCookie(token, 60 * 60 * 24 * 2);

    return NextResponse.json({
      user: sessionUser,
      bookingId: bookingId || undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Guest session failed";
    console.error("[api/auth/guest]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
