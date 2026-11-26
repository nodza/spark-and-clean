import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  updateOne: vi.fn(),
  deliverEmail: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({ connectDB: vi.fn(async () => undefined) }));
vi.mock("@/models/EmailSendLog", () => ({
  EmailSendLog: {
    create: (doc: Record<string, unknown>) => mocks.create(doc),
    updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>) =>
      mocks.updateOne(filter, update),
  },
}));
vi.mock("@/lib/email/deliver", () => ({
  deliverEmail: (input: { to: string }) => mocks.deliverEmail(input),
}));

import { sendTransactionalEmail } from "@/lib/email/sendTransactionalEmail";
import type { TransactionalEmail } from "@/lib/email/layout";

const email: TransactionalEmail = {
  subject: "Your collection is booked — Tuesday 2 September",
  preheader: "SC-2418",
  eyebrow: "BOOKING CONFIRMED",
  heading: "You're booked in",
  intro: "We'll collect tomorrow.",
  cta: { label: "View my booking", href: "http://localhost:3000/booking/SC-2418" },
  footnote: "Call us.",
};

beforeEach(() => {
  mocks.create.mockReset();
  mocks.updateOne.mockReset();
  mocks.deliverEmail.mockReset();
  mocks.create.mockResolvedValue({});
  mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
  mocks.deliverEmail.mockResolvedValue("log");
});

describe("sendTransactionalEmail", () => {
  it("writes the email to the log when SMTP is not used", async () => {
    const result = await sendTransactionalEmail({
      dedupeKey: "booking:SC-2418:booking_confirmed",
      kind: "booking_confirmed",
      to: "Nomsa@Example.com",
      bookingId: "SC-2418",
      email,
    });

    expect(result).toBe("logged");
    expect(mocks.deliverEmail).toHaveBeenCalledTimes(1);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { dedupeKey: "booking:SC-2418:booking_confirmed" },
      { $set: { status: "logged" }, $unset: { error: "" } }
    );
  });

  it("does not send the same email twice", async () => {
    const duplicate = Object.assign(new Error("duplicate"), { code: 11000 });
    mocks.create.mockRejectedValueOnce(duplicate);

    const result = await sendTransactionalEmail({
      dedupeKey: "booking:SC-2418:delivered",
      kind: "delivered",
      to: "nomsa@example.com",
      bookingId: "SC-2418",
      email,
    });

    expect(result).toBe("skipped");
    expect(mocks.deliverEmail).not.toHaveBeenCalled();
  });

  it("records a failed send and does not throw", async () => {
    mocks.deliverEmail.mockRejectedValueOnce(new Error("mailbox full"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await sendTransactionalEmail({
      dedupeKey: "booking:SC-2418:out_for_delivery:2026-09-04",
      kind: "out_for_delivery",
      to: "nomsa@example.com",
      bookingId: "SC-2418",
      email,
    });

    expect(result).toBe("failed");
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { dedupeKey: "booking:SC-2418:out_for_delivery:2026-09-04" },
      { $set: { status: "failed", error: "mailbox full" } }
    );
    errorSpy.mockRestore();
  });

  it("still throws for password reset when delivery fails", async () => {
    mocks.deliverEmail.mockRejectedValueOnce(new Error("Email delivery is not configured"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      sendTransactionalEmail({
        dedupeKey: "password_reset:abc",
        kind: "password_reset",
        to: "nomsa@example.com",
        email,
        throwOnFailure: true,
      })
    ).rejects.toThrow("Email delivery is not configured");
    errorSpy.mockRestore();
  });
});
