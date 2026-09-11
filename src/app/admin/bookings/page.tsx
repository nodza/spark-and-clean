"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useBookingStore } from "@/store/useBookingStore";
import { Badge } from "@/components/ui/badge";
import type { Booking, BookingStatus } from "@/types/booking";
import {
  AdminPortalShell,
  AdminSearchTopbar,
} from "@/components/admin/AdminPortalShell";
import { cn } from "@/lib/utils";

/** SA-style currency: R1 640 */
function formatRand(amount: number) {
  const rounded = Math.round(amount);
  return `R${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
}

function collectionLabel(booking: Booking) {
  const date = format(new Date(booking.collectionDate), "d MMM");
  const time = booking.collectionSlot === "MORNING" ? "09:00" : "14:00";
  return `${date} · ${time}`;
}

function statusDisplay(status: BookingStatus): {
  label: string;
  variant: React.ComponentProps<typeof Badge>["variant"];
} {
  switch (status) {
    case "BOOKED":
    case "SCHEDULED":
      return { label: "NEW", variant: "status-new" };
    case "CLEANING":
    case "DRYING":
      return { label: "IN CLEANING", variant: "status-cleaning" };
    case "COLLECTED":
      return { label: "COLLECTED", variant: "status-collected" };
    case "READY":
      return { label: "DELIVERY", variant: "status-delivering" };
    case "DELIVERED":
      return { label: "COMPLETED", variant: "status-completed" };
    case "CANCELLED":
      return { label: "CANCELLED", variant: "status-overdue" };
    default:
      return { label: status, variant: "outline" };
  }
}

function bookingValue(booking: Booking) {
  return (booking.estimatedPriceMin + booking.estimatedPriceMax) / 2;
}

/** Street + city only under the client name. */
function clientAddressLine(booking: Booking) {
  const street = booking.addressLine1?.trim() || "";
  const city = booking.city?.trim() || "";
  if (street && city) return `${street}, ${city}`;
  return street || city;
}

type StatusFilter =
  | "ALL"
  | "NEW"
  | "COLLECTED"
  | "IN_CLEANING"
  | "DELIVERY"
  | "COMPLETED"
  | "CANCELLED";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "NEW", label: "New" },
  { key: "COLLECTED", label: "Collected" },
  { key: "IN_CLEANING", label: "In cleaning" },
  { key: "DELIVERY", label: "Delivery" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

function matchesStatus(status: BookingStatus, filter: StatusFilter) {
  if (filter === "ALL") return true;
  if (filter === "NEW") return status === "BOOKED" || status === "SCHEDULED";
  if (filter === "COLLECTED") return status === "COLLECTED";
  if (filter === "IN_CLEANING")
    return status === "CLEANING" || status === "DRYING";
  if (filter === "DELIVERY") return status === "READY";
  if (filter === "COMPLETED") return status === "DELIVERED";
  if (filter === "CANCELLED") return status === "CANCELLED";
  return true;
}

function matchesSearch(booking: Booking, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    booking.id,
    booking.customer.name,
    booking.customer.phone,
    booking.customer.email,
    booking.suburb,
    booking.city,
    booking.addressLine1,
    statusDisplay(booking.status).label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

const TABLE_COLS =
  "minmax(148px, 180px) minmax(200px, 2fr) minmax(120px, 0.85fr) minmax(88px, 0.6fr) minmax(118px, 0.8fr)";

function PaginationButton({
  ariaLabel,
  disabled,
  onClick,
  children,
}: {
  ariaLabel: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-[9px] transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000b49]",
        disabled
          ? "cursor-not-allowed text-[#c5cad3]"
          : "text-[#000b49] hover:bg-[#f0f2f6] active:bg-[#e8ebf0]"
      )}
    >
      {children}
    </button>
  );
}

export default function AdminBookingsPage() {
  const router = useRouter();
  const { bookings, fetchBookings, isLoading, error } = useBookingStore();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, pageSize]);

  const filtered = useMemo(
    () =>
      bookings.filter(
        (b) => matchesStatus(b.status, statusFilter) && matchesSearch(b, search)
      ),
    [bookings, statusFilter, search]
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const showingCount = pageItems.length;

  const filterCounts = useMemo(() => {
    const searched = bookings.filter((b) => matchesSearch(b, search));
    const counts: Record<StatusFilter, number> = {
      ALL: searched.length,
      NEW: 0,
      COLLECTED: 0,
      IN_CLEANING: 0,
      DELIVERY: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const b of searched) {
      if (b.status === "BOOKED" || b.status === "SCHEDULED") counts.NEW += 1;
      else if (b.status === "COLLECTED") counts.COLLECTED += 1;
      else if (b.status === "CLEANING" || b.status === "DRYING")
        counts.IN_CLEANING += 1;
      else if (b.status === "READY") counts.DELIVERY += 1;
      else if (b.status === "DELIVERED") counts.COMPLETED += 1;
      else if (b.status === "CANCELLED") counts.CANCELLED += 1;
    }
    return counts;
  }, [bookings, search]);

  return (
    <AdminPortalShell
      pageTitle="Bookings"
      active="bookings"
      bookingsBadge={bookings.length || undefined}
      topbarActions={
        <AdminSearchTopbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search bookings, clients"
        />
      }
    >
      <div className="portal-page flex flex-col gap-[18px]">
        <div>
          <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>
            ALL JOBS
          </div>
          <p className="text-meta mt-[6px]" style={{ color: "#9aa0a6" }}>
            Filter and open a booking to update status or assignment.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div
            className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Filter by status"
          >
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.key;
              const count = filterCounts[f.key];
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-[14px] text-[13px] font-bold transition-colors",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000b49]",
                    active
                      ? "bg-[#000b49] text-white"
                      : "bg-white text-[#32373c] ring-1 ring-[#e3e7ed] hover:bg-[#f7f9fb]"
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      "rounded-full px-[7px] py-[2px] text-[11px] font-extrabold tabular-nums",
                      active
                        ? "bg-white/15 text-white"
                        : "bg-[#f0f2f6] text-[#6b7280]"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="ds-card overflow-hidden p-0">
          <div
            className="hidden px-[22px] py-[13px] lg:grid lg:items-center"
            style={{
              gridTemplateColumns: TABLE_COLS,
              background: "#f7f9fb",
              borderBottom: "1px solid #f0f2f6",
              columnGap: 20,
            }}
          >
            {["REF", "CLIENT", "COLLECTION", "VALUE", "STATUS"].map((h) => (
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

          {!isLoading && bookings.length > 0 && total === 0 ? (
            <div
              className="px-[22px] py-[48px] text-center text-meta"
              style={{ color: "#9aa0a6" }}
            >
              No bookings match your filters
              {search.trim() ? ` for “${search.trim()}”` : ""}.
              <button
                type="button"
                className="mt-3 block w-full text-[13px] font-bold text-[#0a7a63] hover:text-[#000b49]"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : null}

          {pageItems.map((booking) => {
            const status = statusDisplay(booking.status);
            return (
              <button
                key={booking.id}
                type="button"
                onClick={() => router.push(`/admin/bookings/${booking.id}`)}
                className="flex w-full cursor-pointer flex-col gap-3 border-b border-[#f0f2f6] px-[18px] py-[16px] text-left transition-colors duration-150 hover:bg-[#f7f9fb] focus-visible:bg-[#f7f9fb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#000b49] sm:px-[22px] lg:grid lg:items-center lg:gap-0 lg:py-[18px]"
                style={{
                  gridTemplateColumns: TABLE_COLS,
                  columnGap: 20,
                }}
              >
                <div className="flex items-center justify-between gap-3 lg:contents">
                  <div
                    className="min-w-0 truncate text-[11px] font-bold leading-none tracking-[0.02em] tabular-nums"
                    style={{ color: "#0a7a63" }}
                    title={booking.id}
                  >
                    {booking.id}
                  </div>
                  <div className="lg:hidden">
                    <Badge variant={status.variant}>{status.label}</Badge>
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
                  className="text-[13px] font-medium"
                  style={{ color: "#6b7280" }}
                >
                  <span className="mr-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9aa0a6] lg:hidden">
                    Collection
                  </span>
                  {collectionLabel(booking)}
                </div>

                <div
                  className="text-[14px] font-extrabold tabular-nums"
                  style={{ color: "#000b49" }}
                >
                  <span className="mr-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9aa0a6] lg:hidden">
                    Value
                  </span>
                  {formatRand(bookingValue(booking))}
                </div>

                <div className="hidden lg:block">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
              </button>
            );
          })}

          {total > 0 ? (
            <div
              className="flex flex-col gap-3 px-[16px] py-[14px] sm:px-[22px] lg:grid lg:items-center"
              style={{
                gridTemplateColumns: "1fr auto 1fr",
                borderTop: "1px solid #f0f2f6",
                background: "#fbfcfd",
              }}
            >
              <p
                className="text-[13px] font-medium tabular-nums lg:justify-self-start"
                style={{ color: "#6b7280" }}
                aria-live="polite"
              >
                Showing{" "}
                <span className="font-bold text-[#000b49]">{showingCount}</span>{" "}
                of <span className="font-bold text-[#000b49]">{total}</span>
              </p>

              <div
                className="flex items-center justify-center gap-1"
                role="navigation"
                aria-label="Pagination"
              >
                <PaginationButton
                  ariaLabel="First page"
                  disabled={safePage <= 1}
                  onClick={() => setPage(1)}
                >
                  <ChevronsLeft size={16} strokeWidth={2.2} />
                </PaginationButton>
                <PaginationButton
                  ariaLabel="Previous page"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} strokeWidth={2.2} />
                </PaginationButton>
                <span
                  className="mx-2 min-w-[4.5rem] text-center text-[12px] font-bold tabular-nums"
                  style={{ color: "#000b49" }}
                >
                  {safePage} / {totalPages}
                </span>
                <PaginationButton
                  ariaLabel="Next page"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight size={16} strokeWidth={2.2} />
                </PaginationButton>
                <PaginationButton
                  ariaLabel="Last page"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  <ChevronsRight size={16} strokeWidth={2.2} />
                </PaginationButton>
              </div>

              <label className="flex items-center justify-end gap-2 lg:justify-self-end">
                <span
                  className="hidden text-[12px] font-semibold sm:inline"
                  style={{ color: "#9aa0a6" }}
                >
                  Per page
                </span>
                <select
                  value={pageSize}
                  onChange={(e) =>
                    setPageSize(
                      Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]
                    )
                  }
                  aria-label="Bookings per page"
                  className="min-h-10 rounded-[9px] border border-[#e3e7ed] bg-white px-3 text-[13px] font-bold text-[#000b49] outline-none transition-shadow focus:border-[#6cf3d5] focus:shadow-[0_0_0_3px_rgba(108,243,213,0.25)]"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>
      </div>
    </AdminPortalShell>
  );
}
