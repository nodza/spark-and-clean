"use client";

import { useMemo, Suspense } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight, Package, RefreshCw } from "lucide-react";
import type { Booking, BookingStatus } from "@/types/booking";
import { AccessDeniedBanner } from "@/components/auth/AccessDeniedBanner";
import { BOOKING_STATUS_STEPS } from "@/components/booking/BookingStatusTimeline";
import { useRequireClientAuth } from "@/hooks/useRequireClientAuth";
import { useBookingsLiveList } from "@/hooks/useBookingsLiveList";
import { bookingCalendarDate } from "@/lib/localCalendarDate";
import { amountDueCentsForBooking, balanceAmountCents } from "@/lib/payments/deposit";
import { cn } from "@/lib/utils";

const PAST_STATUSES = new Set<BookingStatus>(["DELIVERED", "CANCELLED"]);
const TRACKABLE_STEPS = BOOKING_STATUS_STEPS.filter((s) => s.id !== "CANCELLED");

function firstName(displayName: string) {
  const token = displayName.trim().split(/\s+/)[0];
  return token || displayName;
}

function formatRand(cents: number) {
  const amount = new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `R ${amount.replace(/\u00a0/g, " ")}`;
}

function formatCalendarDay(value: string, pattern: string) {
  const day = bookingCalendarDate(value);
  if (!day) return null;
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return null;
  return format(new Date(year, month - 1, date), pattern);
}

function slotWindow(slot: Booking["collectionSlot"]) {
  return slot === "MORNING" ? "08:00–12:00" : "12:00–16:00";
}

function rugTitle(booking: Booking) {
  const type = booking.rug.type?.trim() || "Rug";
  return `1 rug · ${type}`;
}

function statusChip(status: BookingStatus): { label: string; className: string } {
  if (status === "CLEANING" || status === "DRYING") {
    return {
      label: status === "DRYING" ? "Drying" : "In cleaning",
      className: "bg-[#eafaf5] text-[#0a7a63] border-[#bfe9dc]",
    };
  }
  if (status === "READY") {
    return {
      label: "Ready for delivery",
      className: "bg-[#e6fbf6] text-[#046b57] border-[#a9ecdc]",
    };
  }
  if (status === "COLLECTED") {
    return {
      label: "Collected",
      className: "bg-[#eef2ff] text-[#2c4fa6] border-[#cbd7ff]",
    };
  }
  if (status === "SCHEDULED") {
    return {
      label: "Scheduled",
      className: "bg-[#fff7d1] text-[#8a6d00] border-[#ffe98a]",
    };
  }
  if (status === "DELIVERED") {
    return {
      label: "COMPLETED",
      className: "bg-[#f0f2f6] text-[#6b7280] border-transparent",
    };
  }
  if (status === "CANCELLED") {
    return {
      label: "CANCELLED",
      className: "bg-[#fdecec] text-[#b33232] border-[#f6c9c9]",
    };
  }
  return {
    label: "Booked",
    className: "bg-[#fff7d1] text-[#8a6d00] border-[#ffe98a]",
  };
}

function progressFor(status: BookingStatus) {
  const index = TRACKABLE_STEPS.findIndex((s) => s.id === status);
  const safe = index < 0 ? 0 : index;
  const total = TRACKABLE_STEPS.length;
  const pct = Math.round((safe / Math.max(total - 1, 1)) * 100);
  return {
    step: safe + 1,
    total,
    pct,
    hint: TRACKABLE_STEPS[Math.min(safe + 1, total - 1)]?.label ?? "",
  };
}

function nextUpCopy(booking: Booking) {
  const when = formatCalendarDay(booking.collectionDate, "EEE d MMM");
  const window = slotWindow(booking.collectionSlot);
  if (booking.status === "BOOKED" || booking.status === "SCHEDULED") {
    return {
      title: "Collection from your address",
      detail: when ? `${when} · ${window} window` : window,
      note: "We'll confirm the window the morning of collection.",
    };
  }
  if (booking.status === "READY") {
    return {
      title: "Delivery back to you",
      detail: "Delivery window to be confirmed",
      note: "We'll SMS you a one-hour window the morning of delivery.",
    };
  }
  return {
    title: "Cleaning in progress",
    detail: "At our facility",
    note: "We'll SMS you a one-hour window the morning of delivery.",
  };
}

