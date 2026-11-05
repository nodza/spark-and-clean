import { APP_TIMEZONE, localCalendarDate } from "@/lib/localCalendarDate";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Payment } from "@/models/Payment";

type DailyLedgerTotal = {
  _id: string;
  amountCents: number;
};

type LedgerMetrics = {
  daily: DailyLedgerTotal[];
  totals: { revenueCents: number }[];
  perBooking: { averagePaidCents: number | null }[];
};

type BookingMetrics = {
  summary: {
    totalBookings: number;
    deliveredBookings: number;
    scheduledToday: number;
    activeJobs: number;
    unpaidBookings: number;
    unassignedToday: number;
  }[];
  todayJobs: {
    id: string;
    collectionDate: string;
    collectionSlot: "MORNING" | "AFTERNOON";
    status: string;
    customer: { name: string };
    suburb: string;
    rug: { type: string };
    assignedDriverId?: string;
  }[];
  recentBookings: {
    id: string;
    customer: { name: string };
    suburb: string;
    collectionDate: string;
    collectionSlot: "MORNING" | "AFTERNOON";
    status: string;
  }[];
  bookingsByArea: { name: string; value: number }[];
  bookingsByType: { name: string; value: number }[];
  driverPerformance: {
    id: string;
    completed: number;
    active: number;
  }[];
};

function shiftCalendarDay(day: string, offset: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + offset));
  return shifted.toISOString().slice(0, 10);
}

function localDayStart(day: string): string {
  return new Date(`${day}T00:00:00+02:00`).toISOString();
}

export function getAdminMetricsDateRange(now: Date = new Date()) {
  const today = localCalendarDate(now);
  const weekday = new Date(`${today}T12:00:00.000Z`).getUTCDay();
  const weekStart = shiftCalendarDay(today, -((weekday + 6) % 7));
  const firstTrendDay = shiftCalendarDay(today, -29);

  return {
    today,
    weekStart,
    firstTrendDay,
    tomorrow: shiftCalendarDay(today, 1),
  };
}

