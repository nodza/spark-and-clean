import { recordSuccess } from "@/lib/payments/ledger";
import {
  type OzowNotification,
  verifyOzowNotificationHash,
} from "@/lib/payments/ozow";
import type { PaymentKind } from "@/models/Payment";

function parseKind(raw: string | undefined): PaymentKind | null {
  const kind = (raw || "").trim().toUpperCase();
  if (kind === "DEPOSIT" || kind === "BALANCE") return kind;
  return null;
}

/**
 * Verified Ozow notify URL handler. Tampered hashes never touch the ledger.
 * Only Status=Complete records a success; other statuses are acknowledged.
 */
export async function fulfillOzowNotification(notification: OzowNotification) {
  if (!verifyOzowNotificationHash(notification)) {
    return { ok: false as const, error: "invalid_hash" as const };
  }

  const status = (notification.Status || "").trim();
  if (status.toLowerCase() !== "complete") {
    return { ok: true as const, applied: false };
  }

  const expectedSite = process.env.OZOW_SITE_CODE?.trim() || "";
  if (
    expectedSite &&
    (notification.SiteCode || "").trim().toLowerCase() !==
      expectedSite.toLowerCase()
  ) {
    return { ok: false as const, error: "site_mismatch" as const };
  }

  const bookingId = (notification.Optional1 || "").trim();
  const kind = parseKind(notification.Optional2);
  const providerRef = (notification.TransactionId || "").trim();
  if (!bookingId || !kind || !providerRef) {
    return { ok: true as const, applied: false };
  }

  const amountRand = Number(notification.Amount || 0);
  if (!Number.isFinite(amountRand) || amountRand <= 0) {
    return { ok: false as const, error: "invalid_amount" as const };
  }
  const amountCents = Math.round(amountRand * 100);

  return recordSuccess({
    provider: "ozow",
    providerRef,
    bookingId,
    kind,
    amountCents,
    currency: (notification.CurrencyCode || "ZAR").trim() || "ZAR",
  });
}