function paymentChip(status: Booking["paymentStatus"]): {
  label: string;
  className: string;
} {
  if (status === "PAID") {
    return {
      label: "Paid",
      className: "bg-[#eafaf5] text-[#0a7a63] border-[#bfe9dc]",
    };
  }
  if (status === "DEPOSIT") {
    return {
      label: "Deposit",
      className: "bg-[#eef2ff] text-[#2c4fa6] border-[#cbd7ff]",
    };
  }
  return {
    label: "Unpaid",
    className: "border-destructive/40 text-destructive",
  };
}

function liveMeta(booking: Booking) {
  const day = formatCalendarDay(booking.collectionDate, "d MMM");
  const collected =
    booking.status !== "BOOKED" && booking.status !== "SCHEDULED";
  const when = day
    ? collected
      ? `Collected ${day}`
      : `Collection ${day}`
    : "Date pending";
  return { when, suburb: booking.suburb };
}

function DashboardSkeleton() {
  return (
    <div className="mt-[26px] flex flex-wrap gap-5" role="status" aria-live="polite">
      <span className="sr-only">Loading your bookings…</span>
      <div className="min-w-0 flex-1 rounded-[14px] border border-[#e3e7ed] bg-white p-6">
        <div className="h-3 w-[28%] animate-pulse rounded-md bg-[#eef1f5]" />
        <div className="mt-4 h-[30px] w-[46%] animate-pulse rounded-md bg-[#eef1f5]" />
        <div className="mt-[18px] h-3 w-[34%] animate-pulse rounded-md bg-[#eef1f5]" />
      </div>
      <div className="w-full rounded-[14px] border border-[#e3e7ed] bg-white p-5 lg:w-[300px] lg:flex-none">
        <div className="h-[11px] w-[52%] animate-pulse rounded-md bg-[#eef1f5]" />
        <div className="mt-4 h-14 animate-pulse rounded-lg bg-[#f3f5f8]" />
      </div>
    </div>
  );
}

function LiveBookingCard({ booking }: { booking: Booking }) {
  const chip = statusChip(booking.status);
  const progress = progressFor(booking.status);
  const meta = liveMeta(booking);
  const pay = paymentChip(booking.paymentStatus);
  const needsBalance = booking.paymentStatus === "DEPOSIT";
  const trackLabel = needsBalance ? "Pay balance" : "Track";

  return (
    <Link
      href={`/booking/${booking.id}`}
      className={cn(
        "mb-4 block overflow-hidden rounded-[14px] border bg-white no-underline shadow-[0_2px_10px_rgba(0,11,73,.04)] last:mb-0",
        needsBalance ? "border-primary/30" : "border-[#e3e7ed]"
      )}
    >
      <div className="flex flex-col gap-3 px-4 pb-4 pt-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-6 sm:pb-[18px] sm:pt-[22px]">
        <div className="min-w-0">
          <div className="text-[10.5px] font-extrabold tracking-[0.13em] text-[#9aa0a6]">
            BOOKING {booking.id}
          </div>
          <div className="mt-[9px] text-[20px] font-extrabold tracking-[-0.01em] text-[#000b49] sm:text-[24px]">
            {rugTitle(booking)}
          </div>
          <div className="mt-[11px] flex flex-wrap items-center gap-x-[14px] gap-y-1 text-[13px] text-[#6b7280]">
            <span>{meta.when}</span>
            <span className="text-[#d8dde4]">·</span>
            <span>{meta.suburb}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <span
            className={cn(
              "inline-block whitespace-nowrap rounded-full border px-[13px] py-1.5 text-[11px] font-extrabold tracking-[0.04em]",
              chip.className
            )}
          >
            {chip.label}
          </span>
          <span
            className={cn(
              "inline-block whitespace-nowrap rounded-full border px-[13px] py-1 text-[10.5px] font-extrabold tracking-[0.04em]",
              pay.className
            )}
          >
            {pay.label}
          </span>
        </div>
      </div>
      <div className="h-px bg-[#f0f2f6]" />
      <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-[22px] sm:pt-[18px]">
        <div className="relative h-1.5 overflow-hidden rounded-full bg-[#f0f2f6]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#0a7a63] to-[#6cf3d5]"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <span className="text-[12px] font-semibold text-[#6b7280]">
            Step {progress.step} of {progress.total}
            {progress.hint ? ` · ${progress.hint}` : ""}
          </span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 text-[12.5px] font-extrabold",
              needsBalance ? "text-[#000b49]" : "text-[#0a7a63]"
            )}
          >
            {trackLabel}
            <span className="hidden sm:inline">
              {needsBalance ? "" : " booking"}
            </span>
            <ChevronRight className="size-4" strokeWidth={2.2} aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}

