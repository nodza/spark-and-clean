import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { PaymentKind } from "@/models/Payment";

const OZOW_API_URL =
  process.env.OZOW_API_URL?.trim() || "https://api.ozow.com/postpaymentrequest";

export type OzowNotification = {
  SiteCode?: string;
  TransactionId?: string;
  TransactionReference?: string;
  Amount?: string;
  Status?: string;
  Optional1?: string;
  Optional2?: string;
  Optional3?: string;
  Optional4?: string;
  Optional5?: string;
  CurrencyCode?: string;
  IsTest?: string;
  StatusMessage?: string;
  Hash?: string;
};

function env(name: "OZOW_SITE_CODE" | "OZOW_PRIVATE_KEY" | "OZOW_API_KEY" | "APP_URL"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function getAppUrl(): string {
  return env("APP_URL").replace(/\/$/, "");
}

/** Ozow is ready when site code, private key, and API key are set. */
export function isOzowConfigured(): boolean {
  return Boolean(
    process.env.OZOW_SITE_CODE?.trim() &&
      process.env.OZOW_PRIVATE_KEY?.trim() &&
      process.env.OZOW_API_KEY?.trim() &&
      process.env.APP_URL?.trim()
  );
}

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() &&
      process.env.APP_URL?.trim()
  );
}

