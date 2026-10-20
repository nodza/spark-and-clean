"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  ChevronRight,
  CircleAlert,
  Loader2,
  MapPin,
} from "lucide-react";
import { ASSIGNMENT_SLOT_CAPACITY } from "@/config/assignmentBoard";
import { AdminPortalShell } from "@/components/admin/AdminPortalShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isUnassignedDriver } from "@/lib/bookingAttention";
import {
  collectionsForAssignmentDay,
  customerSurname,
} from "@/lib/assignmentBoard";
import {
  isValidCalendarDate,
  johannesburgCalendarDate,
} from "@/lib/johannesburgDate";
import {
  groupPickupsIntoZones,
  type PickupSlot,
} from "@/lib/pickupZones";
import { useBookingStore } from "@/store/useBookingStore";
import type { Booking } from "@/types/booking";

type AssignableDriver = {
  id: string;
  name: string;
};

type ZoneJob = {
  id: string;
  surname: string;
  address: string;
  suburb: string;
  city: string;
  customerKey: string;
};

type ZoneView = {
  id: string;
  suburbs: string[];
  jobs: ZoneJob[];
};

type NamedJob = {
  id: string;
  surname: string;
};

type FailedJob = NamedJob & {
  error: string;
};

type ZoneAssignResult = {
  zoneLabel: string;
  driverName: string;
  saved: NamedJob[];
  failed: FailedJob[];
};

const SLOTS: { value: PickupSlot; label: string }[] = [
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
];

function formatDay(day: string): string {
  const parsed = parseISO(day);
  if (Number.isNaN(parsed.getTime())) return day;
  return format(parsed, "d MMM yyyy");
}

function slotPhrase(slot: PickupSlot): string {
  return slot === "MORNING" ? "morning" : "afternoon";
}

function zoneTitle(suburbs: string[]): string {
  if (suburbs.length === 0) return "Unnamed area";
  if (suburbs.length === 1) return suburbs[0];
  return `${suburbs[0]} area`;
}

function pickupCountLabel(count: number): string {
  return count === 1 ? "1 pickup" : `${count} pickups`;
}

function customerCountLabel(jobs: ZoneJob[]): string {
  const people = new Set(jobs.map((job) => job.customerKey)).size;
  const stops = jobs.length;
  if (people === stops) {
    return people === 1 ? "1 client" : `${people} clients`;
  }
  return `${pickupCountLabel(stops)} · ${people === 1 ? "1 client" : `${people} clients`}`;
}

function zoneCities(jobs: ZoneJob[]): string {
  return [...new Set(jobs.map((job) => job.city).filter(Boolean))].join(", ");
}

function unassignedZones(
  bookings: Booking[],
  day: string,
  slot: PickupSlot
): { zones: ZoneView[]; alone: number } {
  const open = bookings.filter((booking) =>
    isUnassignedDriver(booking.assignedDriverId)
  );
  const byId = new Map(open.map((booking) => [booking.id, booking]));
  const grouped = groupPickupsIntoZones(open, { collectionDate: day, slot });
  const zones = grouped
    .filter((zone) => zone.bookingIds.length > 1)
    .map((zone) => ({
      id: zone.id,
      suburbs: zone.suburbs,
      jobs: zone.bookingIds.map((id) => {
        const booking = byId.get(id);
        const surname = customerSurname(booking?.customer?.name ?? "").trim();
        const suburb = booking?.suburb?.trim() || "Suburb not set";
        const street = booking?.addressLine1?.trim() || "";
        return {
          id,
          surname: surname || "Unnamed customer",
          address: street ? `${street}, ${suburb}` : suburb,
          suburb,
          city: booking?.city?.trim() || "",
          customerKey:
            booking?.customer?.id ||
            booking?.customer?.name?.trim().toLowerCase() ||
            id,
        };
      }),
    }));
  return {
    zones,
    alone: grouped.length - zones.length,
  };
}

function driverSlotCount(
  bookings: Booking[],
  day: string,
  slot: PickupSlot,
  driverId: string
): number {
  return collectionsForAssignmentDay(bookings, day).filter(
    (job) => job.collectionSlot === slot && job.assignedDriverId === driverId
  ).length;
}

