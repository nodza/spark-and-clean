"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AdminPortalShell,
  AdminSearchTopbar,
} from "@/components/admin/AdminPortalShell";
import {
  bookingStatusVariant,
  paymentStatusVariant,
} from "@/components/admin/bookingBadges";
import {
  applyBookingListQuery,
  bookingFiltersToSearchParams,
  EMPTY_BOOKING_FILTERS,
  parseBookingListQuery,
  type AdminBookingFilters,
  type BookingListSort,
} from "@/lib/adminBookingQuery";
import { BOOKING_STATUSES } from "@/lib/bookingPatchFields";
import { useBookingStore } from "@/store/useBookingStore";
import type { Driver } from "@/types/booking";

const STATUS_OPTIONS = BOOKING_STATUSES;

const PAYMENT_OPTIONS = ["UNPAID", "DEPOSIT", "PAID"] as const;

const GRID =
  "120px minmax(140px,1.3fr) 110px 100px 110px 90px minmax(110px,1fr) 150px";

const selectClass =
  "w-full rounded-[10px] border-[1.5px] border-[#dfe2e7] bg-white px-[12px] py-[11px] text-[13.5px] text-[#32373c] outline-none focus:border-[#6cf3d5] focus:shadow-[0_0_0_3px_rgba(108,243,213,0.25)]";

function formatCollection(value: string) {
  const day = /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
  if (!day) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return format(parsed, "MMM d");
  }
  return format(parseISO(day), "MMM d");
}

export default function AdminBookingsPage() {
  return (
    <Suspense fallback={<BookingsShellFallback />}>
      <AdminBookingsList />
    </Suspense>
  );
}

function BookingsShellFallback() {
  return (
    <AdminPortalShell
      pageTitle="Bookings"
      active="bookings"
      topbarActions={<AdminSearchTopbar />}
    >
      <div className="portal-page text-meta" style={{ color: "#9aa0a6" }}>
        Loading bookings…
      </div>
    </AdminPortalShell>
  );
}

function AdminBookingsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { bookings, fetchBookings, isLoading } = useBookingStore();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [copiedBookingId, setCopiedBookingId] = useState<string | null>(null);

  const filters = useMemo(
    () => parseBookingListQuery(searchParams),
    [searchParams]
  );

  useEffect(() => {
    void fetchBookings();
    void fetch("/api/drivers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDrivers(data);
      })
      .catch(() => setDrivers([]));
  }, [fetchBookings]);

  const driverName = useMemo(() => {
    const map = new Map(drivers.map((d) => [d.id, d.name]));
    return (id?: string) => (id ? map.get(id) || id : "Unassigned");
  }, [drivers]);

  const suburbs = useMemo(
    () => [...new Set(bookings.map((b) => b.suburb))].sort((a, b) => a.localeCompare(b)),
    [bookings]
  );
  const cities = useMemo(
    () => [...new Set(bookings.map((b) => b.city))].sort((a, b) => a.localeCompare(b)),
    [bookings]
  );

  const rows = useMemo(
    () => applyBookingListQuery(bookings, filters),
    [bookings, filters]
  );

  function replaceFilters(next: AdminBookingFilters) {
    const qs = bookingFiltersToSearchParams(next).toString();
    router.replace(qs ? `/admin/bookings?${qs}` : "/admin/bookings", {
      scroll: false,
    });
  }

  function patchFilters(patch: Partial<AdminBookingFilters>) {
    replaceFilters({ ...filters, ...patch });
  }

  function setSort(sort: BookingListSort) {
    patchFilters({ sort });
  }

  async function copyBookingLink(id: string) {
    const url = `${window.location.origin}/admin/bookings/${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this booking link", url);
      return;
    }
    setCopiedBookingId(id);
    window.setTimeout(() => setCopiedBookingId(null), 2000);
  }

  return (
    <AdminPortalShell
      pageTitle="Bookings"
      active="bookings"
      bookingsBadge={bookings.length || undefined}
      topbarActions={
        <AdminSearchTopbar
          value={filters.q}
          onChange={(q) => patchFilters({ q })}
        />
      }
    >
      <div className="portal-page flex flex-col gap-[18px]">
        <div className="ds-card">
          <div className="flex flex-wrap items-start justify-between gap-[12px]">
            <div>
              <div className="text-card-title" style={{ color: "#000b49" }}>
                All bookings
              </div>
              <p className="text-meta mt-[6px]" style={{ color: "#9aa0a6" }}>
                Default sort is newest created. Toggle to soonest collection for
                the next pickups.
              </p>
            </div>
            <div className="flex flex-wrap gap-[8px]">
              <button
                type="button"
                className={filters.sort === "created" ? "ds-text-action" : "text-meta"}
                style={{
                  color: filters.sort === "created" ? undefined : "#9aa0a6",
                  fontWeight: 800,
                }}
                onClick={() => setSort("created")}
              >
                Newest created
              </button>
              <span className="text-meta" style={{ color: "#dfe2e7" }}>
                |
              </span>
              <button
                type="button"
                className={
                  filters.sort === "collection" ? "ds-text-action" : "text-meta"
                }
                style={{
                  color: filters.sort === "collection" ? undefined : "#9aa0a6",
                  fontWeight: 800,
                }}
                onClick={() => setSort("collection")}
              >
                Soonest collection
              </button>
            </div>
          </div>

          <div className="mt-[16px] grid gap-[12px] sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-[7px] sm:col-span-2">
              <span className="text-eyebrow" style={{ color: "#6b7280" }}>
                SEARCH
              </span>
              <Input
                value={filters.q}
                placeholder="ID, name, phone, or email"
                onChange={(e) => patchFilters({ q: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-[7px]">
              <span className="text-eyebrow" style={{ color: "#6b7280" }}>
                STATUS
              </span>
              <select
                className={selectClass}
                value={filters.status}
                onChange={(e) => patchFilters({ status: e.target.value })}
              >
                <option value="">All</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-[7px]">
              <span className="text-eyebrow" style={{ color: "#6b7280" }}>
                PAYMENT
              </span>
              <select
                className={selectClass}
                value={filters.payment}
                onChange={(e) => patchFilters({ payment: e.target.value })}
              >
                <option value="">All</option>
                {PAYMENT_OPTIONS.map((payment) => (
                  <option key={payment} value={payment}>
                    {payment}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-[7px]">
              <span className="text-eyebrow" style={{ color: "#6b7280" }}>
                ASSIGNED
              </span>
              <select
                className={selectClass}
                value={filters.assigned}
                onChange={(e) =>
                  patchFilters({
                    assigned: e.target.value as AdminBookingFilters["assigned"],
                  })
                }
              >
                <option value="">All</option>
                <option value="1">Assigned</option>
                <option value="0">Unassigned</option>
              </select>
            </label>
            <label className="flex flex-col gap-[7px]">
              <span className="text-eyebrow" style={{ color: "#6b7280" }}>
                SUBURB
              </span>
              <select
                className={selectClass}
                value={filters.suburb}
                onChange={(e) => patchFilters({ suburb: e.target.value })}
              >
                <option value="">All</option>
                {suburbs.map((suburb) => (
                  <option key={suburb} value={suburb}>
                    {suburb}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-[7px]">
              <span className="text-eyebrow" style={{ color: "#6b7280" }}>
                CITY
              </span>
              <select
                className={selectClass}
                value={filters.city}
                onChange={(e) => patchFilters({ city: e.target.value })}
              >
                <option value="">All</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-[7px]">
              <span className="text-eyebrow" style={{ color: "#6b7280" }}>
                ON DATE
              </span>
              <Input
                type="date"
                value={filters.on}
                onChange={(e) =>
                  patchFilters({ on: e.target.value, from: "", to: "" })
                }
              />
            </label>
            <label className="flex flex-col gap-[7px]">
              <span className="text-eyebrow" style={{ color: "#6b7280" }}>
                FROM
              </span>
              <Input
                type="date"
                value={filters.from}
                disabled={Boolean(filters.on)}
                onChange={(e) => patchFilters({ from: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-[7px]">
              <span className="text-eyebrow" style={{ color: "#6b7280" }}>
                TO
              </span>
              <Input
                type="date"
                value={filters.to}
                disabled={Boolean(filters.on)}
                onChange={(e) => patchFilters({ to: e.target.value })}
              />
            </label>
          </div>

          <div className="mt-[14px] flex items-center justify-between">
            <div className="text-meta" style={{ color: "#9aa0a6" }}>
              {rows.length} of {bookings.length} bookings
            </div>
            <button
              type="button"
              className="ds-text-action"
              onClick={() => replaceFilters({ ...EMPTY_BOOKING_FILTERS })}
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="ds-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[860px] px-[22px] py-[14px]"
              style={{
                gridTemplateColumns: GRID,
                background: "#f7f9fb",
                borderBottom: "1px solid #f0f2f6",
              }}
            >
              {["ID", "Customer", "Area", "Date", "Status", "Payment", "Assigned", ""].map(
                (h) => (
                  <div key={h} className="text-th">
                    {h}
                  </div>
                )
              )}
            </div>
            {rows.map((booking) => (
              <div
                key={booking.id}
                className="grid min-w-[860px] cursor-pointer px-[22px] py-[14px] transition-colors duration-150 hover:bg-[#f7f9fb]"
                style={{
                  gridTemplateColumns: GRID,
                  borderBottom: "1px solid #f0f2f6",
                  alignItems: "center",
                }}
                onClick={() => router.push(`/admin/bookings/${booking.id}`)}
              >
                <div className="text-body tabular" style={{ color: "#000b49" }}>
                  {booking.id}
                </div>
                <div>
                  <div className="text-body truncate" style={{ color: "#000b49" }}>
                    {booking.customer.name}
                  </div>
                  <div className="text-meta mt-[2px] truncate" style={{ color: "#9aa0a6" }}>
                    {booking.customer.email}
                  </div>
                </div>
                <div>
                  <div className="text-body truncate" style={{ color: "#32373c" }}>
                    {booking.suburb}
                  </div>
                  <div className="text-meta" style={{ color: "#9aa0a6" }}>
                    {booking.city}
                  </div>
                </div>
                <div>
                  <div className="text-body" style={{ color: "#32373c" }}>
                    {formatCollection(booking.collectionDate)}
                  </div>
                  <div className="text-meta" style={{ color: "#9aa0a6" }}>
                    {booking.collectionSlot === "MORNING" ? "AM" : "PM"}
                  </div>
                </div>
                <div>
                  <Badge variant={bookingStatusVariant(booking.status)}>
                    {booking.status}
                  </Badge>
                </div>
                <div>
                  <Badge variant={paymentStatusVariant(booking.paymentStatus)}>
                    {booking.paymentStatus}
                  </Badge>
                </div>
                <div className="text-body truncate" style={{ color: "#32373c" }}>
                  {driverName(booking.assignedDriverId)}
                </div>
                <div className="flex justify-end gap-[12px]">
                  <button
                    type="button"
                    className="ds-text-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      void copyBookingLink(booking.id);
                    }}
                  >
                    {copiedBookingId === booking.id ? "Copied" : "Copy link"}
                  </button>
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="ds-text-action"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {isLoading && bookings.length === 0 && (
            <div className="px-[22px] py-[40px] text-center text-meta" style={{ color: "#9aa0a6" }}>
              Loading bookings…
            </div>
          )}
          {!isLoading && bookings.length === 0 && (
            <div className="px-[22px] py-[40px] text-center text-meta" style={{ color: "#9aa0a6" }}>
              No bookings yet.
            </div>
          )}
          {bookings.length > 0 && rows.length === 0 && (
            <div className="px-[22px] py-[40px] text-center text-meta" style={{ color: "#9aa0a6" }}>
              No bookings match these filters.
            </div>
          )}
        </div>
      </div>
    </AdminPortalShell>
  );
}
