"use client";

import { format, parseISO } from "date-fns";
import { Calendar, X } from "lucide-react";
import {
  EMPTY_BOOKING_FILTERS,
  type AdminBookingFilters,
  type BookingListSort,
} from "@/lib/adminBookingQuery";
import { BOOKING_STATUSES } from "@/lib/bookingPatchFields";
import type { BookingStatus } from "@/types/booking";
import { cn } from "@/lib/utils";

const PAYMENT_OPTIONS = ["UNPAID", "DEPOSIT", "PAID"] as const;

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function formatFilterDate(value: string) {
  const day = /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
  if (!day) return value;
  return format(parseISO(day), "dd MMM yyyy");
}

function statusDot(status: string): string {
  if (status === "BOOKED" || status === "SCHEDULED") return "#B08900";
  if (status === "COLLECTED" || status === "DELIVERED") return "#4B5262";
  if (status === "CANCELLED") return "#B4472A";
  return "#0F6E5F";
}

function assignedLabel(assigned: AdminBookingFilters["assigned"]) {
  if (assigned === "0") return "Unassigned";
  if (assigned === "1") return "Assigned";
  return "";
}

type ActiveChip = {
  key: string;
  label: string;
  clear: Partial<AdminBookingFilters>;
};

function activeFilterChips(filters: AdminBookingFilters): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (filters.q) {
    chips.push({ key: "q", label: `“${filters.q}”`, clear: { q: "" } });
  }
  if (filters.status) {
    chips.push({
      key: "status",
      label: `Status: ${titleCase(filters.status)}`,
      clear: { status: "" },
    });
  }
  if (filters.payment) {
    chips.push({
      key: "payment",
      label: `Payment: ${titleCase(filters.payment)}`,
      clear: { payment: "" },
    });
  }
  if (filters.assigned) {
    chips.push({
      key: "assigned",
      label: `Assigned: ${assignedLabel(filters.assigned)}`,
      clear: { assigned: "" },
    });
  }
  if (filters.city) {
    chips.push({
      key: "city",
      label: `City: ${filters.city}`,
      clear: { city: "" },
    });
  }
  if (filters.suburb) {
    chips.push({
      key: "suburb",
      label: `Suburb: ${filters.suburb}`,
      clear: { suburb: "" },
    });
  }
  if (filters.on) {
    chips.push({
      key: "on",
      label: `On ${formatFilterDate(filters.on)}`,
      clear: { on: "" },
    });
  }
  if (filters.from) {
    chips.push({
      key: "from",
      label: `From ${formatFilterDate(filters.from)}`,
      clear: { from: "" },
    });
  }
  if (filters.to) {
    chips.push({
      key: "to",
      label: `To ${formatFilterDate(filters.to)}`,
      clear: { to: "" },
    });
  }
  return chips;
}

const fieldLabelClass =
  "mb-[7px] block text-[11.5px] font-bold tracking-[0.02em] text-[#8A90A0]";

const controlClass =
  "h-[42px] w-full appearance-none rounded-[8px] border-[1.5px] bg-white pl-3 pr-9 text-[14px] text-[#171B24] outline-none transition-[border-color,box-shadow,background] hover:border-[#C7CAD2] focus:border-[#0F6E5F] focus:shadow-[0_0_0_4px_#E7F3F0] disabled:cursor-not-allowed disabled:bg-[#F5F6F8] disabled:text-[#8A90A0]";

function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  const filled = Boolean(value);
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={fieldLabelClass}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            controlClass,
            filled
              ? "border-[#0F6E5F] bg-[#E7F3F0] font-semibold text-[#0B5548]"
              : "border-[#E3E5EA]"
          )}
        >
          {children}
        </select>
        <span
          className="pointer-events-none absolute right-[13px] top-1/2 size-2 -translate-y-[65%] rotate-45 border-r-[1.5px] border-b-[1.5px] border-[#8A90A0]"
          aria-hidden
        />
      </div>
    </div>
  );
}

