"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AdminPortalShell,
  AdminSearchTopbar,
} from "@/components/admin/AdminPortalShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { isValidCalendarDate } from "@/lib/johannesburgDate";
import { localCalendarDate } from "@/lib/localCalendarDate";
import type { ClientVehicleDayUse } from "@/lib/vehicleDay";

type DriverOption = { id: string; name: string; onRoster?: boolean };
type VehicleOption = { id: string; label: string; plate: string };

type VehicleClaim = {
  entryId: string;
  driverId: string;
  driverName: string;
};

function pairKey(driverId: string, vehicleId: string) {
  return `${driverId}:${vehicleId}`;
}

function isAbortError(err: unknown) {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

export default function AdminVehicleDaysPage() {
  const { user, ready } = useAuth();
  const isFullAdmin = user?.role === "admin" && user.adminTier === "full";

  const [date, setDate] = useState(() => localCalendarDate());
  const dateRef = useRef(date);
  dateRef.current = date;

  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [entries, setEntries] = useState<ClientVehicleDayUse[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(() => new Set());

  const markBusy = (key: string) => {
    setBusyKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const clearBusy = (key: string) => {
    setBusyKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const stillOnDay = (day: string) => dateRef.current === day;

  const claimByVehicleId = useMemo(() => {
    const map = new Map<string, VehicleClaim>();
    for (const entry of entries) {
      map.set(entry.vehicleId, {
        entryId: entry.id,
        driverId: entry.driverId,
        driverName: entry.driverName || "Another driver",
      });
    }
    return map;
  }, [entries]);

  const sheetDrivers = useMemo(() => {
    const rosterIds = new Set(drivers.map((driver) => driver.id));
    const extras: DriverOption[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      if (rosterIds.has(entry.driverId) || seen.has(entry.driverId)) continue;
      seen.add(entry.driverId);
      extras.push({
        id: entry.driverId,
        name: entry.driverName || "Inactive driver",
        onRoster: false,
      });
    }
    return [
      ...drivers.map((driver) => ({ ...driver, onRoster: true })),
      ...extras,
    ];
  }, [drivers, entries]);

  const loadRoster = useCallback(async () => {
    setRosterError(null);
    try {
      const [vehicleRes, driverRes] = await Promise.all([
        fetch("/api/admin/vehicles", { credentials: "include" }),
        fetch("/api/drivers", { credentials: "include" }),
      ]);
      const vehicleData = (await vehicleRes.json().catch(() => ({}))) as {
        error?: string;
        vehicles?: VehicleOption[];
      };
      const driverData = (await driverRes.json().catch(() => [])) as
        | DriverOption[]
        | { error?: string };
      if (!vehicleRes.ok) {
        throw new Error(vehicleData.error || "Could not load vehicles");
      }
      if (!driverRes.ok) {
        const message =
          driverData &&
          typeof driverData === "object" &&
          !Array.isArray(driverData) &&
          typeof driverData.error === "string"
            ? driverData.error
            : "Could not load drivers";
        throw new Error(message);
      }
      setVehicles(Array.isArray(vehicleData.vehicles) ? vehicleData.vehicles : []);
      setDrivers(Array.isArray(driverData) ? driverData : []);
    } catch (err) {
      setRosterError(
        err instanceof Error ? err.message : "Could not load day sheet"
      );
    }
  }, []);

  const loadSheet = useCallback(async (day: string, signal?: AbortSignal) => {
    const isCurrent = () => dateRef.current === day;
    if (!isValidCalendarDate(day)) {
      if (isCurrent()) setEntries([]);
      return [] as ClientVehicleDayUse[];
    }
    if (!signal?.aborted) setSheetLoading(true);
    setSheetError(null);
    try {
      const res = await fetch(
        `/api/admin/vehicle-days?date=${encodeURIComponent(day)}`,
        { credentials: "include", signal }
      );
      if (signal?.aborted) return [];
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        entries?: ClientVehicleDayUse[];
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not load day log");
      }
      const rows = Array.isArray(data.entries) ? data.entries : [];
      if (isCurrent()) setEntries(rows);
      return rows;
    } catch (err) {
      if (signal?.aborted || isAbortError(err)) return [];
      if (isCurrent()) {
        setEntries([]);
        setSheetError(
          err instanceof Error ? err.message : "Could not load day log"
        );
      }
      return [];
    } finally {
      if (!signal?.aborted && isCurrent()) setSheetLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !isFullAdmin) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await loadRoster();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, isFullAdmin, loadRoster]);

  useEffect(() => {
    if (!ready || !isFullAdmin) return;
    const ac = new AbortController();
    void loadSheet(date, ac.signal);
    return () => {
      ac.abort();
    };
  }, [ready, isFullAdmin, date, loadSheet]);

  async function addVehicle(driverId: string, vehicleId: string) {
    const day = date;
    const key = pairKey(driverId, vehicleId);
    markBusy(key);
    try {
      const res = await fetch("/api/admin/vehicle-days", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: day, driverId, vehicleId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        entry?: ClientVehicleDayUse;
      };

      if (res.status === 409) {
        if (!stillOnDay(day)) return;
        const existing = data.entry;
        if (existing?.driverId === driverId && existing.vehicleId === vehicleId) {
          setEntries((prev) => {
            if (prev.some((row) => row.id === existing.id)) return prev;
            return [...prev, existing];
          });
          return;
        }
        toast.error(
          data.error || "That vehicle is already logged to a driver on this date"
        );
        await loadSheet(day);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Could not save vehicle for this day");
      }
      if (!stillOnDay(day)) return;
      if (data.entry) {
        setEntries((prev) => {
          if (prev.some((row) => row.id === data.entry!.id)) return prev;
          return [...prev, data.entry!];
        });
      } else {
        await loadSheet(day);
      }
    } catch (err) {
      if (!stillOnDay(day)) return;
      toast.error(
        err instanceof Error ? err.message : "Could not save vehicle for this day"
      );
      await loadSheet(day);
    } finally {
      clearBusy(key);
    }
  }

  async function removeEntry(entryId: string, driverId: string, vehicleId: string) {
    const day = date;
    const key = pairKey(driverId, vehicleId);
    markBusy(key);
    try {
      const res = await fetch(
        `/api/admin/vehicle-days/${encodeURIComponent(entryId)}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not remove vehicle from this day");
      }
      if (!stillOnDay(day)) return;
      setEntries((prev) => prev.filter((row) => row.id !== entryId));
    } catch (err) {
      if (!stillOnDay(day)) return;
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not remove vehicle from this day"
      );
      await loadSheet(day);
    } finally {
      clearBusy(key);
    }
  }

  async function toggleVehicle(
    driverId: string,
    vehicleId: string,
    checked: boolean
  ) {
    const claim = claimByVehicleId.get(vehicleId);
    if (checked) {
      if (claim && claim.driverId !== driverId) return;
      if (claim?.driverId === driverId) return;
      await addVehicle(driverId, vehicleId);
      return;
    }
    if (!claim || claim.driverId !== driverId) return;
    await removeEntry(claim.entryId, driverId, vehicleId);
  }

  if (ready && user && !isFullAdmin) {
    return (
      <AdminPortalShell pageTitle="Day sheet" active="vehicle-days">
        <div className="portal-page">
          <div className="ds-card max-w-lg">
            <div
              className="text-[16px] font-extrabold"
              style={{ color: "#000b49" }}
            >
              Day sheet is managed by full admins
            </div>
            <p className="text-meta mt-[8px]" style={{ color: "#9aa0a6" }}>
              Marketing-only accounts cannot log vehicles for the day.
            </p>
          </div>
        </div>
      </AdminPortalShell>
    );
  }

  const loadError = rosterError || sheetError;

  return (
    <AdminPortalShell
      pageTitle="Day sheet"
      active="vehicle-days"
      topbarActions={<AdminSearchTopbar />}
    >
      <div className="portal-page flex flex-col gap-[18px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div
              className="flex items-center gap-2 text-eyebrow"
              style={{ color: "#9aa0a6" }}
            >
              <CalendarDays size={14} strokeWidth={1.8} aria-hidden="true" />
              DAY VEHICLE LOG
            </div>
            <p className="text-meta mt-[6px]" style={{ color: "#9aa0a6" }}>
              Record which bakkies each driver uses on a date. This does not
              change standing assignments on Vehicles.
            </p>
          </div>
          <div className="w-full max-w-[220px]">
            <Label htmlFor="vehicle-day-date" className="text-meta text-[#9aa0a6]">
              Date
            </Label>
            <Input
              id="vehicle-day-date"
              type="date"
              value={date}
              onChange={(event) => {
                const next = event.target.value;
                if (isValidCalendarDate(next)) setDate(next);
              }}
              className="mt-1"
            />
          </div>
        </div>

        {rosterError ? (
          <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
            {rosterError}
          </p>
        ) : null}
        {sheetError ? (
          <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
            {sheetError}
          </p>
        ) : null}

        <div className="ds-card overflow-hidden p-0">
          <div
            className="hidden items-center px-[22px] py-[14px] lg:grid"
            style={{
              gridTemplateColumns: "minmax(160px, 0.9fr) minmax(280px, 2fr)",
              background: "#f7f9fb",
              borderBottom: "1px solid #f0f2f6",
              columnGap: 16,
            }}
          >
            <div className="text-th">Driver</div>
            <div className="text-th">Vehicles for this day</div>
          </div>

          {loading ? (
            <div className="px-[22px] py-8 text-meta" style={{ color: "#9aa0a6" }}>
              Loading drivers…
            </div>
          ) : sheetDrivers.length === 0 ? (
            <div className="px-[22px] py-8 text-meta" style={{ color: "#9aa0a6" }}>
              {loadError
                ? "Could not load the day sheet."
                : "No assignable drivers yet."}
            </div>
          ) : (
            sheetDrivers.map((driver) => {
              const onRoster = driver.onRoster !== false;
              const selectedCount = entries.filter(
                (entry) => entry.driverId === driver.id
              ).length;
              return (
                <div
                  key={driver.id}
                  className="grid gap-3 px-[22px] py-[14px] transition-colors hover:bg-[#fafbfc] lg:grid-cols-[minmax(160px,0.9fr)_minmax(280px,2fr)] lg:items-start"
                  style={{
                    borderBottom: "1px solid #f0f2f6",
                    columnGap: 16,
                  }}
                >
                  <div className="min-w-0">
                    <div
                      className="truncate text-body font-bold"
                      style={{ color: "#000b49" }}
                      title={driver.name}
                    >
                      {driver.name}
                    </div>
                    <div className="text-meta mt-1" style={{ color: "#9aa0a6" }}>
                      {!onRoster
                        ? "Inactive — uncheck to release"
                        : sheetLoading
                          ? "Updating…"
                          : selectedCount === 0
                            ? "No vehicles logged"
                            : `${selectedCount} vehicle${selectedCount === 1 ? "" : "s"}`}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {vehicles.length === 0 ? (
                      <p className="text-meta" style={{ color: "#9aa0a6" }}>
                        No vehicles in the register yet.
                      </p>
                    ) : (
                      vehicles.map((vehicle) => {
                        const claim = claimByVehicleId.get(vehicle.id);
                        const mine = claim?.driverId === driver.id;
                        const takenByOther = Boolean(claim && !mine);
                        const busy = busyKeys.has(pairKey(driver.id, vehicle.id));
                        const disabled =
                          sheetLoading ||
                          busy ||
                          takenByOther ||
                          (!onRoster && !mine);
                        const label = vehicle.plate
                          ? `${vehicle.label} · ${vehicle.plate}`
                          : vehicle.label;

                        return (
                          <label
                            key={vehicle.id}
                            className={`flex items-start gap-2.5 rounded-[8px] border px-3 py-2 ${
                              takenByOther
                                ? "border-[#eceff3] bg-[#f7f9fb] opacity-80"
                                : mine
                                  ? "border-[#bfe9dc] bg-[#eafaf5]"
                                  : "border-[#e8ebf0] bg-white"
                            }`}
                          >
                            <Checkbox
                              className="mt-0.5"
                              checked={mine}
                              disabled={disabled}
                              onCheckedChange={(value) => {
                                void toggleVehicle(
                                  driver.id,
                                  vehicle.id,
                                  value === true
                                );
                              }}
                              aria-label={`${label} for ${driver.name}`}
                            />
                            <span className="min-w-0">
                              <span
                                className="block text-[13px] font-semibold"
                                style={{ color: "#000b49" }}
                              >
                                {label}
                              </span>
                              {takenByOther ? (
                                <span
                                  className="mt-0.5 block text-[12px]"
                                  style={{ color: "#9aa0a6" }}
                                >
                                  Logged to {claim?.driverName}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AdminPortalShell>
  );
}
