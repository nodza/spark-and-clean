"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useBookingStore } from "@/store/useBookingStore";
import { Badge } from "@/components/ui/badge";
import {
  AdminPortalShell,
  AdminSearchTopbar,
} from "@/components/admin/AdminPortalShell";
import type { Booking } from "@/types/booking";
import {
  isBookingOnLocalDay,
  localCalendarDate,
} from "@/lib/localCalendarDate";
import {
  isExcludedFromUnassignedQueue,
  isUnassignedDriver,
} from "@/lib/bookingAttention";

const BOOKINGS_GRID =
  "110px 1fr 120px 110px 100px 100px 70px";

function statusVariant(
  status: string
): React.ComponentProps<typeof Badge>["variant"] {
  const s = status.toUpperCase();
  if (s === "BOOKED" || s === "SCHEDULED") return "status-new";
  if (s === "COLLECTED") return "status-collected";
  if (s === "CLEANING" || s === "DRYING" || s === "READY") return "status-cleaning";
  if (s === "DELIVERED") return "status-completed";
  return "outline";
}

function matchesFilters(
  b: Booking,
  opts: { payment: string | null; date: string | null; assigned: string | null }
) {
  if (opts.payment) {
    if (b.paymentStatus !== opts.payment.toUpperCase()) return false;
  }

  if (opts.date) {
    const day =
      opts.date === "today" ? localCalendarDate() : opts.date.slice(0, 10);
    if (!isBookingOnLocalDay(b.collectionDate, day)) return false;
  }

  if (opts.assigned === "0") {
    if (!isUnassignedDriver(b.assignedDriverId)) return false;
    if (isExcludedFromUnassignedQueue(b.status)) return false;
  } else if (opts.assigned && opts.assigned !== "0") {
    if (b.assignedDriverId !== opts.assigned) return false;
  }

  return true;
}

function filterLabel(opts: {
  payment: string | null;
  date: string | null;
  assigned: string | null;
}) {
  const parts: string[] = [];
  if (opts.payment) parts.push(`Payment: ${opts.payment}`);
  if (opts.date === "today") parts.push("Date: today");
  else if (opts.date) parts.push(`Date: ${opts.date}`);
  if (opts.assigned === "0") parts.push("Unassigned");
  else if (opts.assigned) parts.push(`Driver: ${opts.assigned}`);
  return parts.length ? parts.join(" · ") : "All bookings";
}

function BookingsListBody() {
  const searchParams = useSearchParams();
  const { bookings, fetchBookings, isLoading } = useBookingStore();
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});

  const payment = searchParams.get("payment");
  const date = searchParams.get("date");
  const assigned = searchParams.get("assigned");
  const highlightUnassigned = assigned === "0";

  useEffect(() => {
    void fetchBookings();
    void fetch("/api/drivers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const map: Record<string, string> = {};
        for (const d of data) {
          if (d && typeof d.id === "string") {
            map[d.id] = typeof d.name === "string" && d.name.trim() ? d.name : d.id;
          }
        }
        setDriverNames(map);
      })
      .catch(() => setDriverNames({}));
  }, [fetchBookings]);

  const filtered = useMemo(
    () => bookings.filter((b) => matchesFilters(b, { payment, date, assigned })),
    [bookings, payment, date, assigned]
  );

  return (
    <AdminPortalShell
      pageTitle="Bookings"
      active="bookings"
      bookingsBadge={filtered.length}
      topbarActions={<AdminSearchTopbar />}
    >
      <div className="portal-page flex flex-col gap-[18px]">
        <div className="ds-card p-0 overflow-hidden">
          <div className="ds-card-header">
            <div>
              <span className="text-card-title" style={{ color: "#000b49" }}>
                Bookings
              </span>
              <div className="text-meta mt-[4px]" style={{ color: "#9aa0a6" }}>
                {filterLabel({ payment, date, assigned })}
                {payment || date || assigned ? (
                  <>
                    {" · "}
                    <Link href="/admin/bookings" className="ds-text-action">
                      Clear filters
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
            <Link href="/admin" className="ds-text-action">
              ← Overview
            </Link>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div
                className="grid px-[22px] py-[14px]"
                style={{
                  gridTemplateColumns: BOOKINGS_GRID,
                  background: "#f7f9fb",
                  borderBottom: "1px solid #f0f2f6",
                }}
              >
                {["ID", "Customer", "Date", "Payment", "Status", "Driver", ""].map(
                  (h) => (
                    <div key={h || "actions"} className="text-th">
                      {h}
                    </div>
                  )
                )}
              </div>

              {isLoading && bookings.length === 0 ? (
                <div
                  className="px-[22px] py-[40px] text-center text-meta"
                  style={{ color: "#9aa0a6" }}
                >
                  Loading…
                </div>
              ) : null}

              {!isLoading && filtered.length === 0 ? (
                <div
                  className="px-[22px] py-[40px] text-center text-meta"
                  style={{ color: "#9aa0a6" }}
                >
                  No bookings match these filters.
                </div>
              ) : null}

              {filtered.map((booking) => {
                const unassigned = isUnassignedDriver(booking.assignedDriverId);
                const rowHighlight = highlightUnassigned && unassigned;
                const driverLabel = unassigned
                  ? "Unassigned"
                  : driverNames[booking.assignedDriverId ?? ""] ??
                    booking.assignedDriverId;
                return (
                  <Link
                    key={booking.id}
                    href={`/admin/bookings/${booking.id}`}
                    className="grid px-[22px] py-[14px] no-underline transition-colors duration-150 hover:bg-[#f7f9fb]"
                    style={{
                      gridTemplateColumns: BOOKINGS_GRID,
                      borderBottom: "1px solid #f0f2f6",
                      alignItems: "center",
                      background: rowHighlight
                        ? "rgba(255, 220, 57, 0.18)"
                        : undefined,
                    }}
                  >
                    <div className="text-body tabular" style={{ color: "#000b49" }}>
                      {booking.id}
                    </div>
                    <div>
                      <div
                        className="text-body truncate"
                        style={{ color: "#000b49" }}
                      >
                        {booking.customer.name}
                      </div>
                      <div className="text-meta mt-[2px]" style={{ color: "#9aa0a6" }}>
                        {booking.suburb}
                      </div>
                    </div>
                    <div>
                      <div className="text-body" style={{ color: "#32373c" }}>
                        {format(new Date(booking.collectionDate), "MMM d")}
                      </div>
                      <div className="text-meta" style={{ color: "#9aa0a6" }}>
                        {booking.collectionSlot === "MORNING" ? "AM" : "PM"}
                      </div>
                    </div>
                    <div>
                      <Badge
                        variant={
                          booking.paymentStatus === "UNPAID"
                            ? "status-overdue"
                            : "outline"
                        }
                      >
                        {booking.paymentStatus}
                      </Badge>
                    </div>
                    <div>
                      <Badge variant={statusVariant(booking.status)}>
                        {booking.status}
                      </Badge>
                    </div>
                    <div
                      className="text-meta"
                      style={{ color: unassigned ? "#b3261e" : "#9aa0a6" }}
                    >
                      {driverLabel}
                    </div>
                    <div className="flex justify-end">
                      <span className="ds-text-action">View →</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AdminPortalShell>
  );
}

export default function AdminBookingsPage() {
  return (
    <Suspense
      fallback={
        <AdminPortalShell pageTitle="Bookings" active="bookings">
          <div className="portal-page text-meta" style={{ color: "#9aa0a6" }}>
            Loading…
          </div>
        </AdminPortalShell>
      }
    >
      <BookingsListBody />
    </Suspense>
  );
}
