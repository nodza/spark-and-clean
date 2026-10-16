"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

type DriverOption = { id: string; name: string };
type VehicleOption = { id: string; label: string; plate: string };

type VehicleClaim = {
  entryId: string;
  driverId: string;
  driverName: string;
};

export default function AdminVehicleDaysPage() {
  const { user, ready } = useAuth();
  const isFullAdmin = user?.role === "admin" && user.adminTier === "full";

  const [date, setDate] = useState(() => localCalendarDate());
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [entries, setEntries] = useState<ClientVehicleDayUse[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const driverNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const driver of drivers) map.set(driver.id, driver.name);
    return map;
  }, [drivers]);

  const claimByVehicleId = useMemo(() => {
    const map = new Map<string, VehicleClaim>();
    for (const entry of entries) {
      map.set(entry.vehicleId, {
        entryId: entry.id,
        driverId: entry.driverId,
        driverName: driverNameById.get(entry.driverId) || "Another driver",
      });
    }
    return map;
  }, [entries, driverNameById]);

  const loadRoster = useCallback(async () => {
    setLoadError(null);
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
      setLoadError(
        err instanceof Error ? err.message : "Could not load day sheet"
      );
    }
  }, []);

  const loadSheet = useCallback(async (day: string) => {
    if (!isValidCalendarDate(day)) {
      setEntries([]);
      return;
    }
    setSheetLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/admin/vehicle-days?date=${encodeURIComponent(day)}`,
        { credentials: "include" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        entries?: ClientVehicleDayUse[];
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not load day log");
      }
      // Empty day → empty entries (not an error).
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (err) {
      setEntries([]);
      setLoadError(err instanceof Error ? err.message : "Could not load day log");
    } finally {
      setSheetLoading(false);
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
    void loadSheet(date);
  }, [ready, isFullAdmin, date, loadSheet]);

  async function addVehicle(driverId: string, vehicleId: string) {
    const key = `${driverId}:${vehicleId}`;
    setBusyKey(key);
    try {
      const res = await fetch("/api/admin/vehicle-days", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, driverId, vehicleId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        entry?: ClientVehicleDayUse;
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not save vehicle for this day");
      }
      if (data.entry) {
        setEntries((prev) => {
          if (prev.some((row) => row.id === data.entry!.id)) return prev;
          return [...prev, data.entry!];
        });
      } else {
        await loadSheet(date);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save vehicle for this day"
      );
      await loadSheet(date);
    } finally {
      setBusyKey(null);
    }
  }

  async function removeEntry(entryId: string, driverId: string, vehicleId: string) {
    const key = `${driverId}:${vehicleId}`;
    setBusyKey(key);
    try {
      const res = await fetch(
        `/api/admin/vehicle-days/${encodeURIComponent(entryId)}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not remove vehicle from this day");
      }
      setEntries((prev) => prev.filter((row) => row.id !== entryId));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not remove vehicle from this day"
      );
      await loadSheet(date);
    } finally {
      setBusyKey(null);
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

        {loadError ? (
          <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
            {loadError}
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
          ) : drivers.length === 0 ? (
            <div className="px-[22px] py-8 text-meta" style={{ color: "#9aa0a6" }}>
              No assignable drivers yet.
            </div>
          ) : (
            drivers.map((driver) => {
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
                      {sheetLoading
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
                        const disabled =
                          sheetLoading ||
                          busyKey === `${driver.id}:${vehicle.id}` ||
                          takenByOther;
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
