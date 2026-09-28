import { describe, expect, it } from "vitest";
import {
  DEPOSIT_FRACTION,
  amountDueCentsForBooking,
  depositAmountCents,
} from "@/lib/payments/deposit";
import { authorizeDepositCheckout } from "@/lib/payments/checkoutAccess";

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
});
