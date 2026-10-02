import { beforeEach, describe, expect, it, vi } from "vitest";

const recordSuccess = vi.fn();
const verifyOzowNotificationHash = vi.fn();

vi.mock("@/lib/payments/ledger", () => ({
  recordSuccess: (...args: unknown[]) => recordSuccess(...args),
}));

vi.mock("@/lib/payments/ozow", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/ozow")>(
    "@/lib/payments/ozow"
  );
  return {
    ...actual,
    verifyOzowNotificationHash: (...args: unknown[]) =>
      verifyOzowNotificationHash(...args),
  };
});

import { fulfillOzowNotification } from "@/lib/payments/ozowWebhook";

describe("fulfillOzowNotification", () => {
  beforeEach(() => {
    recordSuccess.mockReset();
    verifyOzowNotificationHash.mockReset();
    process.env.OZOW_SITE_CODE = "TSTSTE0001";
  });

  it("rejects a tampered callback without writing the ledger", async () => {
    verifyOzowNotificationHash.mockReturnValue(false);
    const result = await fulfillOzowNotification({
      SiteCode: "TSTSTE0001",
      TransactionId: "tx-1",
      Amount: "50.00",
      Status: "Complete",
      Optional1: "SC-1",
      Optional2: "DEPOSIT",
      Hash: "bad",
    });
    expect(result).toEqual({ ok: false, error: "invalid_hash" });
    expect(recordSuccess).not.toHaveBeenCalled();
  });

  it("records an Ozow DEPOSIT on Complete without inventing paymentStatus", async () => {
    verifyOzowNotificationHash.mockReturnValue(true);
    recordSuccess.mockResolvedValue({
      ok: true,
      paymentStatus: "DEPOSIT",
      billing: { currency: "ZAR", amountDueCents: 10000, amountPaidCents: 5000 },
    });

    const result = await fulfillOzowNotification({
      SiteCode: "TSTSTE0001",
      TransactionId: "ozow-tx-uuid",
      Amount: "50.00",
      Status: "Complete",
      Optional1: "SC-1",
      Optional2: "DEPOSIT",
      CurrencyCode: "ZAR",
      Hash: "ok",
    });

    expect(result.ok).toBe(true);
    expect(recordSuccess).toHaveBeenCalledWith({
      provider: "ozow",
      providerRef: "ozow-tx-uuid",
      bookingId: "SC-1",
      kind: "DEPOSIT",
      amountCents: 5000,
      currency: "ZAR",
    });
  });

  it("acknowledges non-Complete statuses without recording", async () => {
    verifyOzowNotificationHash.mockReturnValue(true);
    const result = await fulfillOzowNotification({
      SiteCode: "TSTSTE0001",
      TransactionId: "ozow-tx-uuid",
      Amount: "50.00",
      Status: "Cancelled",
      Optional1: "SC-1",
      Optional2: "DEPOSIT",
      Hash: "ok",
    });
    expect(result).toEqual({ ok: true, applied: false });
    expect(recordSuccess).not.toHaveBeenCalled();
  });
});
