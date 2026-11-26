import { describe, expect, it } from "vitest";
import {
  nextCustomerEmailRun,
  shouldRunCustomerEmailsOnBoot,
} from "@/lib/email/customerEmailSchedule";

describe("customer email clock", () => {
  it("runs at 08:00 Africa/Johannesburg", () => {
    expect(nextCustomerEmailRun(new Date("2026-11-17T05:30:00.000Z")).toISOString()).toBe(
      "2026-11-17T06:00:00.000Z"
    );
    expect(nextCustomerEmailRun(new Date("2026-11-17T06:00:00.000Z")).toISOString()).toBe(
      "2026-11-18T06:00:00.000Z"
    );
    expect(shouldRunCustomerEmailsOnBoot(new Date("2026-11-17T06:05:00.000Z"))).toBe(
      true
    );
    expect(shouldRunCustomerEmailsOnBoot(new Date("2026-11-17T06:20:00.000Z"))).toBe(
      false
    );
  });
});
