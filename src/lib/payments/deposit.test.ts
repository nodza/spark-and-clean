import { describe, expect, it } from "vitest";
import {
  DEPOSIT_FRACTION,
  amountDueCentsForBooking,
  balanceAmountCents,
  depositAmountCents,
  remainingBalanceCents,
} from "@/lib/payments/deposit";
import {
  authorizeBalanceCheckout,
  authorizeCheckout,
  authorizeDepositCheckout,
} from "@/lib/payments/checkoutAccess";

describe("depositAmountCents", () => {
  it("charges half of the amount due, rounded", () => {
    expect(DEPOSIT_FRACTION).toBe(0.5);
    expect(depositAmountCents(15000)).toBe(7500);
    expect(depositAmountCents(10001)).toBe(5001);
  });

  it("is zero when nothing is owed", () => {
    expect(depositAmountCents(0)).toBe(0);
    expect(depositAmountCents(-10)).toBe(0);
  });
});

describe("balanceAmountCents", () => {
  it("returns the unpaid remainder after a deposit", () => {
    expect(
      balanceAmountCents({
        estimatedPriceMin: 100,
        estimatedPriceMax: 200,
        billing: { amountDueCents: 15000, amountPaidCents: 7500 },
      })
    ).toBe(7500);
  });
});

describe("remainingBalanceCents", () => {
  it("returns due minus paid", () => {
    expect(remainingBalanceCents(15000, 7500)).toBe(7500);
    expect(remainingBalanceCents(15000, 15000)).toBe(0);
  });

  it("never goes negative", () => {
    expect(remainingBalanceCents(1000, 2000)).toBe(0);
  });
});

describe("amountDueCentsForBooking", () => {
  it("uses billing.amountDueCents when it has been saved", () => {
    expect(
      depositAmountCents(
        amountDueCentsForBooking({
          estimatedPriceMin: 1,
          estimatedPriceMax: 1,
          billing: { amountDueCents: 10001 },
        })
      )
    ).toBe(5001);
  });

  it("uses the estimate midpoint when billing has not been saved", () => {
    expect(
      amountDueCentsForBooking({
        estimatedPriceMin: 100,
        estimatedPriceMax: 200,
      })
    ).toBe(15000);
  });
});

describe("authorizeDepositCheckout", () => {
  const booking = {
    userId: "user-sarah",
    status: "SCHEDULED",
    paymentStatus: "UNPAID",
    customer: { email: "sarah@example.com" },
  };

  it("allows the client on an unclaimed booking with the same email", () => {
    expect(
      authorizeDepositCheckout(
        { id: "user-sarah", email: "sarah@example.com", role: "client" },
        {
          status: "BOOKED",
          paymentStatus: "UNPAID",
          customer: { email: "sarah@example.com" },
        }
      ).ok
    ).toBe(true);
  });

  it("allows the owning client", () => {
    expect(
      authorizeDepositCheckout(
        { id: "user-sarah", email: "sarah@example.com", role: "client" },
        booking
      ).ok
    ).toBe(true);
  });

  it("rejects a client who does not own the booking", () => {
    const result = authorizeDepositCheckout(
      { id: "user-other", email: "other@example.com", role: "client" },
      booking
    );
    expect(result).toEqual({ ok: false, status: 403, error: "Forbidden" });
  });

  it("rejects an anonymous caller", () => {
    expect(authorizeDepositCheckout(null, booking)).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
  });

  it("rejects a technician", () => {
    const result = authorizeDepositCheckout(
      { id: "tech-1", email: "thabo@example.com", role: "technician" },
      booking
    );
    expect(result).toEqual({ ok: false, status: 403, error: "Forbidden" });
  });

  it("rejects a guest session", () => {
    const result = authorizeDepositCheckout(
      { id: "guest:1", email: "sarah@example.com", role: "client", guest: true },
      booking
    );
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("allows BALANCE only after a deposit", () => {
    const session = {
      id: "user-sarah",
      email: "sarah@example.com",
      role: "client" as const,
    };
    expect(
      authorizeCheckout(
        session,
        { ...booking, paymentStatus: "DEPOSIT" },
        "BALANCE"
      ).ok
    ).toBe(true);
    expect(authorizeCheckout(session, booking, "BALANCE")).toMatchObject({
      ok: false,
      status: 409,
    });
  });
});

describe("authorizeBalanceCheckout", () => {
  const booking = {
    userId: "user-sarah",
    status: "SCHEDULED",
    paymentStatus: "DEPOSIT",
    customer: { email: "sarah@example.com" },
  };

  it("allows the owning client when there is a remaining balance", () => {
    expect(
      authorizeBalanceCheckout(
        { id: "user-sarah", email: "sarah@example.com", role: "client" },
        booking,
        7500
      ).ok
    ).toBe(true);
  });

  it("rejects when paymentStatus is not DEPOSIT", () => {
    const result = authorizeBalanceCheckout(
      { id: "user-sarah", email: "sarah@example.com", role: "client" },
      { ...booking, paymentStatus: "UNPAID" },
      7500
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });

  it("rejects when remaining cents are zero", () => {
    const result = authorizeBalanceCheckout(
      { id: "user-sarah", email: "sarah@example.com", role: "client" },
      booking,
      0
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });
});
