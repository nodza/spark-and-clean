"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { AlertTriangle } from "lucide-react";
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
  suburb: string;
  city: string;
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
  return suburbs.length > 0 ? suburbs.join(", ") : "Unnamed area";
}

function pickupCountLabel(count: number): string {
  return count === 1 ? "1 pickup" : `${count} pickups`;
}

function zoneCities(jobs: ZoneJob[]): string {
  return [...new Set(jobs.map((job) => job.city).filter(Boolean))].join(", ");
}

function unassignedZones(
  bookings: Booking[],
  day: string,
  slot: PickupSlot
): ZoneView[] {
  const open = bookings.filter((booking) =>
    isUnassignedDriver(booking.assignedDriverId)
  );
  const byId = new Map(open.map((booking) => [booking.id, booking]));

  return groupPickupsIntoZones(open, { collectionDate: day, slot }).map(
    (zone) => ({
      id: zone.id,
      suburbs: zone.suburbs,
      jobs: zone.bookingIds.map((id) => {
        const booking = byId.get(id);
        const surname = customerSurname(booking?.customer.name ?? "").trim();
        return {
          id,
          surname: surname || "Unnamed customer",
          suburb: booking?.suburb?.trim() || "Suburb not set",
          city: booking?.city?.trim() || "",
        };
      }),
    })
  );
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
  const titleId = `zone-title-${zone.id}`;
  const driverSelectId = `zone-driver-${zone.id}`;
  const capacityId = `zone-capacity-${zone.id}`;
  const hintId = `zone-hint-${zone.id}`;
  const canAssign =
    Boolean(driverId) && !locked && !driversLoading && !driversError;

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={assigning}
      className="ds-card flex min-w-0 flex-col p-0"
    >
      <div className="ds-card-header gap-3">
        <div className="min-w-0">
          {cities ? (
            <p className="text-eyebrow mb-[4px]" style={{ color: "#9aa0a6" }}>
              {cities}
            </p>
          ) : null}
          <h2
            id={titleId}
            className="text-card-title break-words"
            style={{ color: "#000b49" }}
          >
            {title}
          </h2>
        </div>
        <span
          className="flex-none rounded-full px-[10px] py-[4px] text-[12px] font-extrabold tabular-nums"
          style={{ background: "#f0f2f6", color: "#000b49" }}
        >
          {pickupCountLabel(zone.jobs.length)}
        </span>
      </div>

      <ul className="flex flex-col px-[12px] py-[8px]">
        {zone.jobs.map((job) => (
          <li key={job.id}>
            <Link
              href={`/admin/bookings/${job.id}`}
              className="flex min-h-11 items-center justify-between gap-3 rounded-[10px] px-[10px] py-[8px] transition-colors hover:bg-[#f5f7fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000b49]"
            >
              <span className="min-w-0">
                <span
                  className="block break-words text-[15px] font-extrabold"
                  style={{ color: "#000b49" }}
                >
                  {job.surname}
                </span>
                <span className="text-meta mt-[2px] block break-words" style={{ color: "#9aa0a6" }}>
                  {job.suburb}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <form
        className="mt-auto flex flex-col gap-[10px] border-t border-[#f0f2f6] p-[16px]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canAssign) return;
          onAssign();
        }}
      >
        <label htmlFor={driverSelectId} className="text-eyebrow" style={{ color: "#6b7280" }}>
          Driver
        </label>
        <Select
          value={driverId || undefined}
          disabled={
            locked || driversLoading || Boolean(driversError) || drivers.length === 0
          }
          onValueChange={onDriverChange}
        >
          <SelectTrigger
            id={driverSelectId}
            className="h-11 min-h-11 w-full rounded-[10px] border-[#e3e7ed] bg-white text-[14px] font-semibold text-[#000b49] shadow-none"
            aria-describedby={
              driverId && capacity
                ? capacityId
                : !driversLoading && !driverId
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

        {driversError ? (
          <p className="text-meta" style={{ color: "#d64545" }} role="status">
            {driversError}
          </p>
        ) : drivers.length === 0 && !driversLoading ? (
          <p className="text-meta" style={{ color: "#6b7280" }}>
            No assignable drivers yet.
          </p>
        ) : null}

        {capacity ? (
          <p
            id={capacityId}
            role="status"
            className="flex items-start gap-[8px] text-[13px] font-semibold leading-snug"
            style={{ color: capacity.over ? "#d64545" : "#6b7280" }}
          >
            {capacity.over ? (
              <AlertTriangle
                className="mt-[1px] size-4 flex-none"
                strokeWidth={2.4}
                aria-hidden
              />
            ) : null}
            <span>{capacity.text}</span>
          </p>
        ) : !driversLoading ? (
          <p id={hintId} className="text-meta" style={{ color: "#9aa0a6" }}>
            Choose a driver to assign this zone.
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={!canAssign}
          className="min-h-11 w-full rounded-full sm:w-auto"
        >
          {progress
            ? `Assigning ${progress.done} of ${progress.total}…`
            : "Assign zone"}
        </Button>
      </form>
    </section>
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

  const liveZones = useMemo(
    () => unassignedZones(bookings, selectedDay, slot),
    [bookings, selectedDay, slot]
  );
  const zones = frozenZones ?? liveZones;
  const pickupTotal = zones.reduce((sum, zone) => sum + zone.jobs.length, 0);
  const showInitialLoading = isLoading && bookings.length === 0;
  const boardHref =
    selectedDay === today
      ? "/admin/assignments"
      : `/admin/assignments?date=${encodeURIComponent(selectedDay)}`;

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
      <div className="portal-page">
        <div className="mb-[18px] flex flex-col gap-[16px] lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-[560px]">
            <p className="text-body" style={{ color: "#6b7280" }}>
              Unassigned pickups for this date and slot, grouped by area. Give
              a whole zone to one driver. Single jobs stay on the{" "}
              <Link href={boardHref} className="ds-text-action">
                assignments board
              </Link>
              .
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
          <div ref={resultRef} className="mb-[16px]">
            <ZoneAssignReport result={result} />
          </div>
        ) : null}

        {showInitialLoading ? (
          <p className="text-meta" style={{ color: "#9aa0a6" }} role="status">
            Loading pickup zones…
          </p>
        ) : error && bookings.length === 0 ? (
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
        ) : zones.length === 0 ? (
          <div className="ds-card max-w-lg">
            <p className="text-card-title" style={{ color: "#000b49" }}>
              No unassigned {slotPhrase(slot)} pickups
            </p>
            <p className="text-meta mt-[6px]" style={{ color: "#9aa0a6" }}>
              {formatDay(selectedDay)} has no BOOKED or SCHEDULED pickups
              waiting for a driver in this slot. Jobs that already have a
              driver stay on that driver’s list.
            </p>
          </div>
        ) : (
          <>
            <p className="text-meta mb-[12px]" style={{ color: "#6b7280" }}>
              {zones.length === 1 ? "1 zone" : `${zones.length} zones`} ·{" "}
              {pickupCountLabel(pickupTotal)} · {formatDay(selectedDay)} ·{" "}
              {slot === "MORNING" ? "Morning" : "Afternoon"}
            </p>
            <div className="grid grid-cols-1 items-start gap-[14px] lg:grid-cols-2">
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
    </AdminPortalShell>
  );
}

export default function AdminPickupZonesPage() {
  return (
    <Suspense
      fallback={
        <AdminPortalShell pageTitle="Pickup zones" active="pickupZones">
          <div className="portal-page text-meta" style={{ color: "#9aa0a6" }}>
            Loading…
          </div>
        </AdminPortalShell>
      }
    >
      <PickupZonesBody />
    </Suspense>
  );
}
