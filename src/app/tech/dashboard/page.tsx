"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, MapPin, RefreshCw } from "lucide-react";
import { TechAppShell } from "@/components/layout/TechAppShell";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireClientAuth";
import { useBookingsLiveList } from "@/hooks/useBookingsLiveList";
import { localCalendarDate } from "@/lib/localCalendarDate";
import {
  technicianDoneToday,
  technicianTodayStops,
  technicianUpcomingJobs,
} from "@/lib/technicianJobs";
import {
  formatRouteDate,
  formatUpcomingDate,
  rugSummary,
  slotTimeLabel,
  slotWindowLabel,
  techAccentColor,
  techStopKind,
  techTagClass,
  techTagLabel,
} from "@/lib/techUi";
import type { Booking } from "@/types/booking";
import { cn } from "@/lib/utils";

export default function TechDashboardPage() {
  const { user, ready } = useRequireAuth(["technician"], "/tech/login");
  const {
    bookings,
    loading: isLoading,
    error,
    isRefreshing,
    refresh,
  } = useBookingsLiveList(!!ready);
  const [doneOpen, setDoneOpen] = useState(false);

  const driverId = user?.driverProfileId;
  const todaySa = localCalendarDate();

  const { morning, afternoon, done, upcoming } = useMemo(() => {
    const stops = technicianTodayStops(bookings, driverId, todaySa);
    return {
      morning: stops.filter((job) => job.collectionSlot === "MORNING"),
      afternoon: stops.filter((job) => job.collectionSlot === "AFTERNOON"),
      done: technicianDoneToday(bookings, driverId, todaySa),
      upcoming: technicianUpcomingJobs(bookings, driverId, todaySa),
    };
  }, [bookings, driverId, todaySa]);

  const openStops = morning.length + afternoon.length;
  const nextId =
    morning[0]?.id ?? afternoon[0]?.id ?? undefined;
  const todayHeading = formatRouteDate(todaySa);
  const hasAnyJobs = openStops > 0 || done.length > 0 || upcoming.length > 0;

  return (
    <TechAppShell activeTab="today">
      <div className="mb-[18px] grid grid-cols-3 gap-2.5">
        <StatCard label="TODAY" value={String(openStops)} />
        <StatCard
          label="DONE"
          value={String(done.length)}
          valueClassName="text-[#0a7a63]"
        />
        <StatCard label="UPCOMING" value={String(upcoming.length)} />
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
            aria-label="Refresh today's stops"
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

      {isLoading && !hasAnyJobs ? (
        <div
          className="flex flex-col items-center justify-center gap-3 py-16 text-[#9aa0a6]"
          role="status"
        >
          <Loader2 className="size-7 animate-spin text-navy" aria-hidden />
          <p className="text-sm font-medium">Loading your stops…</p>
        </div>
      ) : null}

      {!isLoading && openStops === 0 && done.length === 0 ? (
        <div className="rounded-[14px] border border-[#e3e7ed] bg-white px-6 py-12 text-center">
          <p className="font-bold text-navy">No stops for today</p>
          <p className="mt-1 text-sm text-[#9aa0a6]">
            Dispatch has not assigned any pickups or returns to you yet.
          </p>
        </div>
      ) : null}

      {morning.length > 0 ? (
        <section className="mb-5" aria-labelledby="morning-stops-heading">
          <div className="mb-2.5 flex items-baseline justify-between gap-2">
            <h2
              id="morning-stops-heading"
              className="text-[10.5px] font-extrabold tracking-[0.13em] text-[#9aa0a6]"
            >
              MORNING
            </h2>
            <span className="text-[11px] font-bold text-[#9aa0a6]">
              {morning.length}
            </span>
          </div>
          <JobList jobs={morning} nextId={nextId} />
        </section>
      ) : null}

      {afternoon.length > 0 ? (
        <section className="mb-5" aria-labelledby="afternoon-stops-heading">
          <div className="mb-2.5 flex items-baseline justify-between gap-2">
            <h2
              id="afternoon-stops-heading"
              className="text-[10.5px] font-extrabold tracking-[0.13em] text-[#9aa0a6]"
            >
              AFTERNOON
            </h2>
            <span className="text-[11px] font-bold text-[#9aa0a6]">
              {afternoon.length}
            </span>
          </div>
          <JobList jobs={afternoon} nextId={nextId} />
        </section>
      ) : null}

      {openStops > 0 && upcoming.length === 0 ? (
        <p className="mb-5 text-center text-xs text-[#b3b9c2]">
          That&apos;s your full route for today.
        </p>
      ) : null}

      <section className="border-t border-[#f0f2f6] pt-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-[10.5px] font-extrabold tracking-[0.13em] text-[#9aa0a6]"
          onClick={() => setDoneOpen((open) => !open)}
          aria-expanded={doneOpen}
        >
          <span>DONE TODAY ({done.length})</span>
          <ChevronDown
            className={cn("size-4 transition-transform", doneOpen && "rotate-180")}
            aria-hidden
          />
        </button>
        {doneOpen && done.length > 0 ? (
          <div className="mt-3">
            <JobList jobs={done} forceDone />
          </div>
        ) : null}
      </section>

      {upcoming.length > 0 ? (
        <section className="mt-7" aria-labelledby="upcoming-stops-heading">
          <h2
            id="upcoming-stops-heading"
            className="mb-2.5 text-[10.5px] font-extrabold tracking-[0.13em] text-[#9aa0a6]"
          >
            UPCOMING
          </h2>
          <JobList jobs={upcoming} showCollectionDate />
        </section>
      ) : null}
    </TechAppShell>
  );
}

function JobList({
  jobs,
  nextId,
  showCollectionDate = false,
  forceDone = false,
}: {
  jobs: Booking[];
  nextId?: string;
  showCollectionDate?: boolean;
  forceDone?: boolean;
}) {
  return (
    <ul className="space-y-2.5">
      {jobs.map((job) => {
        const kind = techStopKind(job.status);
        const isDone = forceDone || job.status === "DELIVERED";
        const isNext = !isDone && job.id === nextId;

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
                        {slotWindowLabel(job.collectionSlot)}
                      </div>
                    </>
                  )}
                </div>
                <div
                  className="min-h-[38px] w-[3px] shrink-0 self-stretch rounded-full"
                  style={{
                    background: techAccentColor(
                      isDone ? "done" : isNext ? "collect" : kind
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
                      : techTagClass(isNext ? "collect" : kind)
                  )}
                >
                  {isDone ? "DONE" : techTagLabel(job.status, isNext)}
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
