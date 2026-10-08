import Stripe from "stripe";
import { depositAmountCents, DEPOSIT_FRACTION } from "@/lib/payments/deposit";

const STRIPE_API_VERSION =
  "2026-03-25.dahlia; custom_checkout_payment_form_preview=v1" as Stripe.LatestApiVersion;

/**
 * Stripe Checkout session creation only.
 * The return URL must not mark the booking paid — the webhook story does that.
 */

function requiredEnv(name: "STRIPE_SECRET_KEY" | "APP_URL"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export function getAppUrl(): string {
  return requiredEnv("APP_URL").replace(/\/$/, "");
}

export function getStripe(): Stripe {
  return new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
    apiVersion: STRIPE_API_VERSION,
  });
}

async function createCheckoutSession(input: {
  bookingId: string;
  customerEmail: string;
  amountCents: number;
  kind: "DEPOSIT" | "BALANCE";
  productName: string;
  productDescription: string;
}): Promise<{ clientSecret: string; amountCents: number }> {
  const bookingId = input.bookingId;
  const returnUrl = `${getAppUrl()}/booking/${encodeURIComponent(bookingId)}?checkout=success`;

  // Leave customer_email unset. Stripe locks the Checkout email field when it is set.
  const session = await getStripe().checkout.sessions.create({
    ui_mode: "form",
    mode: "payment",
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    submit_type: "auto",
    integration_identifier: "custom_embedded_web_0001",
    return_url: returnUrl,
    client_reference_id: bookingId,
    metadata: { bookingId, kind: input.kind },
    payment_intent_data: {
      metadata: { bookingId, kind: input.kind },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "zar",
          unit_amount: input.amountCents,
          product_data: {
            name: input.productName,
            description: input.productDescription,
          },
        },
      },
    ],
  } as Stripe.Checkout.SessionCreateParams);

  if (!session.client_secret) {
    throw new Error("Stripe did not return a checkout client secret");
  }

  return { clientSecret: session.client_secret, amountCents: input.amountCents };
}

export async function createDepositCheckoutSession(input: {
  bookingId: string;
  customerEmail: string;
  amountDueCents: number;
}): Promise<{ clientSecret: string; amountCents: number }> {
  const amountCents = depositAmountCents(input.amountDueCents);
  if (amountCents < 1) {
    throw new Error("DEPOSIT_AMOUNT_TOO_SMALL");
  }

  const percent = Math.round(DEPOSIT_FRACTION * 100);
  return createCheckoutSession({
    bookingId: input.bookingId,
    customerEmail: input.customerEmail,
    amountCents,
    kind: "DEPOSIT",
    productName: `Collection deposit · ${input.bookingId}`,
    productDescription: `${percent}% deposit. The balance is due before delivery.`,
  });
}

export async function createBalanceCheckoutSession(input: {
  bookingId: string;
  customerEmail: string;
  amountCents: number;
}): Promise<{ clientSecret: string; amountCents: number }> {
  const amountCents = Math.max(0, Math.round(input.amountCents));
  if (amountCents < 1) {
    throw new Error("BALANCE_AMOUNT_TOO_SMALL");
  }

  return createCheckoutSession({
    bookingId: input.bookingId,
    customerEmail: input.customerEmail,
    amountCents,
    kind: "BALANCE",
    productName: `Remaining balance · ${input.bookingId}`,
    productDescription: "Final payment for this booking.",
  });
}

/** Checkout client secrets look like `cs_test_..._secret_...`. */
export function checkoutSessionIdFromClientSecret(clientSecret: string): string | null {
  const marker = "_secret_";
  const index = clientSecret.indexOf(marker);
  if (!clientSecret.startsWith("cs_") || index <= 3) return null;
  return clientSecret.slice(0, index);
}

export async function retrieveCheckoutSession(sessionId: string) {
  return getStripe().checkout.sessions.retrieve(sessionId);
}
