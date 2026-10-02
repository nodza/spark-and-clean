import { POST as stripeWebhookPost } from "../../webhooks/stripe/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same signed-event handler as POST /api/webhooks/stripe. */
export function POST(request: Request) {
  return stripeWebhookPost(request);
}
