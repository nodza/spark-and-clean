"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Loader2, MapPin, RefreshCw } from "lucide-react";
import { TechAppShell } from "@/components/layout/TechAppShell";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireClientAuth";
import { useBookingsLiveList } from "@/hooks/useBookingsLiveList";
import {
  bookingCalendarDate,
  localCalendarDate,
} from "@/lib/localCalendarDate";
import {
  formatRouteDate,
  formatUpcomingDate,
  rugSummary,
  slotTimeLabel,
  slotWindowLabel,
  sortJobsBySlotThenId,
  techAccentColor,
  techStopKind,
  techTagClass,
  techTagLabel,
} from "@/lib/techUi";
import type { Booking, BookingStatus } from "@/types/booking";
import { cn } from "@/lib/utils";

/** Van stop finished for today — show faint + DONE (design). */
function isTodayStopDone(status: BookingStatus): boolean {
  return (
    status === "COLLECTED" ||
    status === "CLEANING" ||
    status === "DRYING" ||
    status === "DELIVERED"
  );
}

export default function TechDashboardPage() {
  const { user, ready } = useRequireAuth(["technician"], "/tech/login");
  const {
    bookings,
    loading: isLoading,
    error,
    isRefreshing,
    refresh,
  } = useBookingsLiveList(!!ready);

  const driverId = user?.driverProfileId;
  const todaySa = localCalendarDate();

  const { todayJobs, upcomingJobs, doneTodayCount, overdueCount } = useMemo(() => {
    const mine = bookings.filter(
      (b) => !driverId || b.assignedDriverId === driverId
    );

    const todayOpen: Booking[] = [];
    const todayDone: Booking[] = [];
    const upcoming: Booking[] = [];
    let overdue = 0;

    for (const job of mine) {
      if (job.status === "CANCELLED") continue;

      const day = bookingCalendarDate(job.collectionDate);
      const done = isTodayStopDone(job.status);

      if (day === todaySa) {
        if (done) todayDone.push(job);
        else todayOpen.push(job);
        continue;
      }

      if (done) continue; // finished on another day — Completed tab

      if (!day) {
        todayOpen.push(job);
        continue;
      }

      if (day < todaySa) {
        overdue += 1;
        todayOpen.push(job);
      } else {
        upcoming.push(job);
      }
    }

    // Design order: faint DONE stops first, then remaining route
    const today = [
      ...sortJobsBySlotThenId(todayDone),
      ...sortJobsBySlotThenId(todayOpen),
    ];

    return {
      todayJobs: today,
      upcomingJobs: [...upcoming].sort((a, b) => {
        const dayA = bookingCalendarDate(a.collectionDate) ?? "";
        const dayB = bookingCalendarDate(b.collectionDate) ?? "";
        if (dayA !== dayB) return dayA.localeCompare(dayB);
        const slot =
          (a.collectionSlot === "MORNING" ? 0 : 1) -
          (b.collectionSlot === "MORNING" ? 0 : 1);
        if (slot !== 0) return slot;
        return a.id.localeCompare(b.id);
      }),
      doneTodayCount: todayDone.length,
      overdueCount: overdue,
    };
  }, [bookings, driverId, todaySa]);

  const nextId = todayJobs.find((j) => !isTodayStopDone(j.status))?.id;
  const todayHeading = formatRouteDate(todaySa);

  return (
    <TechAppShell activeTab="today">
      <div className="mb-[18px] grid grid-cols-3 gap-2.5">
        <StatCard label="TODAY" value={String(todayJobs.length)} />
        <StatCard
          label="DONE"
          value={String(doneTodayCount)}
          valueClassName="text-[#0a7a63]"
        />
        <StatCard label="UPCOMING" value={String(upcomingJobs.length)} />
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10.5px] font-extrabold tracking-[0.13em] text-[#9aa0a6]">
          {todayHeading}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-[#9aa0a6]"
            onClick={() => void refresh()}
            disabled={isLoading || isRefreshing}
            aria-label="Refresh jobs"
          >
            <RefreshCw
              className={cn(
                "size-3.5",
                (isLoading || isRefreshing) && "animate-spin"
              )}
              aria-hidden
            />
          </Button>
          <Link
            href="/tech/map"
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-bold text-[#0a7a63] hover:text-navy"
          >
            <MapPin className="size-3.5" aria-hidden />
            Map
          </Link>
        </div>
      </div>

      {error && error !== "FORBIDDEN" && error !== "UNAUTHORIZED" ? (
        <div
          className="mb-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          Couldn’t refresh jobs.{" "}
          <button
            type="button"
            className="font-bold underline"
            onClick={() => void refresh()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {isLoading && todayJobs.length === 0 && upcomingJobs.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 py-16 text-[#9aa0a6]"
          role="status"
        >
          <Loader2 className="size-7 animate-spin text-navy" aria-hidden />
          <p className="text-sm font-medium">Loading your stops…</p>
        </div>
      ) : null}

      {!isLoading && todayJobs.length === 0 && upcomingJobs.length === 0 ? (
        <div className="rounded-[14px] border border-[#e3e7ed] bg-white px-6 py-12 text-center">
          <p className="font-bold text-navy">No jobs assigned yet</p>
          <p className="mt-1 text-sm text-[#9aa0a6]">
            Check with dispatch — new stops will appear here.
          </p>
        </div>
      ) : null}

      {/* ——— Today ——— */}
      {todayJobs.length > 0 ? (
        <section aria-labelledby="today-stops-heading">
          <div className="mb-2.5 flex items-baseline justify-between gap-2">
            <h2
              id="today-stops-heading"
              className="text-[10.5px] font-extrabold tracking-[0.13em] text-[#9aa0a6]"
            >
              TODAY&apos;S STOPS
            </h2>
            {overdueCount > 0 ? (
              <span className="text-[11px] font-bold text-[#8a6b00]">
                {overdueCount} overdue
              </span>
            ) : null}
          </div>
          <JobList
            jobs={todayJobs}
            nextId={nextId}
            showCollectionDate={false}
            todaySa={todaySa}
          />
          {upcomingJobs.length === 0 ? (
            <p className="mt-4 text-center text-xs text-[#b3b9c2]">
              That&apos;s your full route for today.
            </p>
          ) : null}
        </section>
      ) : null}

      {!isLoading && todayJobs.length === 0 && upcomingJobs.length > 0 ? (
        <div className="mb-5 rounded-[14px] border border-dashed border-[#d8dde4] bg-white/70 px-5 py-8 text-center">
          <p className="font-bold text-navy">Nothing scheduled for today</p>
          <p className="mt-1 text-sm text-[#9aa0a6]">
            Upcoming collections are listed below.
          </p>
        </div>
      ) : null}

      {/* ——— Upcoming ——— */}
      {upcomingJobs.length > 0 ? (
        <section
          className={cn(todayJobs.length > 0 && "mt-7")}
          aria-labelledby="upcoming-stops-heading"
        >
          <h2
            id="upcoming-stops-heading"
            className="mb-2.5 text-[10.5px] font-extrabold tracking-[0.13em] text-[#9aa0a6]"
          >
            UPCOMING
          </h2>
          <JobList
            jobs={upcomingJobs}
            nextId={undefined}
            showCollectionDate
            todaySa={todaySa}
          />
        </section>
      ) : null}
    </TechAppShell>
  );
}

function JobList({
  jobs,
  nextId,
  showCollectionDate,
  todaySa,
}: {
  jobs: Booking[];
  nextId?: string;
  showCollectionDate: boolean;
  todaySa: string;
}) {
  return (
    <ul className="space-y-2.5">
      {jobs.map((job) => {
        const kind = techStopKind(job.status);
        const isDone = isTodayStopDone(job.status);
        const isNext = !isDone && job.id === nextId;
        const day = bookingCalendarDate(job.collectionDate);
        const isOverdue = !isDone && !!day && day < todaySa;

        return (
          <li key={job.id}>
            <Link
              href={`/tech/job/${job.id}`}
              className={cn(
                "block rounded-[14px] border border-[#e3e7ed] bg-white px-4 py-[15px] transition-[opacity,box-shadow]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2",
                isDone && "opacity-60",
                isNext && "shadow-[0_0_0_2px_#000b49]"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-[52px] shrink-0">
                  {showCollectionDate ? (
                    <>
                      <div className="text-[11px] font-extrabold leading-tight text-navy">
                        {formatUpcomingDate(job.collectionDate)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#9aa0a6]">
                        {slotTimeLabel(job.collectionSlot)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-extrabold text-navy">
                        {slotTimeLabel(job.collectionSlot)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#9aa0a6]">
                        {isOverdue
                          ? "Overdue"
                          : slotWindowLabel(job.collectionSlot)}
                      </div>
                    </>
                  )}
                </div>
                <div
                  className="min-h-[38px] w-[3px] shrink-0 self-stretch rounded-full"
                  style={{
                    background: techAccentColor(
                      isDone
                        ? "done"
                        : isOverdue
                          ? "collect"
                          : isNext
                            ? "collect"
                            : kind
                    ),
                  }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-bold text-navy">
                    {job.customer.name}
                  </div>
                  <div className="mt-1 truncate text-[12.5px] text-[#9aa0a6]">
                    {rugSummary(job)}
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wide",
                    isDone
                      ? techTagClass("done")
                      : isOverdue
                        ? "border-[#f0c4c4] bg-[#fff0f0] text-[#a33]"
                        : techTagClass(isNext ? "collect" : kind)
                  )}
                >
                  {isDone
                    ? "DONE"
                    : isOverdue
                      ? "OVERDUE"
                      : techTagLabel(job.status, isNext)}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function StatCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-[#e3e7ed] bg-white px-4 py-3.5">
      <div className="text-[9.5px] font-extrabold tracking-[0.1em] text-[#9aa0a6]">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 text-2xl font-extrabold text-navy",
          valueClassName
        )}
      >
        {value}
      </div>
    </div>
  );
}
