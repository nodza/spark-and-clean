import type { BookingStatus } from "@/types/booking";
import { toE164Digits } from "@/lib/phone";
import { NotificationAttempt } from "@/models/NotificationAttempt";

type SupportedStatus = "SCHEDULED" | "COLLECTED" | "READY" | "DELIVERED";

export const NOTIFIABLE_BOOKING_STATUSES: readonly SupportedStatus[] = [
  "SCHEDULED",
  "COLLECTED",
  "READY",
  "DELIVERED",
];

type BookingStatusInput = {
  id: string;
  customer: { phone?: string | null };
};

type SendResult = {
  result: "sent" | "skipped" | "failed";
  providerMessageId?: string;
};

const STATUS_TEMPLATES: Record<SupportedStatus, string> = {
  SCHEDULED: "booking_scheduled",
  COLLECTED: "booking_collected",
  READY: "booking_ready",
  DELIVERED: "booking_delivered",
};

const DEFAULT_META_GRAPH_VERSION = "v23.0";
const DEFAULT_TEMPLATE_LANGUAGE = "en";

export async function sendBookingStatus(
  booking: BookingStatusInput,
  status: BookingStatus
): Promise<SendResult> {
  const bookingId = booking.id.trim();
  const phone = booking.customer.phone?.trim() ?? "";

  const alreadySent = await NotificationAttempt.findOne({
    bookingId,
    status,
    result: "sent",
  }).lean();
  if (alreadySent) {
    return {
      result: "sent",
      ...(alreadySent.providerMessageId
        ? { providerMessageId: alreadySent.providerMessageId }
        : {}),
    };
  }

  const accessToken = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const graphVersion =
    process.env.WHATSAPP_API_VERSION?.trim() || DEFAULT_META_GRAPH_VERSION;
  const templateLanguage =
    process.env.WHATSAPP_STATUS_TEMPLATE_LANGUAGE?.trim() ||
    DEFAULT_TEMPLATE_LANGUAGE;
  const template = STATUS_TEMPLATES[status as SupportedStatus];
  const recipient = phone ? toE164Digits(phone) : "";

  if (!accessToken || !phoneNumberId || !recipient || !template) {
    await recordAttempt({ bookingId, status, phone, result: "skipped" });
    return { result: "skipped" };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "template",
          template: {
            name: template,
            language: { code: templateLanguage },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: bookingId }],
              },
            ],
          },
        }),
      }
    );
    const payload = (await response.json()) as {
      messages?: Array<{ id?: string }>;
    };
    const providerMessageId = payload.messages?.[0]?.id;

    if (!response.ok || !providerMessageId) {
      await recordAttempt({ bookingId, status, phone, result: "failed" });
      return { result: "failed" };
    }

    await recordAttempt({
      bookingId,
      status,
      phone,
      result: "sent",
      providerMessageId,
    });
    return { result: "sent", providerMessageId };
  } catch {
    await recordAttempt({ bookingId, status, phone, result: "failed" });
    return { result: "failed" };
  }
}

async function recordAttempt(attempt: {
  bookingId: string;
  status: BookingStatus;
  phone: string;
  result: "sent" | "skipped" | "failed";
  providerMessageId?: string;
}) {
  await NotificationAttempt.create({
    ...attempt,
    providerMessageId: attempt.providerMessageId ?? null,
  });
}