import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { NotificationAttempt } from "@/models/NotificationAttempt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WhatsAppStatus = "sent" | "delivered" | "failed";

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: Array<{ id?: unknown; status?: unknown }>;
      };
    }>;
  }>;
};

function signatureIsValid(payload: string, signature: string, secret: string) {
  const match = /^sha256=([a-f\d]{64})$/i.exec(signature);
  if (!match) return false;

  const received = Buffer.from(match[1], "hex");
  const expected = createHmac("sha256", secret).update(payload).digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function normalizeStatus(value: unknown): WhatsAppStatus | null {
  if (value === "sent" || value === "delivered" || value === "failed") {
    return value;
  }
  if (value === "read") return "delivered";
  return null;
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode !== "subscribe" || !verifyToken || token !== verifyToken || challenge === null) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 500 });
  }

  const payload = await request.text();
  const signature = request.headers.get("x-hub-signature-256") || "";
  if (!signatureIsValid(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: WhatsAppWebhookPayload;
  try {
    body = JSON.parse(payload) as WhatsAppWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const receipts = (body.entry ?? []).flatMap((entry) =>
    (entry.changes ?? []).flatMap((change) => change.value?.statuses ?? [])
  );
  const updates = receipts.flatMap((receipt) => {
    const messageId = typeof receipt.id === "string" ? receipt.id.trim() : "";
    const result = normalizeStatus(receipt.status);
    return messageId && result ? [{ messageId, result }] : [];
  });

  if (updates.length > 0) {
    await connectDB();
    for (const update of updates) {
      await NotificationAttempt.updateOne(
        { providerMessageId: update.messageId },
        { $set: { result: update.result } }
      );
    }
  }

  return NextResponse.json({ received: true });
}