import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { POST } from "./route";

const WEBHOOK_SECRET = "whsec_test_fixture";
const SECRET_KEY = "sk_test_webhook_unit";

type PaymentRow = {
  provider: string;
  providerRef: string;
  bookingId: string;
  kind: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
};

type BookingRow = {
  id: string;
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  paymentStatus: string;
  billing: {
    currency: string;
    amountDueCents: number;
    amountPaidCents: number;
  };
};

const state = vi.hoisted(() => ({
  payments: [] as PaymentRow[],
  booking: null as BookingRow | null,
  crashWrites: false,
}));

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));

vi.mock("@/models/Payment", () => ({
  Payment: {
    create: async (doc: PaymentRow) => {
      if (state.payments.some((row) => row.providerRef === doc.providerRef)) {
        const err = new Error("E11000 duplicate key") as Error & { code: number };
        err.code = 11000;
        throw err;
      }
      state.payments.push({ ...doc });
      return doc;
    },
    find: (query: { bookingId?: string; status?: string }) => ({
      select: () => ({
        lean: async () =>
          state.payments.filter(
            (row) =>
              row.bookingId === query.bookingId && row.status === query.status
          ),
      }),
    }),
    findOne: (query: { providerRef?: string }) => ({
      lean: async () =>
        state.payments.find((row) => row.providerRef === query.providerRef) ??
        null,
    }),
  },
}));

vi.mock("@/models/Booking", () => ({
  Booking: {
    findOne: (query: { id?: string }) => ({
      lean: async () => {
        if (!state.booking || state.booking.id !== query.id) return null;
        return state.booking;
      },
    }),
    updateOne: async (
      filter: { id?: string; $or?: Array<Record<string, unknown>> },
      update: {
        $set?: {
          billing?: BookingRow["billing"];
          paymentStatus?: string;
        };
      }
    ) => {
      if (state.crashWrites) {
        throw new Error(
          "Could not update booking billing\n    at applyLedger (ledger.ts:207)"
        );
      }
      const booking = state.booking;
      if (!booking || booking.id !== filter.id) return { matchedCount: 0 };
      const paid = booking.billing.amountPaidCents;
      const matches = (filter.$or ?? []).some((clause) => {
        if ("billing.amountPaidCents" in clause) {
          return clause["billing.amountPaidCents"] === paid;
        }
        return false;
      });
      if (!matches) return { matchedCount: 0 };
      if (update.$set?.billing) booking.billing = update.$set.billing;
      if (update.$set?.paymentStatus) {
        booking.paymentStatus = update.$set.paymentStatus;
      }
      return { matchedCount: 1 };
    },
  },
}));

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "checkout.session.completed.json"
);
const checkoutPayload = readFileSync(fixturePath, "utf8");

const paymentIntentPayload = JSON.stringify({
  id: "evt_test_pi_same_charge",
  object: "event",
  type: "payment_intent.succeeded",
  data: {
    object: {
      id: "pi_test_deposit_replay",
      object: "payment_intent",
      status: "succeeded",
      amount: 7500,
      amount_received: 7500,
      currency: "zar",
      metadata: { bookingId: "SC-1", kind: "DEPOSIT" },
    },
  },
});

function unpaidBooking(amountDueCents = 15000): BookingRow {
  return {
    id: "SC-1",
    estimatedPriceMin: 100,
    estimatedPriceMax: 200,
    paymentStatus: "UNPAID",
    billing: {
      currency: "ZAR",
      amountDueCents,
      amountPaidCents: 0,
    },
  };
}