export async function getAdminMetrics(now: Date = new Date()) {
  await connectDB();
  const range = getAdminMetricsDateRange(now);

  const [bookingMetricsRows, ledgerMetricsRows] = await Promise.all([
    Booking.aggregate<BookingMetrics>([
      {
        $addFields: {
          parsedCollectionDate: {
            $cond: [
              {
                $regexMatch: {
                  input: { $ifNull: ["$collectionDate", ""] },
                  regex: "^\\d{4}-\\d{2}-\\d{2}$",
                },
              },
              {
                $dateFromString: {
                  dateString: "$collectionDate",
                  timezone: APP_TIMEZONE,
                  onError: null,
                  onNull: null,
                },
              },
              {
                $dateFromString: {
                  dateString: "$collectionDate",
                  onError: null,
                  onNull: null,
                },
              },
            ],
          },
        },
      },
      {
        $addFields: {
          collectionDay: {
            $cond: [
              { $ne: ["$parsedCollectionDate", null] },
              {
                $dateToString: {
                  date: "$parsedCollectionDate",
                  format: "%Y-%m-%d",
                  timezone: APP_TIMEZONE,
                },
              },
              null,
            ],
          },
        },
      },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                deliveredBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0] },
                },
                scheduledToday: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          {
                            $eq: [
                              { $ifNull: ["$deactivatedAt", null] },
                              null,
                            ],
                          },
                          { $eq: ["$collectionDay", range.today] },
                          { $in: ["$status", ["BOOKED", "SCHEDULED"]] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                activeJobs: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          {
                            $eq: [
                              { $ifNull: ["$deactivatedAt", null] },
                              null,
                            ],
                          },
                          {
                            $in: [
                              "$status",
                              ["COLLECTED", "CLEANING", "DRYING", "READY"],
                            ],
                          },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                unpaidBookings: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          {
                            $eq: [
                              { $ifNull: ["$deactivatedAt", null] },
                              null,
                            ],
                          },
                          { $eq: ["$paymentStatus", "UNPAID"] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                unassignedToday: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          {
                            $eq: [
                              { $ifNull: ["$deactivatedAt", null] },
                              null,
                            ],
                          },
                          { $eq: ["$collectionDay", range.today] },
                          { $eq: [{ $ifNull: ["$assignedDriverId", ""] }, ""] },
                          {
                            $not: [
                              {
                                $in: ["$status", ["CANCELLED", "DELIVERED"]],
                              },
                            ],
                          },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
            { $project: { _id: 0 } },
          ],
          todayJobs: [
            {
              $match: {
                collectionDay: range.today,
                deactivatedAt: null,
                status: { $ne: "CANCELLED" },
              },
            },
            {
              $addFields: {
                collectionSlotOrder: {
                  $cond: [{ $eq: ["$collectionSlot", "MORNING"] }, 0, 1],
                },
              },
            },
            { $sort: { collectionSlotOrder: 1, id: 1 } },
            {
              $project: {
                _id: 0,
                id: 1,
                collectionDate: 1,
                collectionSlot: 1,
                status: 1,
                "customer.name": 1,
                suburb: 1,
                "rug.type": 1,
                assignedDriverId: 1,
              },
            },
          ],
          recentBookings: [
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
              $project: {
                _id: 0,
                id: 1,
                "customer.name": 1,
                suburb: 1,
                collectionDate: 1,
                collectionSlot: 1,
                status: 1,
              },
            },
          ],
          bookingsByArea: [
            { $group: { _id: "$suburb", value: { $sum: 1 } } },
            { $project: { _id: 0, name: "$_id", value: 1 } },
          ],
          bookingsByType: [
            { $group: { _id: "$rug.type", value: { $sum: 1 } } },
            { $project: { _id: 0, name: "$_id", value: 1 } },
          ],
          driverPerformance: [
            {
              $match: {
                assignedDriverId: { $exists: true, $nin: [null, ""] },
              },
            },
            {
              $group: {
                _id: "$assignedDriverId",
                completed: {
                  $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0] },
                },
                active: {
                  $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, 0, 1] },
                },
              },
            },
            {
              $project: {
                _id: 0,
                id: "$_id",
                completed: 1,
                active: 1,
              },
            },
          ],
        },
      },
    ]),
    Payment.aggregate<LedgerMetrics>([
      {
        $match: {
          status: "SUCCEEDED",
          currency: "ZAR",
          kind: { $in: ["DEPOSIT", "BALANCE", "REFUND"] },
        },
      },
      {
        $addFields: {
          signedAmountCents: {
            $multiply: [
              "$amountCents",
              { $cond: [{ $eq: ["$kind", "REFUND"] }, -1, 1] },
            ],
          },
        },
      },
      {
        $facet: {
          daily: [
            {
              $match: {
                createdAt: {
                  $gte: localDayStart(range.firstTrendDay),
                  $lt: localDayStart(range.tomorrow),
                },
              },
            },
            {
              $addFields: {
                paidAt: {
                  $dateFromString: {
                    dateString: "$createdAt",
                    onError: null,
                    onNull: null,
                  },
                },
              },
            },
            { $match: { paidAt: { $ne: null } } },
            {
              $group: {
                _id: {
                  $dateToString: {
                    date: "$paidAt",
                    format: "%Y-%m-%d",
                    timezone: APP_TIMEZONE,
                  },
                },
                amountCents: { $sum: "$signedAmountCents" },
              },
            },
          ],
          totals: [
            {
              $group: {
                _id: null,
                revenueCents: { $sum: "$signedAmountCents" },
              },
            },
            { $project: { _id: 0 } },
          ],
          perBooking: [
            {
              $group: {
                _id: "$bookingId",
                amountCents: { $sum: "$signedAmountCents" },
              },
            },
            {
              $group: {
                _id: null,
                averagePaidCents: { $avg: "$amountCents" },
              },
            },
            { $project: { _id: 0 } },
          ],
        },
      },
    ]),
  ]);

  const ledgerMetrics = ledgerMetricsRows[0];
  const totalsByDay = new Map(
    (ledgerMetrics?.daily ?? []).map((row) => [
      row._id,
      Number(row.amountCents) || 0,
    ])
  );
  const revenueByDay = Array.from({ length: 30 }, (_, index) => {
    const date = shiftCalendarDay(range.firstTrendDay, index);
    return { date, amountCents: totalsByDay.get(date) ?? 0 };
  });
  const revenueThisWeekCents = revenueByDay.reduce(
    (total, day) =>
      day.date >= range.weekStart && day.date <= range.today
        ? total + day.amountCents
        : total,
    0
  );
  const bookingMetrics = bookingMetricsRows[0];
  const counts = bookingMetrics?.summary[0] ?? {
    totalBookings: 0,
    deliveredBookings: 0,
    scheduledToday: 0,
    activeJobs: 0,
    unpaidBookings: 0,
    unassignedToday: 0,
  };

  return {
    totalBookings: counts.totalBookings,
    completionRatePercent: counts.totalBookings
      ? Math.round((counts.deliveredBookings / counts.totalBookings) * 100)
      : 0,
    scheduledToday: counts.scheduledToday,
    activeJobs: counts.activeJobs,
    unpaidBookings: counts.unpaidBookings,
    unassignedToday: counts.unassignedToday,
    todayJobs: bookingMetrics?.todayJobs ?? [],
    recentBookings: bookingMetrics?.recentBookings ?? [],
    bookingsByArea: bookingMetrics?.bookingsByArea ?? [],
    bookingsByType: bookingMetrics?.bookingsByType ?? [],
    driverPerformance: bookingMetrics?.driverPerformance ?? [],
    totalRevenueCents: ledgerMetrics?.totals[0]?.revenueCents ?? 0,
    averagePaidPerBookingCents:
      ledgerMetrics?.perBooking[0]?.averagePaidCents ?? 0,
    revenueThisWeekCents,
    revenueByDay,
  };
}