function PastBookingRow({ booking }: { booking: Booking }) {
  const chip = statusChip(booking.status);
  const pay = paymentChip(booking.paymentStatus);
  const day = formatCalendarDay(booking.createdAt, "d MMM yyyy");
  const delivered = formatCalendarDay(booking.collectionDate, "d MMM yyyy");
  const metaDate =
    booking.status === "DELIVERED"
      ? `delivered ${delivered || day || ""}`.trim()
      : booking.status === "CANCELLED"
        ? `cancelled ${day || ""}`.trim()
        : day || "";
  const total = formatRand(amountDueCentsForBooking(booking));

  return (
    <Link
      href={`/booking/${booking.id}`}
      className="mb-2.5 flex flex-col gap-3 rounded-xl border border-[#e3e7ed] bg-white px-4 py-4 no-underline last:mb-0 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-bold text-[#000b49]">{rugTitle(booking)}</div>
        <div className="mt-1 text-[12.5px] text-[#9aa0a6]">
          {booking.id}
          {metaDate ? ` · ${metaDate}` : ""}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
        <span className="whitespace-nowrap text-[14px] font-extrabold text-[#000b49]">
          {total}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "whitespace-nowrap rounded-full border px-[11px] py-1 text-[10.5px] font-extrabold tracking-[0.04em]",
              chip.className
            )}
          >
            {chip.label}
          </span>
          <span
            className={cn(
              "whitespace-nowrap rounded-full border px-[11px] py-1 text-[10.5px] font-extrabold tracking-[0.04em]",
              pay.className
            )}
          >
            {pay.label}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function ClientDashboard() {
  const { user, email, ready } = useRequireClientAuth();
  const {
    bookings,
    loading,
    error,
    isRefreshing,
    refresh,
  } = useBookingsLiveList(ready && !!email);

  const displayName = user?.name?.trim() || email || "there";

  const { activeBookings, pastBookings, deliveredCount, outstandingCents } =
    useMemo(() => {
      if (!email) {
        return {
          activeBookings: [] as Booking[],
          pastBookings: [] as Booking[],
          deliveredCount: 0,
          outstandingCents: 0,
        };
      }

      const myBookings = bookings.filter(
        (b) => b.customer.email.toLowerCase() === email.toLowerCase()
      );
      const active = myBookings
        .filter((b) => !PAST_STATUSES.has(b.status))
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      const past = myBookings
        .filter((b) => PAST_STATUSES.has(b.status))
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      const deliveredCount = myBookings.filter((b) => b.status === "DELIVERED")
        .length;
      const outstandingCents = active.reduce(
        (sum, booking) => sum + balanceAmountCents(booking),
        0
      );

      return {
        activeBookings: active,
        pastBookings: past,
        deliveredCount,
        outstandingCents,
      };
    }, [bookings, email]);

  const featured = activeBookings[0];
  const nextUp = featured ? nextUpCopy(featured) : null;
  const stampFilled = deliveredCount % 5;
  const stampRemaining = 5 - stampFilled;
  const stampHeadline =
    stampFilled === 4
      ? "Your next clean is free"
      : `${stampRemaining} clean${stampRemaining === 1 ? "" : "s"} to go`;
  const stampNote =
    stampFilled === 4
      ? "One rug free, up to R500. Applied automatically at your next booking."
      : "Every rug booking over R500 earns a stamp. The 5th gets one rug free, up to R500.";

  if (!ready || !email) return null;

  const empty = !loading && activeBookings.length === 0 && pastBookings.length === 0;

  return (
    <div className="px-4 py-8 sm:px-10 sm:py-[34px] sm:pb-14">
      <Suspense fallback={null}>
        <AccessDeniedBanner />
      </Suspense>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-[#000b49] sm:text-[30px]">
            Welcome back, {firstName(displayName)}
          </h1>
          <p className="mt-2 text-[14px] text-[#6b7280] sm:text-[14.5px]">
            Everything booked with Spark &amp; Clean.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            className="inline-flex size-10 items-center justify-center rounded-full text-[#9aa0a6] hover:bg-white hover:text-[#000b49] disabled:opacity-60"
            aria-label="Refresh bookings"
          >
            <RefreshCw
              className={cn("size-4", isRefreshing && "animate-spin")}
              aria-hidden
            />
          </button>
          <Link
            href="/book/rug"
            className="hidden rounded-full bg-[#000b49] px-5 py-2.5 text-[13px] font-extrabold text-white no-underline hover:bg-[#0a1a6b] lg:inline-flex"
          >
            New collection
          </Link>
        </div>
      </div>

      {error ? (
        <p
          className="mt-6 rounded-[14px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <DashboardSkeleton />
      ) : empty ? (
        <div className="mt-[26px] rounded-[14px] border border-[#e3e7ed] bg-white px-5 py-12 text-center sm:px-10 sm:py-[60px]">
          <div className="mx-auto flex size-[62px] items-center justify-center rounded-full bg-[#eafaf5]">
            <Package className="size-[26px] text-[#0a7a63]" strokeWidth={1.7} aria-hidden />
          </div>
          <div className="mt-5 text-[21px] font-extrabold text-[#000b49]">
            No bookings yet
          </div>
          <p className="mx-auto mt-2.5 max-w-[430px] text-sm leading-relaxed text-[#6b7280]">
            Tell us what needs cleaning and we&apos;ll collect from your door, clean
            it in seven minutes, and bring it back.
          </p>
          <Link
            href="/book/rug"
            className="mt-[22px] inline-block rounded-full bg-[#000b49] px-[26px] py-[13px] text-sm font-extrabold text-white no-underline hover:bg-[#0a1a6b]"
          >
            Book a collection
          </Link>
        </div>
      ) : (
        <div className="mt-[26px] flex flex-col items-start gap-5 lg:flex-row">
          <div className="min-w-0 w-full flex-1">
            {activeBookings.map((booking) => (
              <LiveBookingCard key={booking.id} booking={booking} />
            ))}

            {pastBookings.length > 0 ? (
              <>
                <div className="mb-3 mt-[30px] text-[10.5px] font-extrabold tracking-[0.13em] text-[#9aa0a6]">
                  PAST BOOKINGS
                </div>
                {pastBookings.map((booking) => (
                  <PastBookingRow key={booking.id} booking={booking} />
                ))}
              </>
            ) : null}
          </div>

          <aside className="w-full flex-none lg:w-[300px]">
            {nextUp ? (
              <div className="rounded-[14px] bg-[#000b49] p-[22px] text-white">
                <div className="mb-4 text-[10.5px] font-extrabold tracking-[0.14em] text-[#6cf3d5]">
                  NEXT UP
                </div>
                <div className="text-[20px] font-extrabold leading-snug">{nextUp.title}</div>
                <div className="mt-2 text-[13.5px] text-white/65">{nextUp.detail}</div>
                <div className="my-[18px] h-px bg-white/12" />
                <div className="text-[12.5px] leading-relaxed text-white/65">
                  {nextUp.note}
                </div>
              </div>
            ) : null}

            <div className="mt-3.5 rounded-[14px] border-[1.5px] border-[#6cf3d5] bg-white p-5">
              <div className="mb-3 text-[10.5px] font-extrabold tracking-[0.14em] text-[#0a7a63]">
                EVERY 5TH CLEAN FREE
              </div>
              <div className="flex gap-1.5">
                {Array.from({ length: 4 }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-[9px] flex-1 rounded-full",
                      i < stampFilled ? "bg-[#0a7a63]" : "bg-[#eef1f5]"
                    )}
                  />
                ))}
              </div>
              <div className="mt-3.5 text-[15px] font-extrabold text-[#000b49]">
                {stampHeadline}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#6b7280]">
                {stampNote}
              </p>
            </div>

            <div className="mt-3.5 rounded-[14px] border border-[#e3e7ed] bg-white p-5">
              <div className="mb-3.5 text-[10.5px] font-extrabold tracking-[0.14em] text-[#9aa0a6]">
                ACCOUNT
              </div>
              <div>
                <div className="text-[10.5px] font-bold tracking-[0.06em] text-[#9aa0a6]">
                  TOTAL CLEANS
                </div>
                <div className="mt-1.5 text-[22px] font-extrabold text-[#000b49]">
                  {deliveredCount}
                </div>
              </div>
              <div className="my-3.5 h-px bg-[#f0f2f6]" />
              <div>
                <div className="text-[10.5px] font-bold tracking-[0.06em] text-[#9aa0a6]">
                  OUTSTANDING
                </div>
                <div className="mt-1.5 text-base font-extrabold text-[#0a7a63]">
                  {outstandingCents <= 0
                    ? "R0.00 · all settled"
                    : `${formatRand(outstandingCents)} due`}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
