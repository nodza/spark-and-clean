"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CallAction,
  driverProfileHref,
} from "@/components/admin/CallAction";
import { InactiveDriverBadge } from "@/components/admin/InactiveDriverBadge";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import { BookingsFilterPanel } from "@/components/admin/BookingsFilterPanel";
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
  countBookingsByStatus,
  EMPTY_BOOKING_FILTERS,
  parseBookingListQuery,
  type AdminBookingFilters,
} from "@/lib/adminBookingQuery";
import { isUnassignedDriver } from "@/lib/bookingAttention";
import {
  applyListPaginationParams,
  DEFAULT_LIST_PAGINATION,
  paginateList,
  parseListPagination,
  type ListPagination,
  type PageSize,
} from "@/lib/listPagination";
import { useBookingStore } from "@/store/useBookingStore";
import type { Booking, Driver } from "@/types/booking";
import { formatAssignedDriverLine } from "@/lib/vehicle";

const TABLE_COLS =
  "minmax(150px, 1.1fr) minmax(160px, 1.6fr) minmax(64px, 0.45fr) minmax(92px, 0.7fr) minmax(118px, 0.85fr) minmax(78px, 0.55fr) minmax(92px, 0.65fr)";

function formatRand(amount: number) {
  const rounded = Math.round(amount);
  return `R${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
}

function bookingValue(booking: Booking) {
  return (booking.estimatedPriceMin + booking.estimatedPriceMax) / 2;
}

function collectionLabel(booking: Booking) {
  const raw = booking.collectionDate;
  const day = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "";
  const date = day
    ? format(parseISO(day), "d MMM")
    : format(new Date(raw), "d MMM");
  const time = booking.collectionSlot === "MORNING" ? "09:00" : "14:00";
  return `${date} · ${time}`;
}

function clientAddressLine(booking: Booking) {
  const street = booking.addressLine1?.trim() || "";
  const city = booking.city?.trim() || "";
  if (street && city) return `${street}, ${city}`;
  return street || city || booking.suburb;
}

function bookingShareUrl(bookingId: string) {
  return new URL(`/admin/bookings/${bookingId}`, window.location.origin).href;
}

function CopyBookingLinkButton({ bookingId }: { bookingId: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(bookingShareUrl(bookingId));
      setCopied(true);
      toast.success("Booking link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <button
      type="button"
      aria-label={`Copy link to booking ${bookingId}`}
      title="Copy booking link"
      className="relative z-[2] inline-flex size-7 flex-none items-center justify-center rounded-[7px] text-[#0a7a63] transition-colors hover:bg-[#eafaf5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000b49]"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation();
        void copyLink();
      }}
    >
      {copied ? (
        <Check size={13} strokeWidth={2.4} aria-hidden />
      ) : (
        <Copy size={13} strokeWidth={2.2} aria-hidden />
      )}
    </button>
  );
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
  const { bookings, fetchBookings, isLoading, error } = useBookingStore();
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const filters = useMemo(
    () => parseBookingListQuery(searchParams),
    [searchParams]
  );
  const pagination = useMemo(
    () => parseListPagination(searchParams),
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
    return (id?: string) => {
      if (isUnassignedDriver(id)) return "Unassigned";
      return (id && map.get(id)) || null;
    };
  }, [drivers]);

  const driverVehicle = useMemo(() => {
    const map = new Map(drivers.map((d) => [d.id, d.vehicle]));
    return (id?: string) => (id ? map.get(id) : undefined);
  }, [drivers]);

  const isKnownDriver = useMemo(() => {
    const ids = new Set(drivers.map((d) => d.id));
    return (id?: string) => Boolean(id && ids.has(id));
  }, [drivers]);

  const driverPhone = useMemo(() => {
    const map = new Map(
      drivers.map((d) => [
        d.id,
        typeof d.phone === "string" && d.phone.trim() ? d.phone.trim() : undefined,
      ])
    );
    return (id?: string) => (id ? map.get(id) : undefined);
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
  const statusCounts = useMemo(
    () => countBookingsByStatus(bookings, filters),
    [bookings, filters]
  );

  const paged = useMemo(
    () => paginateList(rows, pagination),
    [rows, pagination]
  );
  const pageItems = paged.items;

  function writeListUrl(
    nextFilters: AdminBookingFilters,
    nextPagination: ListPagination
  ) {
    const params = bookingFiltersToSearchParams(nextFilters);
    applyListPaginationParams(params, nextPagination);
    const qs = params.toString();
    router.replace(qs ? `/admin/bookings?${qs}` : "/admin/bookings", {
      scroll: false,
    });
  }

  function replaceFilters(next: AdminBookingFilters) {
    writeListUrl(next, { page: 1, limit: pagination.limit });
  }

  function patchFilters(patch: Partial<AdminBookingFilters>) {
    replaceFilters({ ...filters, ...patch });
  }

  function setPage(page: number) {
    writeListUrl(filters, { page, limit: pagination.limit });
  }

  function setLimit(limit: PageSize) {
    writeListUrl(filters, { page: 1, limit });
  }

  const highlightUnassigned = filters.assigned === "0";

  return (
    <AdminPortalShell
      pageTitle="Bookings"
      active="bookings"
      bookingsBadge={bookings.length || undefined}
      topbarActions={
        <AdminSearchTopbar
          searchValue={filters.q}
          onSearchChange={(q) => patchFilters({ q })}
          searchPlaceholder="Search by ID, name, phone, email, or address"
        />
      }
    >
      <div className="portal-page flex flex-col gap-[18px]">
        <BookingsFilterPanel
          filters={filters}
          matchedCount={rows.length}
          totalCount={bookings.length}
          statusCounts={statusCounts}
          cities={cities}
          suburbs={suburbs}
          onPatch={patchFilters}
          onClear={() =>
            writeListUrl({ ...EMPTY_BOOKING_FILTERS }, DEFAULT_LIST_PAGINATION)
          }
        />

        <div className="ds-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <div className="w-full">
              <div
                className="hidden px-[16px] py-[11px] lg:grid lg:items-center xl:px-[18px]"
                style={{
                  gridTemplateColumns: TABLE_COLS,
                  background: "#f7f9fb",
                  borderBottom: "1px solid #f0f2f6",
                  columnGap: 13,
                }}
              >
                {[
                  "REF",
                  "CLIENT",
                  "VALUE",
                  "COLLECTION",
                  "DRIVER",
                  "PAYMENT",
                  "STATUS",
                ].map((h) => (
                  <div key={h} className="text-th">
                    {h}
                  </div>
                ))}
              </div>

              {isLoading && bookings.length === 0 ? (
                <div
                  className="px-[22px] py-[48px] text-center text-meta"
                  style={{ color: "#9aa0a6" }}
                  role="status"
                >
                  Loading bookings…
                </div>
              ) : null}

              {error && bookings.length === 0 ? (
                <div
                  className="px-[22px] py-[48px] text-center text-meta"
                  style={{ color: "#b3261e" }}
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              {!isLoading && !error && bookings.length === 0 ? (
                <div
                  className="px-[22px] py-[48px] text-center text-meta"
                  style={{ color: "#9aa0a6" }}
                >
                  No bookings yet.
                </div>
              ) : null}

              {!isLoading && bookings.length > 0 && rows.length === 0 ? (
                <div
                  className="px-[22px] py-[48px] text-center text-meta"
                  style={{ color: "#9aa0a6" }}
                >
                  No bookings match these filters
                  {filters.q ? ` for “${filters.q}”` : ""}.
                </div>
              ) : null}

              {pageItems.map((booking) => {
                const unassigned = isUnassignedDriver(booking.assignedDriverId);
                const knownDriver = isKnownDriver(booking.assignedDriverId);
                const inactive = !unassigned && !knownDriver;
                const driverLabel = unassigned
                  ? "Unassigned"
                  : formatAssignedDriverLine(
                      driverName(booking.assignedDriverId) ?? "Assigned driver",
                      knownDriver
                        ? driverVehicle(booking.assignedDriverId)
                        : undefined
                    );
                return (
                  <div
                    key={booking.id}
                    className="group relative border-b border-[#f0f2f6] transition-colors duration-150 hover:bg-[#f7f9fb]"
                    style={{
                      background:
                        highlightUnassigned && unassigned
                          ? "rgba(255, 220, 57, 0.18)"
                          : undefined,
                    }}
                  >
                    <Link
                      href={`/admin/bookings/${booking.id}`}
                      className="absolute inset-0 z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#000b49]"
                      aria-label={`Open booking ${booking.id}`}
                    />
                    <div
                      className="flex w-full flex-col gap-3 px-[16px] py-[14px] sm:px-[18px] lg:grid lg:items-center lg:gap-0 lg:py-[16px]"
                      style={{
                        gridTemplateColumns: TABLE_COLS,
                        columnGap: 12,
                      }}
                    >
                    <div className="flex items-center justify-between gap-3 lg:contents">
                      <div className="flex min-w-0 items-center gap-[6px]">
                        <CopyBookingLinkButton bookingId={booking.id} />
                        <div
                          className="min-w-0 truncate text-[11px] font-bold leading-none tracking-[0.02em] tabular-nums underline-offset-2 group-hover:underline"
                          style={{ color: "#0a7a63" }}
                          title={booking.id}
                        >
                          {booking.id}
                        </div>
                      </div>
                      <div className="lg:hidden">
                        <Badge variant={bookingStatusVariant(booking.status)}>
                          {booking.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div
                        className="truncate text-[14px] font-bold leading-snug"
                        style={{ color: "#000b49" }}
                      >
                        {booking.customer.name}
                      </div>
                      {clientAddressLine(booking) ? (
                        <div
                          className="mt-[3px] truncate text-[12px] leading-snug"
                          style={{ color: "#9aa0a6" }}
                          title={clientAddressLine(booking)}
                        >
                          {clientAddressLine(booking)}
                        </div>
                      ) : null}
                    </div>

                    <div
                      className="text-[12px] font-semibold tabular-nums"
                      style={{ color: "#000b49" }}
                    >
                      {formatRand(bookingValue(booking))}
                    </div>

                    <div
                      className="truncate text-[12px] font-medium tabular-nums"
                      style={{ color: "#6b7280" }}
                      title={collectionLabel(booking)}
                    >
                      {collectionLabel(booking)}
                    </div>

                    <div
                      className="relative z-[2] flex min-w-0 flex-wrap items-center gap-1.5 text-[12px] font-medium"
                      style={{
                        color: unassigned
                          ? "#b3261e"
                          : inactive
                            ? "#b33232"
                            : "#6b7280",
                      }}
                      title={
                        inactive
                          ? "Assigned driver is inactive"
                          : driverLabel
                      }
                    >
                      {inactive ? (
                        <InactiveDriverBadge className="px-[8px] py-[3px] text-[10px]" />
                      ) : (
                        <>
                          <span className="min-w-0 truncate">{driverLabel}</span>
                          {!unassigned ? (
                            <CallAction
                              compact
                              label="Call driver"
                              phone={driverPhone(booking.assignedDriverId)}
                              disabledReason="No number on profile"
                              profileHref={
                                booking.assignedDriverId
                                  ? driverProfileHref(booking.assignedDriverId)
                                  : undefined
                              }
                            />
                          ) : null}
                        </>
                      )}
                    </div>

                    <div className="min-w-0">
                      <Badge
                        variant={paymentStatusVariant(booking.paymentStatus)}
                        className="px-[8px] py-[3px] text-[10px]"
                      >
                        {booking.paymentStatus}
                      </Badge>
                    </div>

                    <div className="hidden min-w-0 lg:block">
                      <Badge
                        variant={bookingStatusVariant(booking.status)}
                        className="px-[8px] py-[3px] text-[10px]"
                      >
                        {booking.status}
                      </Badge>
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <AdminListPagination
            total={paged.total}
            page={paged.page}
            limit={paged.limit}
            shownCount={pageItems.length}
            onPageChange={setPage}
            onLimitChange={setLimit}
            pageSizeLabel="Per page"
          />
        </div>
      </div>
    </AdminPortalShell>
  );
}
