import { NextResponse } from "next/server";
import { runScheduledCustomerEmails } from "@/lib/email/scheduledCustomerEmails";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function deployedEnv(): boolean {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || "").toLowerCase();
  return env === "production" || env === "staging" || env === "prod";
}

/**
 * Morning customer mail: collection reminder (day before) and out-for-delivery
 * (delivery morning). Schedule this at 08:00 Africa/Johannesburg.
 * Vercel cron is 06:00 UTC (`0 6 * * *`), which is 08:00 SAST.
 * Set CRON_SECRET and send `Authorization: Bearer <CRON_SECRET>`.
 * Local/dev without that secret may call the route directly.
 */
export function customerEmailCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return !deployedEnv();
  const header = request.headers.get("authorization")?.trim();
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!customerEmailCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runScheduledCustomerEmails();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[email] customer cron", err);
    return NextResponse.json({ error: "Customer emails failed" }, { status: 500 });
  }
}

export const POST = GET;
