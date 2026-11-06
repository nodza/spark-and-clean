import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  bookingAggregate: vi.fn(),
  paymentAggregate: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/Booking", () => ({
  Booking: { aggregate: mocks.bookingAggregate },
}));
vi.mock("@/models/Payment", () => ({
  Payment: { aggregate: mocks.paymentAggregate },
}));

import { getAdminMetrics, getAdminMetricsDateRange } from "./adminMetrics";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.bookingAggregate.mockResolvedValue([
    {
      summary: [
        {
          totalBookings: 4,
          deliveredBookings: 1,
          scheduledToday: 1,
          activeJobs: 2,
          unpaidBookings: 1,
          unassignedToday: 1,
        },
      ],
      todayJobs: [],
      recentBookings: [],
      readyNeedingDeliveryScheduleCount: [],
      readyNeedingDeliverySchedule: [],
      bookingsByArea: [],
      bookingsByType: [],
      driverPerformance: [],
    },
  ]);
  mocks.paymentAggregate.mockResolvedValue([
    {
      daily: [
        { _id: "2026-11-03", amountCents: 25000 },
        { _id: "2026-11-04", amountCents: 50000 },
      ],
      totals: [{ revenueCents: 150000 }],
      perBooking: [{ averagePaidCents: 75000 }],
    },
  ]);
});

describe("admin metrics", () => {
  it("uses South African calendar days and starts the week on Monday", () => {
    expect(getAdminMetricsDateRange(new Date("2026-11-04T12:00:00.000Z"))).toEqual({
      today: "2026-11-04",
      weekStart: "2026-11-02",
      firstTrendDay: "2026-10-06",
      tomorrow: "2026-11-05",
    });
  });

  it("returns payment-ledger revenue and server-aggregated booking totals", async () => {
    const metrics = await getAdminMetrics(new Date("2026-11-04T12:00:00.000Z"));

    expect(metrics).toMatchObject({
      totalBookings: 4,
      completionRatePercent: 25,
      scheduledToday: 1,
      activeJobs: 2,
      unpaidBookings: 1,
      unassignedToday: 1,
      revenueThisWeekCents: 75000,
      totalRevenueCents: 150000,
      averagePaidPerBookingCents: 75000,
    });
    expect(metrics.revenueByDay).toHaveLength(30);
    expect(metrics.revenueByDay.at(-1)).toEqual({
      date: "2026-11-04",
      amountCents: 50000,
    });

    const paymentPipeline = mocks.paymentAggregate.mock.calls[0][0];
    expect(paymentPipeline[0].$match).toMatchObject({
      status: "SUCCEEDED",
      currency: "ZAR",
      kind: { $in: ["DEPOSIT", "BALANCE", "REFUND"] },
    });
    expect(paymentPipeline[1].$addFields.signedAmountCents).toEqual({
      $multiply: [
        "$amountCents",
        { $cond: [{ $eq: ["$kind", "REFUND"] }, -1, 1] },
      ],
    });
  });

  it("counts active BOOKED and SCHEDULED jobs for today and keeps active job statuses focused on in-cleaning states", async () => {
    await getAdminMetrics(new Date("2026-11-04T12:00:00.000Z"));

    const bookingPipeline = mocks.bookingAggregate.mock.calls[0][0];
    const summaryFields = bookingPipeline[2].$facet.summary[0].$group;

    expect(summaryFields.scheduledToday.$sum.$cond[0].$and[2]).toEqual({
      $in: ["$status", ["BOOKED", "SCHEDULED"]],
    });
    expect(summaryFields.activeJobs.$sum.$cond[0].$and[1]).toEqual({
      $in: ["$status", ["COLLECTED", "CLEANING", "DRYING", "READY"]],
    });
  });

  it("returns active READY bookings that still need a delivery schedule", async () => {
    mocks.bookingAggregate.mockResolvedValue([
      {
        summary: [],
        todayJobs: [],
        recentBookings: [],
        readyNeedingDeliveryScheduleCount: [{ count: 6 }],
        readyNeedingDeliverySchedule: [
          { id: "BK-1", customer: { name: "Customer" } },
        ],
        bookingsByArea: [],
        bookingsByType: [],
        driverPerformance: [],
      },
    ]);

    const metrics = await getAdminMetrics(new Date("2026-11-04T12:00:00.000Z"));

    expect(metrics.readyNeedingDeliveryScheduleCount).toBe(6);
    expect(metrics.readyNeedingDeliverySchedule).toEqual([
      { id: "BK-1", customer: { name: "Customer" } },
    ]);
    const bookingPipeline = mocks.bookingAggregate.mock.calls[0][0];
    expect(bookingPipeline[2].$facet.readyNeedingDeliverySchedule[0].$match).toMatchObject({
      deactivatedAt: null,
      status: "READY",
    });
  });
});
