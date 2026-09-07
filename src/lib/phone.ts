/** Convert a ZA display number (e.g. `064 289 2384`) to E.164 digits, no `+`. */
export function toE164Digits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("27")) return digits;
  if (digits.startsWith("0")) return `27${digits.slice(1)}`;
  return digits;
}

export function telHref(phone: string): string {
  return `tel:+${toE164Digits(phone)}`;
}

/**
 * Click-to-chat URL. Prefill is support-oriented — WhatsApp is not a booking
 * channel (see docs/wiki/booking-channels.md).
 */
export function whatsappHref(phone: string, text?: string): string {
  const url = new URL(`https://wa.me/${toE164Digits(phone)}`);
  if (text) url.searchParams.set("text", text);
  return url.toString();
}

export const SUPPORT_WHATSAPP_PREFILL =
  "Hi Spark & Clean, I have a question. I will book collections through the online form.";