function capacityCopy(
  driverName: string,
  current: number,
  adding: number,
  slot: PickupSlot
): { over: boolean; text: string } {
  const next = current + adding;
  const when = slotPhrase(slot);
  if (next > ASSIGNMENT_SLOT_CAPACITY) {
    return {
      over: true,
      text: `${driverName} would have ${next} ${when} pickups. The usual limit is ${ASSIGNMENT_SLOT_CAPACITY}. You can still assign this zone.`,
    };
  }
  return {
    over: false,
    text: `${driverName} would have ${next} of ${ASSIGNMENT_SLOT_CAPACITY} ${when} pickups.`,
  };
}

function ZoneAssignReport({ result }: { result: ZoneAssignResult }) {
  const failed = result.failed.length > 0;
  return (
    <div
      role={failed ? "alert" : "status"}
      className="ds-card"
      style={{
        borderColor: failed ? "#f0c9c9" : "#b7eadf",
        background: failed ? "#fff6f6" : "#f3fbf8",
      }}
    >
      <h2 className="text-card-title" style={{ color: "#000b49" }}>
        {failed ? "Some pickups in this zone were not assigned" : "Zone assigned"}
      </h2>
      <p className="text-body mt-[6px]" style={{ color: "#000b49" }}>
        {result.zoneLabel} to {result.driverName}.
      </p>
      {result.saved.length > 0 ? (
        <div className="mt-[14px]">
          <p className="text-eyebrow" style={{ color: "#0a7a63" }}>
            Saved
          </p>
          <ul className="mt-[6px] flex flex-col gap-[4px]">
            {result.saved.map((job) => (
              <li key={job.id} className="text-body break-words" style={{ color: "#000b49" }}>
                {job.surname}{" "}
                <span className="text-meta" style={{ color: "#6b7280" }}>
                  ({job.id})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-body mt-[14px]" style={{ color: "#000b49" }}>
          No pickups in this zone were assigned.
        </p>
      )}
      {failed ? (
        <div className="mt-[14px]">
          <p className="text-eyebrow" style={{ color: "#d64545" }}>
            Failed
          </p>
          <ul className="mt-[6px] flex flex-col gap-[8px]">
            {result.failed.map((job) => (
              <li key={job.id} className="text-body break-words" style={{ color: "#000b49" }}>
                {job.surname}{" "}
                <span className="text-meta" style={{ color: "#6b7280" }}>
                  ({job.id})
                </span>
                {": "}
                {job.error}
              </li>
            ))}
          </ul>
          {result.saved.length > 0 ? (
            <p className="text-meta mt-[10px]" style={{ color: "#6b7280" }}>
              Pickups that saved stay with {result.driverName}. Nothing was undone.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ZoneCard({
  zone,
  drivers,
  driversLoading,
  driversError,
  driverId,
  onDriverChange,
  capacity,
  assigning,
  locked,
  progress,
  onAssign,
}: {
  zone: ZoneView;
  drivers: AssignableDriver[];
  driversLoading: boolean;
  driversError: string | null;
  driverId: string;
  onDriverChange: (driverId: string) => void;
  capacity: { over: boolean; text: string } | null;
  assigning: boolean;
  locked: boolean;
  progress: { done: number; total: number } | null;
  onAssign: () => void;
}) {
  const title = zoneTitle(zone.suburbs);
  const cities = zoneCities(zone.jobs);
  const peopleLabel = customerCountLabel(zone.jobs);
  const stops = [...zone.jobs].sort((a, b) => {
    const bySuburb = a.suburb.localeCompare(b.suburb, undefined, {
      sensitivity: "base",
    });
    if (bySuburb !== 0) return bySuburb;
    return a.surname.localeCompare(b.surname, undefined, { sensitivity: "base" });
  });
  const titleId = `zone-title-${zone.id}`;
  const driverSelectId = `zone-driver-${zone.id}`;
  const capacityId = `zone-capacity-${zone.id}`;
  const hintId = `zone-hint-${zone.id}`;
  const canAssign =
    Boolean(driverId) && !locked && !driversLoading && !driversError;
  const selectOff =
    locked || driversLoading || Boolean(driversError) || drivers.length === 0;
  const showEmptyDrivers = !driversLoading && !driversError && drivers.length === 0;

  return (
    <article
      aria-labelledby={titleId}
      aria-busy={assigning}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#e3e7ed] bg-white shadow-[0_1px_2px_rgba(0,11,73,0.05),0_10px_28px_rgba(0,11,73,0.07)]"
    >
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2.5 px-4 pt-[18px] pb-3 sm:px-5 sm:pt-5 sm:pb-3.5">
        <div className="min-w-0 flex-1 basis-[120px]">
          {cities ? (
            <p
              className="mb-[7px] flex items-center gap-1.5 text-[11px] leading-none font-bold tracking-[0.09em] text-[#6b7280] uppercase"
            >
              <MapPin className="size-3 flex-none" strokeWidth={2.4} aria-hidden />
              <span className="min-w-0 break-words">{cities}</span>
            </p>
          ) : null}
          <h2
            id={titleId}
            className="break-words text-[20px] leading-[1.2] font-extrabold tracking-[-0.01em] text-[#000b49] sm:text-[22px]"
          >
            {title}
          </h2>
        </div>
        <span className="flex-none rounded-full bg-[#ffdc39] px-3 py-2 text-[13px] leading-none font-bold whitespace-nowrap text-[#000b49]">
          {peopleLabel}
        </span>
      </header>

      {zone.suburbs.length > 1 ? (
        <ul
          className="flex flex-wrap gap-2 px-4 pb-3.5 sm:px-5 sm:pb-4"
          aria-label="Suburbs in this zone"
        >
          {zone.suburbs.map((suburb) => (
            <li
              key={suburb}
              className="rounded-full bg-[#f0f2f6] px-3 py-2 text-[13px] leading-none font-semibold break-words text-[#000b49]"
            >
              {suburb}
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="border-t border-[#f0f2f6]">
        {stops.map((job) => (
          <li key={job.id} className="border-b border-[#f0f2f6]">
            <Link
              href={`/admin/bookings/${job.id}`}
              className="group flex min-h-[60px] items-center justify-between gap-3 px-4 py-2.5 text-inherit no-underline transition-colors hover:bg-[#f5f7fa] focus-visible:bg-[#f5f7fa] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#000b49] sm:px-5"
            >
              <span className="block min-w-0">
                <span className="block text-[16px] leading-snug font-bold break-words text-[#000b49]">
                  {job.surname}
                </span>
                <span className="mt-0.5 block text-[14px] leading-snug font-medium break-words text-[#6b7280]">
                  {job.address}
                </span>
              </span>
              <ChevronRight
                className="size-[18px] flex-none text-[#9aa0a6] transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-[#000b49] group-focus-visible:text-[#000b49]"
                strokeWidth={2.2}
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>

      <form
        className="mt-auto flex flex-col gap-2.5 bg-[#f5f7fa] px-4 pt-4 pb-[18px] sm:px-5 sm:pt-[18px] sm:pb-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canAssign) return;
          onAssign();
        }}
      >
        <label
          htmlFor={driverSelectId}
          className="text-[11px] leading-none font-bold tracking-[0.09em] text-[#6b7280] uppercase"
        >
          Driver
        </label>
        <Select
          value={driverId || undefined}
          disabled={selectOff}
          onValueChange={onDriverChange}
        >
          <SelectTrigger
            id={driverSelectId}
            className="h-12! w-full rounded-xl border-[#e3e7ed] bg-white px-3.5 text-[16px] font-semibold text-[#000b49] shadow-none data-[placeholder]:text-[#6b7280] focus-visible:border-[#000b49] focus-visible:ring-[#000b49]/20 disabled:cursor-not-allowed disabled:bg-[#f0f2f6] disabled:opacity-100 [&_svg]:size-[18px] [&_svg]:text-[#6b7280] [&_svg]:opacity-100"
            aria-describedby={
              driverId && capacity
                ? capacityId
                : !driversLoading && !driverId && drivers.length > 0
                  ? hintId
                  : undefined
            }
          >
            <SelectValue
              placeholder={driversLoading ? "Loading drivers…" : "Choose a driver"}
            />
          </SelectTrigger>
          <SelectContent className="max-h-72 overflow-y-auto">
            {drivers.map((driver) => (
              <SelectItem key={driver.id} value={driver.id}>
                {driver.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div aria-live="polite" className="flex flex-col">
          {driversError ? (
            <div className="flex items-start gap-2 text-[#d64545]">
              <CircleAlert
                className="mt-px size-[18px] flex-none"
                strokeWidth={2.2}
                aria-hidden
              />
              <p className="text-[14px] leading-snug font-semibold">{driversError}</p>
            </div>
          ) : showEmptyDrivers ? (
            <p className="text-[14px] leading-snug font-medium text-[#6b7280]">
              No assignable drivers yet.
            </p>
          ) : capacity?.over ? (
            <div
              id={capacityId}
              role="status"
              className="flex items-start gap-2.5 rounded-xl border border-[#ffe98a] bg-[#fff7d1] px-3 py-2.5 text-[#8a6d00]"
            >
              <AlertTriangle
                className="mt-px size-[18px] flex-none"
                strokeWidth={2.2}
                aria-label="Warning"
              />
              <p className="text-[14px] leading-snug font-medium">{capacity.text}</p>
            </div>
          ) : capacity ? (
            <p
              id={capacityId}
              role="status"
              className="text-[14px] leading-snug font-semibold text-[#000b49]"
            >
              {capacity.text}
            </p>
          ) : !driversLoading && drivers.length > 0 ? (
            <p id={hintId} className="text-[14px] leading-snug font-medium text-[#6b7280]">
              Choose a driver to assign this zone.
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          disabled={!canAssign}
          className="h-[52px] w-full gap-2.5 rounded-[14px] text-[16px] font-bold disabled:bg-[#e3e7ed] disabled:text-[#6b7280] disabled:opacity-100"
        >
          {progress ? (
            <Loader2 className="size-[18px] animate-spin" strokeWidth={2.6} aria-hidden />
          ) : null}
          {progress
            ? `Assigning ${progress.done} of ${progress.total}…`
            : "Assign zone"}
        </Button>
      </form>
    </article>
  );
}

function PickupZonesBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { bookings, fetchBookings, isLoading, error, assignDriver } =
    useBookingStore();
  const [drivers, setDrivers] = useState<AssignableDriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [driverByZone, setDriverByZone] = useState<Record<string, string>>({});
  const [assigningZoneId, setAssigningZoneId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    zoneId: string;
    done: number;
    total: number;
  } | null>(null);
  const [result, setResult] = useState<ZoneAssignResult | null>(null);
  const [frozenZones, setFrozenZones] = useState<ZoneView[] | null>(null);
  const assigningRef = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const today = johannesburgCalendarDate();
  const dateParam = searchParams.get("date");
  const slotParam = searchParams.get("slot");
  const selectedDay =
    dateParam && isValidCalendarDate(dateParam) ? dateParam : today;
  const slot: PickupSlot = slotParam === "AFTERNOON" ? "AFTERNOON" : "MORNING";

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/drivers", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load drivers");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data)) {
          setDrivers([]);
          setDriversError("Could not load drivers.");
          return;
        }
        const list: AssignableDriver[] = data
          .filter(
            (row): row is { id: string; name: string } =>
              !!row &&
              typeof row.id === "string" &&
              row.id.length > 0 &&
              typeof row.name === "string"
          )
          .map((row) => ({
            id: row.id,
            name: row.name.trim() || row.id,
          }));
        list.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
        setDrivers(list);
        setDriversError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setDrivers([]);
        setDriversError("Could not load drivers. Refresh and try again.");
      })
      .finally(() => {
        if (!cancelled) setDriversLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    resultRef.current?.scrollIntoView({ block: "nearest" });
  }, [result]);

  const live = useMemo(
    () => unassignedZones(bookings, selectedDay, slot),
    [bookings, selectedDay, slot]
  );
  const zones = frozenZones ?? live.zones;
  const alone = frozenZones ? 0 : live.alone;
  const pickupTotal = zones.reduce((sum, zone) => sum + zone.jobs.length, 0);
  const showInitialLoading = isLoading && bookings.length === 0;

  const replaceQuery = (nextDay: string, nextSlot: PickupSlot) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextDay === today) params.delete("date");
    else params.set("date", nextDay);
    if (nextSlot === "MORNING") params.delete("slot");
    else params.set("slot", nextSlot);
    const query = params.toString();
    router.replace(query ? `/admin/pickup-zones?${query}` : "/admin/pickup-zones");
  };

  const setDay = (next: string) => {
    if (!isValidCalendarDate(next) || assigningRef.current) return;
    setResult(null);
    replaceQuery(next, slot);
  };

  const setSlot = (next: PickupSlot) => {
    if (assigningRef.current || next === slot) return;
    setResult(null);
    replaceQuery(selectedDay, next);
  };

  const assignZone = async (zone: ZoneView) => {
    if (assigningRef.current) return;
    const driverId = driverByZone[zone.id];
    const driver = drivers.find((item) => item.id === driverId);
    if (!driver) return;

    assigningRef.current = true;
    setFrozenZones(zones);
    setAssigningZoneId(zone.id);
    setProgress({ zoneId: zone.id, done: 0, total: zone.jobs.length });
    const saved: NamedJob[] = [];
    const failed: FailedJob[] = [];

    try {
      for (const job of zone.jobs) {
        const message = await assignDriver(job.id, driver.id);
        if (message) {
          failed.push({ id: job.id, surname: job.surname, error: message });
        } else {
          saved.push({ id: job.id, surname: job.surname });
        }
        setProgress({
          zoneId: zone.id,
          done: saved.length + failed.length,
          total: zone.jobs.length,
        });
      }
      setResult({
        zoneLabel: zoneTitle(zone.suburbs),
        driverName: driver.name,
        saved,
        failed,
      });
    } finally {
      assigningRef.current = false;
      setAssigningZoneId(null);
      setFrozenZones(null);
      setProgress(null);
    }
  };

  return (
    <AdminPortalShell pageTitle="Pickup zones" active="pickupZones">
      <div className="portal-page flex min-h-0 flex-1 flex-col !pb-4">
        <div className="mb-[18px] flex shrink-0 flex-col gap-[16px] lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-[560px]">
            <p className="text-body" style={{ color: "#6b7280" }}>
              Unassigned pickups that share an area are one zone. Give that
              whole zone to one driver. A pickup on its own is not a zone.
            </p>
          </div>
          <div className="flex flex-col gap-[12px] sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-col gap-[7px]">
              <span className="text-eyebrow" style={{ color: "#6b7280" }}>
                Date
              </span>
              <Input
                type="date"
                value={selectedDay}
                onChange={(event) => setDay(event.target.value)}
                disabled={Boolean(assigningZoneId)}
                aria-label="Collection date"
                className="h-11 w-full min-w-0 py-[10px] sm:w-[200px]"
              />
            </label>
            <fieldset
              disabled={Boolean(assigningZoneId)}
              className="group min-w-0 border-0 p-0 disabled:opacity-60"
            >
              <legend className="text-eyebrow mb-[7px]" style={{ color: "#6b7280" }}>
                Slot
              </legend>
              <div className="flex w-full rounded-full border border-[#e3e7ed] sm:w-auto">
                {SLOTS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center px-[16px] text-[13px] font-extrabold text-[#000b49] transition-colors first:rounded-l-full last:rounded-r-full has-[:checked]:bg-[#000b49] has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#000b49] group-disabled:cursor-not-allowed sm:flex-none ${option.value === "AFTERNOON" ? "border-l border-[#e3e7ed]" : ""}`}
                  >
                    <input
                      type="radio"
                      name="pickup-zone-slot"
                      value={option.value}
                      checked={slot === option.value}
                      onChange={() => setSlot(option.value)}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        {result ? (
          <div ref={resultRef} className="mb-[16px] shrink-0">
            <ZoneAssignReport result={result} />
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {showInitialLoading ? (
          <div className="flex flex-1 items-center justify-center px-4" role="status">
            <p className="text-meta text-center" style={{ color: "#9aa0a6" }}>
              Loading pickup zones…
            </p>
          </div>
        ) : error && bookings.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4">
          <div className="ds-card max-w-lg" role="alert">
            <p className="text-card-title" style={{ color: "#000b49" }}>
              Pickups could not be loaded
            </p>
            <p className="text-meta mt-[6px]" style={{ color: "#6b7280" }}>
              {error}
            </p>
            <Button
              type="button"
              variant="secondary"
              className="mt-[14px] min-h-11 rounded-full"
              onClick={() => void fetchBookings()}
            >
              Try again
            </Button>
          </div>
          </div>
        ) : zones.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4">
          <div className="ds-card max-w-lg">
            <p className="text-card-title" style={{ color: "#000b49" }}>
              {alone > 0
                ? `No ${slotPhrase(slot)} zones`
                : `No unassigned ${slotPhrase(slot)} pickups`}
            </p>
            <p className="text-meta mt-[6px]" style={{ color: "#9aa0a6" }}>
              {alone > 0
                ? `${alone === 1 ? "1 pickup is" : `${alone} pickups are`} on ${formatDay(selectedDay)} with no other pickup within 8 km, so ${alone === 1 ? "it is" : "they are"} not a zone. Assign ${alone === 1 ? "it" : "them"} from the assignments board. Jobs that already have a driver stay on that driver’s list.`
                : `${formatDay(selectedDay)} has no BOOKED or SCHEDULED pickups waiting for a driver in this slot. Jobs that already have a driver stay on that driver’s list.`}
            </p>
          </div>
          </div>
        ) : (
          <>
            <p className="text-meta mb-[12px]" style={{ color: "#6b7280" }}>
              {zones.length === 1 ? "1 zone" : `${zones.length} zones`} ·{" "}
              {pickupCountLabel(pickupTotal)} · {formatDay(selectedDay)} ·{" "}
              {slot === "MORNING" ? "Morning" : "Afternoon"}
              {alone > 0
                ? ` · ${alone === 1 ? "1 pickup is on its own and is not a zone" : `${alone} pickups are on their own and are not zones`}`
                : ""}
            </p>
            <div className="grid grid-cols-1 items-stretch gap-[14px] lg:grid-cols-2">
              {zones.map((zone) => {
                const driverId = driverByZone[zone.id] ?? "";
                const driver = drivers.find((item) => item.id === driverId);
                const assigning = assigningZoneId === zone.id;
                const locked = Boolean(assigningZoneId);
                const savedInZone = driver
                  ? zone.jobs.filter((job) => {
                      const booking = bookings.find((item) => item.id === job.id);
                      return booking?.assignedDriverId === driver.id;
                    }).length
                  : 0;
                const capacity =
                  driver && zone.jobs.length > 0
                    ? capacityCopy(
                        driver.name,
                        driverSlotCount(bookings, selectedDay, slot, driver.id),
                        zone.jobs.length - savedInZone,
                        slot
                      )
                    : null;
                return (
                  <ZoneCard
                    key={zone.id}
                    zone={zone}
                    drivers={drivers}
                    driversLoading={driversLoading}
                    driversError={driversError}
                    driverId={driver ? driverId : ""}
                    onDriverChange={(next) =>
                      setDriverByZone((current) => ({ ...current, [zone.id]: next }))
                    }
                    capacity={capacity}
                    assigning={assigning}
                    locked={locked}
                    progress={
                      progress && progress.zoneId === zone.id ? progress : null
                    }
                    onAssign={() => void assignZone(zone)}
                  />
                );
              })}
            </div>
          </>
        )}
        </div>
      </div>
    </AdminPortalShell>
  );
}

export default function AdminPickupZonesPage() {
  return (
    <Suspense
      fallback={
        <AdminPortalShell pageTitle="Pickup zones" active="pickupZones">
          <div
            className="portal-page flex min-h-0 flex-1 items-center justify-center text-meta"
            style={{ color: "#9aa0a6" }}
          >
            Loading…
          </div>
        </AdminPortalShell>
      }
    >
      <PickupZonesBody />
    </Suspense>
  );
}
