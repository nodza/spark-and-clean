import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
  create: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/models/NotificationAttempt", () => ({
  NotificationAttempt: {
    findOne: mocks.findOne,
    findOneAndUpdate: mocks.findOneAndUpdate,
    updateOne: mocks.updateOne,
    create: mocks.create,
  },
}));

import { sendBookingStatus } from "@/lib/whatsapp/sendBookingStatus";

const booking = {
  id: "SC-2026-0042",
  customer: { phone: "082 000 0000" },
  status: "READY" as const,
};

function lookup(result: unknown = null) {
  return { lean: vi.fn().mockResolvedValue(result) };
}

function matches(row: Record<string, unknown>, filter: Record<string, unknown>) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = row[key];
    if (typeof expected === "object" && expected !== null) {
      const operators = expected as Record<string, unknown>;
      if ("$exists" in operators && (actual !== undefined) !== operators.$exists) {
        return false;
      }
      if ("$ne" in operators && actual === operators.$ne) return false;
      if (
        "$in" in operators &&
        !(operators.$in as unknown[]).includes(actual)
      ) {
        return false;
      }
      return true;
    }
    return actual === expected;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows.length = 0;
  vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "test-token");
  vi.stubEnv("WHATSAPP_TOKEN", "");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "phone-number-id");
  mocks.findOne.mockImplementation((filter: Record<string, unknown>) =>
    lookup(mocks.rows.find((row) => matches(row, filter)) ?? null)
  );
  mocks.findOneAndUpdate.mockImplementation(
    (filter: Record<string, unknown>, update: { $set: Record<string, unknown> }) => {
      const row = mocks.rows.find((candidate) => matches(candidate, filter));
      if (row) Object.assign(row, update.$set);
      return lookup(row ?? null);
    }
  );
  mocks.updateOne.mockImplementation(
    (filter: Record<string, unknown>, update: { $set: Record<string, unknown> }) => {
      const row = mocks.rows.find((candidate) => matches(candidate, filter));
      if (row) Object.assign(row, update.$set);
      return Promise.resolve({ matchedCount: row ? 1 : 0 });
    }
  );
  mocks.create.mockImplementation(async (attempt: Record<string, unknown>) => {
    if (
      attempt.claimKey &&
      mocks.rows.some((row) => row.claimKey === attempt.claimKey)
    ) {
      throw Object.assign(new Error("duplicate key"), { code: 11000 });
    }
    mocks.rows.push({ ...attempt });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendBookingStatus", () => {
  it.each([
    ["SCHEDULED", "booking_scheduled"],
    ["COLLECTED", "booking_collected"],
    ["READY", "booking_ready"],
    ["DELIVERED", "booking_delivered"],
  ] as const)("uses the %s utility template", async (status, templateName) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.template" }] }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendBookingStatus(booking, status);

    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request.template.name).toBe(templateName);
    expect(request.template.components[0].parameters[0].text).toBe(booking.id);
  });

  it("sends the READY template once and stores its provider message id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.123" }] }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await sendBookingStatus(booking, "READY");
    const second = await sendBookingStatus(booking, "READY");

    expect(first).toEqual({ result: "sent", providerMessageId: "wamid.123" });
    expect(second).toEqual({ result: "sent", providerMessageId: "wamid.123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: booking.id,
        status: "READY",
        phone: booking.customer.phone,
        claimState: "pending",
      })
    );
    expect(mocks.rows[0]).toEqual(
      expect.objectContaining({
        result: "sent",
        claimState: "complete",
        providerMessageId: "wamid.123",
      })
    );

    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request.to).toBe("27820000000");
    expect(request.template).toEqual(
      expect.objectContaining({
        name: "booking_ready",
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: booking.id }],
          },
        ],
      })
    );
  });

  it("does not resend after the delivery webhook updates the attempt result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.delivered" }] }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendBookingStatus(booking, "READY");
    mocks.rows[0].result = "delivered";

    const result = await sendBookingStatus(booking, "READY");

    expect(result).toEqual({
      result: "sent",
      providerMessageId: "wamid.delivered",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("allows only one Meta call when two sends overlap", async () => {
    let markFetchStarted!: () => void;
    let releaseFetch!: () => void;
    const fetchStarted = new Promise<void>((resolve) => {
      markFetchStarted = resolve;
    });
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          releaseFetch = () =>
            resolve(
              new Response(
                JSON.stringify({ messages: [{ id: "wamid.concurrent" }] }),
                { status: 200 }
              )
            );
          markFetchStarted();
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const firstPromise = sendBookingStatus(booking, "READY");
    await fetchStarted;
    const second = await sendBookingStatus(booking, "READY");
    releaseFetch();
    const first = await firstPromise;

    expect(first).toEqual({ result: "sent", providerMessageId: "wamid.concurrent" });
    expect(second).toEqual({ result: "skipped" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.rows).toHaveLength(1);
  });

  it.each(["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"] as const)(
    "records skipped when %s is missing without changing the booking",
    async (missingCredential) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv(missingCredential, "");
    const originalBooking = structuredClone(booking);

    const result = await sendBookingStatus(booking, "READY");

    expect(result).toEqual({ result: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: booking.id,
        status: "READY",
        result: "skipped",
      })
    );
    expect(booking).toEqual(originalBooking);
    }
  );

  it("continues to accept the legacy WHATSAPP_TOKEN variable", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
    vi.stubEnv("WHATSAPP_TOKEN", "legacy-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.legacy" }] }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendBookingStatus(booking, "READY");

    expect(result).toEqual({ result: "sent", providerMessageId: "wamid.legacy" });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer legacy-token"
    );
  });

  it("records skipped for a blank customer phone without calling Meta", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const bookingWithoutPhone = {
      ...booking,
      customer: { phone: "   " },
    };

    const result = await sendBookingStatus(bookingWithoutPhone, "READY");

    expect(result).toEqual({ result: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: booking.id,
        status: "READY",
        phone: "",
        result: "skipped",
      })
    );
  });

  it("records a failed Meta response and logs the status without exposing credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 190, error_subcode: 463 } }),
        { status: 401 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendBookingStatus(booking, "READY");

    expect(result).toEqual({ result: "failed" });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: booking.id,
        status: "READY",
        claimState: "pending",
      })
    );
    expect(mocks.rows[0]).toEqual(
      expect.objectContaining({ result: "failed", claimState: "complete" })
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "[whatsapp] Meta rejected booking status template",
      { httpStatus: 401, errorCode: 190, errorSubcode: 463 }
    );
    expect(errorSpy.mock.calls).not.toEqual(
      expect.arrayContaining([expect.arrayContaining(["test-token"])])
    );
  });
});