function signedRequest(body: string, signature?: string) {
  const header =
    signature ??
    new Stripe(SECRET_KEY).webhooks.generateTestHeaderString({
      payload: body,
      secret: WEBHOOK_SECRET,
    });
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "stripe-signature": header,
      "content-type": "application/json",
    },
    body,
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    state.payments = [];
    state.booking = unpaidBooking();
    state.crashWrites = false;
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = SECRET_KEY;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records one SUCCEEDED deposit and does not double-count a replay", async () => {
    const first = await POST(signedRequest(checkoutPayload));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ received: true });
    expect(state.payments).toHaveLength(1);
    expect(state.payments[0]).toMatchObject({
      provider: "stripe",
      providerRef: "pi_test_deposit_replay",
      bookingId: "SC-1",
      kind: "DEPOSIT",
      amountCents: 7500,
      currency: "ZAR",
      status: "SUCCEEDED",
    });
    expect(state.booking?.paymentStatus).toBe("DEPOSIT");
    expect(state.booking?.billing.amountPaidCents).toBe(7500);
    expect(state.booking?.billing.amountDueCents).toBe(15000);

    const replay = await POST(signedRequest(checkoutPayload));
    expect(replay.status).toBe(200);
    expect(state.payments).toHaveLength(1);
    expect(state.booking?.billing.amountPaidCents).toBe(7500);
    expect(state.booking?.paymentStatus).toBe("DEPOSIT");

    const sameCharge = await POST(signedRequest(paymentIntentPayload));
    expect(sameCharge.status).toBe(200);
    expect(state.payments).toHaveLength(1);
    expect(state.booking?.billing.amountPaidCents).toBe(7500);
  });

  it("sets PAID when the succeeded amount covers the full amount due", async () => {
    state.booking = unpaidBooking(7500);
    const res = await POST(signedRequest(checkoutPayload));
    expect(res.status).toBe(200);
    expect(state.payments).toHaveLength(1);
    expect(state.booking?.paymentStatus).toBe("PAID");
    expect(state.booking?.billing.amountPaidCents).toBe(7500);

    await POST(signedRequest(checkoutPayload));
    expect(state.payments).toHaveLength(1);
    expect(state.booking?.billing.amountPaidCents).toBe(7500);
    expect(state.booking?.paymentStatus).toBe("PAID");
  });

  it("returns 400 for an invalid signature and leaves the booking unpaid", async () => {
    const header = new Stripe(SECRET_KEY).webhooks.generateTestHeaderString({
      payload: checkoutPayload,
      secret: WEBHOOK_SECRET,
    });
    const tampered = checkoutPayload.replace(
      '"amount_total": 7500',
      '"amount_total": 15000'
    );
    const res = await POST(signedRequest(tampered, header));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Invalid signature" });
    expect(JSON.stringify(body)).not.toContain("ledger.ts");
    expect(state.payments).toHaveLength(0);
    expect(state.booking?.paymentStatus).toBe("UNPAID");
    expect(state.booking?.billing.amountPaidCents).toBe(0);
  });

  it("returns 400 when the Stripe-Signature header is missing", async () => {
    const res = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: checkoutPayload,
      })
    );
    expect(res.status).toBe(400);
    expect(state.booking?.paymentStatus).toBe("UNPAID");
    expect(state.payments).toHaveLength(0);
  });

  it("returns 200 for an unrelated event and does not write a payment", async () => {
    const ignored = JSON.stringify({
      id: "evt_customer",
      object: "event",
      type: "customer.created",
      data: { object: { id: "cus_1", object: "customer" } },
    });
    const res = await POST(signedRequest(ignored));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(state.payments).toHaveLength(0);
    expect(state.booking?.paymentStatus).toBe("UNPAID");
  });

  it("returns 500 without a stack trace when the ledger write crashes", async () => {
    state.crashWrites = true;
    const res = await POST(signedRequest(checkoutPayload));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Failed to record payment" });
    expect(JSON.stringify(body)).not.toContain("ledger.ts");
    expect(state.booking?.paymentStatus).toBe("UNPAID");

    state.crashWrites = false;
    const retry = await POST(signedRequest(checkoutPayload));
    expect(retry.status).toBe(200);
    expect(state.payments).toHaveLength(1);
    expect(state.booking?.paymentStatus).toBe("DEPOSIT");
    expect(state.booking?.billing.amountPaidCents).toBe(7500);
  });
});
