import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/models/NotificationAttempt", () => ({
  NotificationAttempt: {
    findOne: mocks.findOne,
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WHATSAPP_TOKEN", "test-token");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "phone-number-id");
  mocks.findOne.mockImplementation(() => lookup());
  mocks.create.mockResolvedValue(undefined);
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
    mocks.findOne
      .mockReturnValueOnce(lookup())
      .mockReturnValueOnce(lookup({ providerMessageId: "wamid.123" }));

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
        result: "sent",
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

  it.each(["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"] as const)(
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
});