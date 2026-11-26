import { describe, expect, it } from "vitest";
import {
  parseRandToCents,
  refundedCentsForSource,
} from "@/lib/payments/refundAmount";

describe("parseRandToCents", () => {
  it("reads rands with a dot or a comma", () => {
    expect(parseRandToCents("75")).toBe(7500);
    expect(parseRandToCents("75.50")).toBe(7550);
    expect(parseRandToCents("75,5")).toBe(7550);
    expect(parseRandToCents("R 1 234.50")).toBe(123450);
    expect(parseRandToCents("1.234,50")).toBe(123450);
  });

  it("rejects blank, zero, and extra fractions", () => {
    expect(parseRandToCents("")).toBeNull();
    expect(parseRandToCents("0")).toBeNull();
    expect(parseRandToCents("0.00")).toBeNull();
    expect(parseRandToCents("12.345")).toBeNull();
  });
});

describe("refundedCentsForSource", () => {
  it("counts succeeded refunds for that charge only", () => {
    expect(
      refundedCentsForSource(
        [
          {
            kind: "REFUND",
            status: "SUCCEEDED",
            amountCents: 2000,
            sourceProviderRef: "pi_1",
          },
          {
            kind: "REFUND",
            status: "FAILED",
            amountCents: 5000,
            sourceProviderRef: "pi_1",
          },
          {
            kind: "REFUND",
            status: "SUCCEEDED",
            amountCents: 9000,
            sourceProviderRef: "pi_2",
          },
          {
            kind: "DEPOSIT",
            status: "SUCCEEDED",
            amountCents: 7500,
            sourceProviderRef: "pi_1",
          },
        ],
        "pi_1"
      )
    ).toBe(2000);
  });
});
