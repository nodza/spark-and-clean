import { branchContacts } from "@/data/branchContacts";
import { bookingPageUrl } from "@/lib/email/appUrl";
import { formatBookingCollection } from "@/lib/localCalendarDate";
import { amountDueCentsForBooking } from "@/lib/payments/deposit";
import { netSucceededCents } from "@/lib/payments/ledger";
import { LOYALTY_PUNCHES_PER_REWARD, LOYALTY_REWARD_VALUE_CENTS } from "@/lib/promotion/loyaltyReward";
import { formatEmailRand } from "@/lib/email/money";
import { formatQuoteRange } from "@/lib/priceFormat";
import { bookingAddOnLabels, OPS_ADD_ON_COPY } from "@/lib/techUi";
import type { Booking } from "@/types/booking";
import type { EmailLedgerRow, EmailTimelineStep, TransactionalEmail } from "@/lib/email/layout";
import { getAppBaseUrl } from "@/lib/email/appUrl";

export type DriverMailContact = {
  name: string;
  phone?: string;
};

export type MailPayment = {
  kind?: unknown;
  provider?: unknown;
  amountCents?: unknown;
  status?: unknown;
  createdAt?: unknown;
};

const GAUTENG =
  branchContacts.find((branch) => /gauteng/i.test(branch.name))?.phones[0]?.number ??
  "064 289 2384";
const CAPE_TOWN =
  branchContacts.find((branch) => /cape/i.test(branch.name))?.phones[0]?.number ??
  "064 043 6902";

export function emailFirstName(name: string | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? "";
}

export function branchPhoneForCity(city: string | undefined): string {
  return /cape/i.test(city ?? "") ? CAPE_TOWN : GAUTENG;
}

export function slotWindow(slot: string | undefined): {
  compact: string;
  spaced: string;
  dayPart: "morning" | "afternoon";
} {
  if (slot === "AFTERNOON") {
    return {
      compact: "12:00–16:00",
      spaced: "12:00 – 16:00",
      dayPart: "afternoon",
    };
  }
  return {
    compact: "08:00–12:00",
    spaced: "08:00 – 12:00",
    dayPart: "morning",
  };
}

function collectionAddress(booking: Pick<Booking, "addressLine1" | "suburb">): string {
  return [booking.addressLine1, booking.suburb].filter(Boolean).join(", ");
}

function itemLabel(booking: Pick<Booking, "rug">): string {
  const type = booking.rug?.type?.trim() || "Rug";
  return `1 rug · ${type}`;
}

function dayLabel(value: string | undefined, pattern: string): string {
  if (!value) return "";
  return formatBookingCollection(value, pattern, "");
}

function estimateValue(booking: Booking): string {
  const due = amountDueCentsForBooking(booking);
  if (
    booking.promotion?.amountDueCents != null ||
    booking.measuredQuote ||
    booking.estimatedPriceMin === booking.estimatedPriceMax
  ) {
    return formatEmailRand(due);
  }
  return formatQuoteRange(booking.estimatedPriceMin, booking.estimatedPriceMax);
}

function paymentValue(status: string | undefined): EmailLedgerRow {
  if (status === "PAID") return { label: "Payment", value: "Paid", tone: "good" };
  if (status === "DEPOSIT") {
    return { label: "Payment", value: "Deposit paid", tone: "good" };
  }
  return { label: "Payment", value: "On delivery", tone: "good" };
}

function providerLabel(provider: string): string {
  const value = provider.trim().toLowerCase();
  if (value === "stripe") return "Stripe";
  if (value === "ozow") return "Ozow";
  if (value === "manual") return "Manual";
  return provider.trim() || "Payment";
}

function kindLabel(kind: string): string {
  if (kind === "DEPOSIT") return "Deposit";
  if (kind === "BALANCE") return "Balance";
  if (kind === "REFUND") return "Refund";
  return kind.trim() || "Payment";
}

function succeededPayments(payments: MailPayment[]) {
  return payments.filter((row) => String(row.status || "").toUpperCase() === "SUCCEEDED");
}

export function bookingConfirmedEmail(booking: Booking): TransactionalEmail {
  const name = emailFirstName(booking.customer.name);
  const slot = slotWindow(booking.collectionSlot);
  const when = dayLabel(booking.collectionDate, "EEE d MMM");
  const longWhen = dayLabel(booking.collectionDate, "EEEE d MMMM");
  return {
    subject: `Your collection is booked — ${longWhen || booking.collectionDate}`,
    preheader: `${booking.id} · ${itemLabel(booking)} · ${slot.compact} window`,
    eyebrow: "BOOKING CONFIRMED",
    heading: name ? `You're booked in, ${name}` : "You're booked in",
    intro: `We'll collect from ${collectionAddress(booking)}. You'll get an email the day before collection.`,
    hero: {
      label: "COLLECTION",
      value: when || booking.collectionDate,
      note: `${slot.spaced} window`,
    },
    ledger: [
      { label: "Booking reference", value: booking.id },
      { label: "Items", value: itemLabel(booking) },
      { label: "Estimate", value: estimateValue(booking) },
      paymentValue(booking.paymentStatus),
    ],
    cta: { label: "View my booking", href: bookingPageUrl(booking.id) },
    footnote:
      "Need to change the date? Reply to this email or call us before 16:00 the day before.",
  };
}