function FilterDate({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={fieldLabelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="date"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            controlClass,
            "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0",
            value
              ? "border-[#0F6E5F] bg-[#E7F3F0] font-semibold text-[#0B5548]"
              : "border-[#E3E5EA]"
          )}
          style={{ colorScheme: "light" }}
        />
        <Calendar
          size={16}
          strokeWidth={2}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A90A0]"
          aria-hidden
        />
      </div>
    </div>
  );
}

export function BookingsFilterPanel({
  filters,
  matchedCount,
  totalCount,
  statusCounts,
  cities,
  suburbs,
  onPatch,
  onClear,
}: {
  filters: AdminBookingFilters;
  matchedCount: number;
  totalCount: number;
  statusCounts: {
    all: number;
    byStatus: Record<BookingStatus, number>;
  };
  cities: string[];
  suburbs: string[];
  onPatch: (patch: Partial<AdminBookingFilters>) => void;
  onClear: () => void;
}) {
  const chips = activeFilterChips(filters);
  const hasFilters = chips.length > 0;

  function setSort(sort: BookingListSort) {
    onPatch({ sort });
  }

  return (
    <section
      className="rounded-[14px] border border-[#E3E5EA] bg-white px-7 pb-[22px] pt-7"
      style={{
        boxShadow:
          "0 1px 2px rgba(23,27,36,0.04), 0 8px 24px -12px rgba(23,27,36,0.10)",
      }}
    >
      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-[480px]">
          <h1 className="m-0 text-[20px] font-bold tracking-[-0.01em] text-[#171B24]">
            All bookings
          </h1>
          <p className="mt-1 mb-0 text-[13.5px] leading-normal text-[#8A90A0]">
            Default sort is newest created. Search by ID, name, phone or email
            in the top bar.
          </p>
        </div>
        <div
          className="inline-flex w-full flex-none rounded-full border border-[#E3E5EA] bg-[#F5F6F8] p-[3px] sm:w-auto"
          role="group"
          aria-label="Sort order"
        >
          <button
            type="button"
            onClick={() => setSort("created")}
            className={cn(
              "flex-1 rounded-full px-[14px] py-[7px] text-[13px] font-semibold whitespace-nowrap transition-colors sm:flex-none",
              filters.sort === "created"
                ? "bg-[#171B24] text-white"
                : "bg-transparent text-[#8A90A0] hover:text-[#171B24]"
            )}
          >
            Newest created
          </button>
          <button
            type="button"
            onClick={() => setSort("collection")}
            className={cn(
              "flex-1 rounded-full px-[14px] py-[7px] text-[13px] font-semibold whitespace-nowrap transition-colors sm:flex-none",
              filters.sort === "collection"
                ? "bg-[#171B24] text-white"
                : "bg-transparent text-[#8A90A0] hover:text-[#171B24]"
            )}
          >
            Soonest collection
          </button>
        </div>
      </div>

      <div className="mb-[9px] text-[11.5px] font-bold tracking-[0.02em] text-[#8A90A0]">
        Status
      </div>
      <div className="mb-[22px] flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={!filters.status}
          onClick={() => onPatch({ status: "" })}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-[14px] py-2 text-[13.5px] font-semibold transition-colors",
            !filters.status
              ? "border-[#0F6E5F] bg-[#E7F3F0] text-[#0B5548]"
              : "border-[#E3E5EA] bg-white text-[#4B5262] hover:border-[#C7CAD2] hover:bg-[#F5F6F8]"
          )}
        >
          All
          <span className="tabular-nums text-[12px] font-bold opacity-70">
            {statusCounts.all}
          </span>
        </button>
        {BOOKING_STATUSES.map((status) => {
          const selected = filters.status === status;
          const count = statusCounts.byStatus[status] ?? 0;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={selected}
              onClick={() => onPatch({ status })}
              className={cn(
                "inline-flex items-center gap-[7px] rounded-full border-[1.5px] px-[14px] py-2 text-[13.5px] font-semibold transition-colors",
                selected
                  ? "border-[#0F6E5F] bg-[#E7F3F0] text-[#0B5548]"
                  : "border-[#E3E5EA] bg-white text-[#4B5262] hover:border-[#C7CAD2] hover:bg-[#F5F6F8]",
                count === 0 && !selected ? "opacity-60" : ""
              )}
            >
              <span
                className="size-[7px] flex-none rounded-full"
                style={{
                  background: statusDot(status),
                  opacity: selected ? 1 : 0.55,
                }}
                aria-hidden
              />
              {titleCase(status)}
              <span className="tabular-nums text-[12px] font-bold opacity-70">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-[18px] grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          id="booking-filter-payment"
          label="Payment"
          value={filters.payment}
          onChange={(payment) => onPatch({ payment })}
        >
          <option value="">All</option>
          {PAYMENT_OPTIONS.map((payment) => (
            <option key={payment} value={payment}>
              {titleCase(payment)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          id="booking-filter-assigned"
          label="Assigned"
          value={filters.assigned}
          onChange={(assigned) =>
            onPatch({ assigned: assigned as AdminBookingFilters["assigned"] })
          }
        >
          <option value="">All</option>
          <option value="1">Assigned</option>
          <option value="0">Unassigned</option>
        </FilterSelect>
        <FilterSelect
          id="booking-filter-city"
          label="City"
          value={filters.city}
          onChange={(city) => onPatch({ city })}
        >
          <option value="">All</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          id="booking-filter-suburb"
          label="Suburb"
          value={filters.suburb}
          onChange={(suburb) => onPatch({ suburb })}
        >
          <option value="">All</option>
          {suburbs.map((suburb) => (
            <option key={suburb} value={suburb}>
              {suburb}
            </option>
          ))}
        </FilterSelect>
      </div>

      <div className="mb-[9px] text-[11.5px] font-bold tracking-[0.02em] text-[#8A90A0]">
        Collection date
      </div>
      <div className="mb-1 grid grid-cols-1 gap-[14px] sm:grid-cols-3">
        <FilterDate
          id="booking-filter-on"
          label="On date"
          value={filters.on}
          onChange={(on) => onPatch({ on, from: "", to: "" })}
        />
        <FilterDate
          id="booking-filter-from"
          label="From"
          value={filters.from}
          disabled={Boolean(filters.on)}
          onChange={(from) => onPatch({ from })}
        />
        <FilterDate
          id="booking-filter-to"
          label="To"
          value={filters.to}
          disabled={Boolean(filters.on)}
          onChange={(to) => onPatch({ to })}
        />
      </div>

      {hasFilters ? (
        <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-[#ECEDF1] pt-[14px]">
          <span className="mr-0.5 text-[12.5px] font-semibold text-[#8A90A0]">
            Active filters:
          </span>
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#171B24] py-[5px] pr-2 pl-[11px] text-[12.5px] font-semibold text-white"
            >
              {chip.label}
              <button
                type="button"
                aria-label={`Remove ${chip.label}`}
                className="inline-flex size-4 items-center justify-center rounded-full bg-white/18 text-[11px] leading-none hover:bg-white/32"
                onClick={() => onPatch(chip.clear)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-1 flex flex-col items-start justify-between gap-2.5 border-t border-[#ECEDF1] pt-[18px] sm:flex-row sm:items-center">
        <p className="m-0 text-[13.5px] text-[#4B5262]">
          <strong className="font-bold text-[#171B24]">{matchedCount}</strong> of{" "}
          {totalCount} bookings
        </p>
        <button
          type="button"
          disabled={!hasFilters}
          onClick={onClear}
          className={cn(
            "inline-flex items-center gap-1.5 border-0 bg-transparent p-[6px_4px] text-[13.5px] font-bold",
            hasFilters
              ? "cursor-pointer text-[#8A90A0] hover:text-[#B4472A]"
              : "cursor-default text-[#C7CAD2]"
          )}
        >
          <X size={14} strokeWidth={2.2} aria-hidden />
          Clear filters
        </button>
      </div>
    </section>
  );
}
