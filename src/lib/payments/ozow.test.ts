import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOzowNotificationHash,
  buildOzowRequestHash,
  formatOzowAmount,
  verifyOzowNotificationHash,
} from "@/lib/payments/ozow";

describe("Ozow helpers", () => {
  beforeEach(() => {
    process.env.OZOW_PRIVATE_KEY = "test-private-key";
    process.env.OZOW_SITE_CODE = "TSTSTE0001";
  });

  it("formats cents as Ozow two-decimal rand", () => {
    expect(formatOzowAmount(10000)).toBe("100.00");
    expect(formatOzowAmount(10055)).toBe("100.55");
  });

  it("builds a request hash matching Ozow's lowercase SHA512 rules", () => {
    const privateKey = "secret";
    const fields = {
      siteCode: "TSTSTE0001",
      countryCode: "ZA",
      currencyCode: "ZAR",
      amount: "25.00",
      transactionReference: "123",
      bankReference: "ABC123",
      cancelUrl: "http://demo.ozow.com/cancel.aspx",
      errorUrl: "http://demo.ozow.com/error.aspx",
      successUrl: "http://demo.ozow.com/success.aspx",
      notifyUrl: "http://demo.ozow.com/notify.aspx",
      isTest: false,
    };
    const expected = createHash("sha512")
      .update(
        `${fields.siteCode}${fields.countryCode}${fields.currencyCode}${fields.amount}${fields.transactionReference}${fields.bankReference}${fields.cancelUrl}${fields.errorUrl}${fields.successUrl}${fields.notifyUrl}false${privateKey}`.toLowerCase()
      )
      .digest("hex");
    expect(buildOzowRequestHash(fields, privateKey)).toBe(expected);
  });

  it("verifies a notification hash and rejects a tampered amount", () => {
    const privateKey = "test-private-key";
    const notification = {
      SiteCode: "TSTSTE0001",
      TransactionId: "33857766-f29a-4a3a-a37e-66db3c42e439",
      TransactionReference: "ORDER-001",
      Amount: "100.55",
      Status: "Complete",
      Optional1: "SC-1",
      Optional2: "DEPOSIT",
      Optional3: "",
      Optional4: "",
      Optional5: "",
      CurrencyCode: "ZAR",
      IsTest: "True",
      StatusMessage: "",
      Hash: "",
    };
    notification.Hash = buildOzowNotificationHash(notification, privateKey);
    expect(verifyOzowNotificationHash(notification, privateKey)).toBe(true);

    const tampered = { ...notification, Amount: "1.00" };
    expect(verifyOzowNotificationHash(tampered, privateKey)).toBe(false);
  });
});