export function ozowIsTest(): boolean {
  const raw = process.env.OZOW_IS_TEST?.trim().toLowerCase();
  if (raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  return process.env.NODE_ENV !== "production";
}

/** Rand amount as Ozow expects: always two decimal places. */
export function formatOzowAmount(cents: number): string {
  return (Math.max(0, Math.round(cents)) / 100).toFixed(2);
}

function sha512Hex(input: string): string {
  return createHash("sha512").update(input, "utf8").digest("hex");
}

/**
 * Request hash: only fields that have a value, in Ozow field order, then private key.
 * Whole string lowercased before SHA512.
 */
export function buildOzowRequestHash(
  fields: Record<string, string | boolean | undefined | null>,
  privateKey: string
): string {
  const order = [
    "siteCode",
    "countryCode",
    "currencyCode",
    "amount",
    "transactionReference",
    "bankReference",
    "optional1",
    "optional2",
    "optional3",
    "optional4",
    "optional5",
    "customer",
    "cancelUrl",
    "errorUrl",
    "successUrl",
    "notifyUrl",
    "isTest",
    "selectedBankId",
    "bankAccountNumber",
    "branchCode",
    "bankAccountName",
    "payeeDisplayName",
    "expiryDateUtc",
    "allowVariableAmount",
    "variableAmountMin",
    "variableAmountMax",
    "customerIdentifier",
    "customerCellphoneNumber",
  ] as const;

  let concatenated = "";
  for (const key of order) {
    const raw = fields[key];
    if (raw === undefined || raw === null || raw === "") continue;
    concatenated += typeof raw === "boolean" ? String(raw) : String(raw);
  }
  concatenated += privateKey;
  return sha512Hex(concatenated.toLowerCase());
}

/**
 * Notification hash: 13 fields (empty string when missing) + private key.
 * Amount always two decimals.
 */
export function buildOzowNotificationHash(
  notification: OzowNotification,
  privateKey: string
): string {
  const amountNum = Number(notification.Amount || 0);
  const amount = Number.isFinite(amountNum) ? amountNum.toFixed(2) : "0.00";
  const concatenated = [
    notification.SiteCode ?? "",
    notification.TransactionId ?? "",
    notification.TransactionReference ?? "",
    amount,
    notification.Status ?? "",
    notification.Optional1 ?? "",
    notification.Optional2 ?? "",
    notification.Optional3 ?? "",
    notification.Optional4 ?? "",
    notification.Optional5 ?? "",
    notification.CurrencyCode ?? "",
    notification.IsTest ?? "",
    notification.StatusMessage ?? "",
    privateKey,
  ].join("");
  return sha512Hex(concatenated.toLowerCase());
}

export function verifyOzowNotificationHash(
  notification: OzowNotification,
  privateKey = process.env.OZOW_PRIVATE_KEY?.trim() ?? ""
): boolean {
  const provided = (notification.Hash ?? "").trim();
  if (!privateKey || !provided) return false;
  const expected = buildOzowNotificationHash(notification, privateKey);
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided.toLowerCase(), "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Short merchant reference (max 50) — booking + kind live in optional fields. */
export function buildOzowTransactionReference(
  bookingId: string,
  kind: PaymentKind
): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const kindTag = kind === "BALANCE" ? "BAL" : "DEP";
  const base = `${bookingId}-${kindTag}-${suffix}`;
  return base.slice(0, 50);
}

/** Bank statement ref — alphanumeric / spaces / dashes, max 20. */
export function buildOzowBankReference(kind: PaymentKind): string {
  return kind === "BALANCE" ? "SC-BALANCE" : "SC-DEPOSIT";
}

export type CreateOzowHostedPaymentInput = {
  bookingId: string;
  customerEmail: string;
  customerName?: string;
  kind: Extract<PaymentKind, "DEPOSIT" | "BALANCE">;
  amountCents: number;
};

export type CreateOzowHostedPaymentResult = {
  url: string;
  paymentRequestId: string;
  amountCents: number;
  transactionReference: string;
};

/**
 * Create an Ozow hosted payment and return the redirect URL.
 * Does not write paymentStatus — the notify webhook does that via the ledger.
 */
export async function createOzowHostedPayment(
  input: CreateOzowHostedPaymentInput
): Promise<CreateOzowHostedPaymentResult> {
  const amountCents = Math.round(input.amountCents);
  if (!Number.isFinite(amountCents) || amountCents < 1) {
    throw new Error("OZOW_AMOUNT_TOO_SMALL");
  }

  const siteCode = env("OZOW_SITE_CODE");
  const privateKey = env("OZOW_PRIVATE_KEY");
  const apiKey = env("OZOW_API_KEY");
  const appUrl = getAppUrl();
  const bookingId = input.bookingId.trim();
  const kind = input.kind;
  const amount = formatOzowAmount(amountCents);
  const transactionReference = buildOzowTransactionReference(bookingId, kind);
  const bankReference = buildOzowBankReference(kind);
  const isTest = ozowIsTest();
  const successUrl = `${appUrl}/booking/${encodeURIComponent(bookingId)}?checkout=success`;
  const cancelUrl = `${appUrl}/booking/${encodeURIComponent(bookingId)}?checkout=cancel`;
  const errorUrl = cancelUrl;
  const notifyUrl = `${appUrl}/api/webhooks/ozow`;
  const customer =
    (input.customerName || input.customerEmail || "").trim().slice(0, 100) ||
    undefined;

  const fields = {
    siteCode,
    countryCode: "ZA",
    currencyCode: "ZAR",
    amount,
    transactionReference,
    bankReference,
    optional1: bookingId.slice(0, 50),
    optional2: kind,
    customer,
    cancelUrl,
    errorUrl,
    successUrl,
    notifyUrl,
    isTest,
  };

  const hashCheck = buildOzowRequestHash(fields, privateKey);
  const body = {
    siteCode,
    countryCode: "ZA",
    currencyCode: "ZAR",
    amount: Number(amount),
    transactionReference,
    bankReference,
    optional1: fields.optional1,
    optional2: fields.optional2,
    ...(customer ? { customer } : {}),
    cancelUrl,
    errorUrl,
    successUrl,
    notifyUrl,
    isTest,
    hashCheck,
  };

  const response = await fetch(OZOW_API_URL, {
    method: "POST",
    headers: {
      ApiKey: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  let parsed: {
    url?: string | null;
    paymentRequestId?: string | null;
    errorMessage?: string | null;
  } = {};
  try {
    parsed = JSON.parse(rawText) as typeof parsed;
  } catch {
    throw new Error(
      response.ok
        ? "Ozow returned an invalid response"
        : `Ozow request failed (${response.status})`
    );
  }

  if (!parsed.url || parsed.errorMessage) {
    throw new Error(
      parsed.errorMessage?.trim() || "Ozow did not return a payment URL"
    );
  }

  return {
    url: parsed.url,
    paymentRequestId: String(parsed.paymentRequestId || ""),
    amountCents,
    transactionReference,
  };
}