export function collectionReminderEmail(
  booking: Booking,
  driver: DriverMailContact | null
): TransactionalEmail {
  const slot = slotWindow(booking.collectionSlot);
  const technician = driver?.name?.trim() || "Our driver";
  const phone = driver?.phone?.trim() || branchPhoneForCity(booking.city);
  return {
    subject: `We collect tomorrow ${slot.dayPart} — ${booking.id}`,
    preheader: `Please have your rug rolled and ready by ${slot.spaced.slice(0, 5)}`,
    eyebrow: "COLLECTION TOMORROW",
    heading: `We arrive tomorrow between ${slot.spaced.replace(" – ", " and ")}`,
    intro: `${technician} will collect from ${collectionAddress(booking)}. Roll the rug loosely and leave it somewhere they can reach.`,
    ledger: [
      { label: "Technician", value: technician },
      { label: "Contact", value: phone },
      { label: "Items to collect", value: itemLabel(booking) },
    ],
    cta: { label: "Track my booking", href: bookingPageUrl(booking.id) },
    footnote: "If tomorrow no longer works, let us know today and we'll move it at no charge.",
  };
}

export function outForDeliveryEmail(
  booking: Booking,
  driver: DriverMailContact | null,
  paidCents: number
): TransactionalEmail {
  const slot = slotWindow(booking.deliverySlot ?? booking.collectionSlot);
  const due = amountDueCentsForBooking(booking);
  const balance = Math.max(0, due - Math.max(0, paidCents));
  const collectedMeta = [
    dayLabel(booking.collectionDate, "d MMM"),
    driver?.name?.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
  const timeline: EmailTimelineStep[] = [
    {
      title: "Booking confirmed",
      meta: dayLabel(booking.createdAt, "d MMM") || "Received",
      state: "done",
    },
    {
      title: "Collected",
      meta: collectedMeta || "Collected",
      state: "done",
    },
    {
      title: "Cleaned and quality checked",
      meta: "Ready to leave our facility",
      state: "done",
    },
    {
      title: "Out for delivery",
      meta: `Today · ${slot.spaced}`,
      state: "now",
    },
  ];
  const dueLine =
    balance > 0
      ? `Total due on delivery: ${formatEmailRand(balance)}.`
      : "Nothing is due on delivery.";
  const payLine =
    balance > 0
      ? `Payment is taken on delivery — card or EFT.`
      : `Payment is already settled.`;
  return {
    subject: "Your rug is on the way back",
    preheader: `Out for delivery · arriving between ${slot.spaced.replace(" – ", " and ")}`,
    eyebrow: "OUT FOR DELIVERY",
    heading: "Clean, dry and heading home",
    intro: `Your rug is on the van and arriving this ${slot.dayPart}. ${payLine}`,
    timeline,
    cta: { label: "Track my delivery", href: bookingPageUrl(booking.id) },
    footnote: dueLine,
  };
}

function discountCents(booking: Booking): number {
  const promo = booking.promotion?.discountCents;
  if (typeof promo === "number" && promo > 0) return Math.round(promo);
  const measured = booking.measuredQuote?.discountCents;
  if (typeof measured === "number" && measured > 0) return Math.round(measured);
  return 0;
}

export function deliveredEmail(
  booking: Booking,
  payments: MailPayment[],
  punches: number | null
): TransactionalEmail {
  const name = emailFirstName(booking.customer.name);
  const due = amountDueCentsForBooking(booking);
  const succeeded = succeededPayments(payments).filter((row) =>
    ["DEPOSIT", "BALANCE", "REFUND"].includes(String(row.kind || "").toUpperCase())
  );
  const paid = netSucceededCents(
    succeeded.map((row) => ({
      kind: String(row.kind || "").toUpperCase(),
      amountCents: row.amountCents,
    }))
  );
  const discount = discountCents(booking);
  const gross = due + discount;
  const code = booking.promotion?.code?.trim() || booking.couponCode?.trim();
  const ledger: EmailLedgerRow[] = [
    {
      label: `${booking.rug?.type?.trim() || "Rug"} cleaned`,
      value: formatEmailRand(gross),
    },
  ];
  for (const label of bookingAddOnLabels(booking.addOns, OPS_ADD_ON_COPY)) {
    ledger.push({ label, value: "Included", tone: "good" });
  }
  ledger.push({ label: "Collection & delivery", value: "Free", tone: "good" });
  if (code && discount > 0) {
    ledger.push({
      label: `Coupon ${code}`,
      value: `−${formatEmailRand(discount)}`,
      tone: "good",
    });
  } else if (code) {
    ledger.push({ label: `Coupon ${code}`, value: "Applied", tone: "good" });
  }
  const dated = [...succeeded].sort((a, b) =>
    String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
  );
  for (const row of dated) {
    const kind = String(row.kind || "").toUpperCase();
    const cents = Number(row.amountCents) || 0;
    const amount =
      kind === "REFUND" ? `−${formatEmailRand(cents)}` : formatEmailRand(cents);
    ledger.push({
      label: `${kindLabel(kind)} · ${providerLabel(String(row.provider || ""))}`,
      value: amount,
      tone: kind === "REFUND" ? "good" : undefined,
    });
  }
  const latest = dated.filter((row) => String(row.kind).toUpperCase() !== "REFUND").at(-1);
  const paidOn = latest?.createdAt
    ? dayLabel(String(latest.createdAt), "d MMM yyyy")
    : dayLabel(new Date().toISOString(), "d MMM yyyy");
  const channel = latest ? providerLabel(String(latest.provider || "")) : "";
  let heroLabel = "AMOUNT DUE";
  let heroValue = formatEmailRand(due);
  let heroNote = "No payment on the ledger yet";
  if (paid > 0 && paid >= due) {
    heroLabel = "PAID IN FULL";
    heroValue = formatEmailRand(paid);
    heroNote = [channel, paidOn].filter(Boolean).join(" · ");
  } else if (paid > 0) {
    heroLabel = "AMOUNT PAID";
    heroValue = formatEmailRand(paid);
    heroNote = `Balance ${formatEmailRand(Math.max(0, due - paid))}`;
  }

  const card =
    punches == null
      ? undefined
      : {
          filled:
            punches > 0 && punches % LOYALTY_PUNCHES_PER_REWARD === 0
              ? LOYALTY_PUNCHES_PER_REWARD
              : punches % LOYALTY_PUNCHES_PER_REWARD,
          total: LOYALTY_PUNCHES_PER_REWARD,
          note:
            punches <= 0
              ? "Five cleans earn one rug free, up to R500."
              : punches % LOYALTY_PUNCHES_PER_REWARD === 0
                ? "That's a full card. Your next rug clean is free, up to R500."
                : `That's stamp ${punches % LOYALTY_PUNCHES_PER_REWARD} of ${LOYALTY_PUNCHES_PER_REWARD}. Five cleans earn one rug free, up to R500.`,
        };

  return {
    subject: `Delivered — invoice for ${booking.id}`,
    preheader: `${formatEmailRand(paid)} paid · thank you`,
    eyebrow: "DELIVERED",
    heading: name ? `All done — thank you, ${name}` : "All done — thank you",
    intro:
      "Your rug was delivered. Your invoice is below, with the amounts taken from the payment ledger.",
    hero: { label: heroLabel, value: heroValue, note: heroNote },
    ledger,
    stamps: card,
    cta: { label: "View invoice", href: bookingPageUrl(booking.id, "invoice") },
    footnote: "Not happy with something? Tell us within 7 days and we will re-clean at no charge.",
  };
}

export function loyaltyRewardEmail(input: {
  bookingId: string;
  name?: string;
}): TransactionalEmail {
  const reward = formatEmailRand(LOYALTY_REWARD_VALUE_CENTS).replace(/\.00$/, "");
  const name = emailFirstName(input.name);
  const bookingUrl = bookingPageUrl(input.bookingId);
  return {
    subject: "Your next rug clean is free",
    preheader: "Five cleans done — the next rug is on us",
    eyebrow: "REWARD UNLOCKED",
    heading: "Your next clean is on us",
    intro: name
      ? `${name}, you've completed five qualifying cleans with us. Your reward is one rug cleaned free, up to ${reward}. Redeem it from My Bookings, then book — the discount shows in your price summary.`
      : `You've completed five qualifying cleans with us. Your reward is one rug cleaned free, up to ${reward}. Redeem it from My Bookings, then book — the discount shows in your price summary.`,
    stamps: {
      filled: LOYALTY_PUNCHES_PER_REWARD,
      total: LOYALTY_PUNCHES_PER_REWARD,
      note: "Card complete · redeem the reward before you book",
    },
    ledger: [
      { label: "Reward", value: "One rug free" },
      { label: "Maximum value", value: reward },
      { label: "Applies to", value: "Rug cleaning" },
      { label: "Valid until", value: "Until redeemed" },
    ],
    cta: { label: "Book my free clean", href: `${getAppBaseUrl()}/book/rug` },
    links: [{ label: `View booking ${input.bookingId}`, href: bookingUrl }],
    footnote: "One reward per booking. The discount appears in your price summary at checkout.",
  };
}

export function passwordResetEmail(input: {
  resetUrl: string;
  expiresInMinutes: number;
}): TransactionalEmail {
  return {
    subject: "Reset your Spark & Clean password",
    preheader: `This link expires in ${input.expiresInMinutes} minutes`,
    eyebrow: "PASSWORD RESET",
    heading: "Reset your password",
    intro: `Tap the button below to choose a new password. For your security this link expires in ${input.expiresInMinutes} minutes and can only be used once.`,
    cta: { label: "Reset my password", href: input.resetUrl },
    footnote:
      "If you didn't request this, you can safely ignore this email — your account stays secure.",
  };
}
