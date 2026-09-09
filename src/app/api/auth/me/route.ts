import { NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/session";
import { isFullAccount } from "@/types/user";

export async function GET() {
  const session = await getSession();
  if (!session || !isFullAccount(session)) {
    if (session && !isFullAccount(session)) {
      await clearSessionCookie();
    }
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user: session });
}
