import { isValidCalendarDate } from "@/lib/johannesburgDate";
import { bookingCalendarDate } from "@/lib/localCalendarDate";
import type { VehicleLabelPlate } from "@/lib/vehicle";
import { Vehicle } from "@/models/Vehicle";
import { VehicleDayUse } from "@/models/VehicleDayUse";

export type VehicleDayCreateInput = {
  date: string;
  driverId: string;
  vehicleId: string;
};

export type ClientVehicleDayUse = {
  id: string;
  date: string;
  driverId: string;
  vehicleId: string;
  driverName: string;
  label: string;
  plate: string;
};

/**
 * Validate a day-log create body. date must be yyyy-MM-dd.
 * Does not look up drivers or vehicles — callers do that.
 */
export function sanitizeVehicleDayCreate(
  body: unknown
): { ok: true; value: VehicleDayCreateInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body" };
  }
  const raw = body as Record<string, unknown>;
  const date = typeof raw.date === "string" ? raw.date.trim() : "";
  const driverId = typeof raw.driverId === "string" ? raw.driverId.trim() : "";
  const vehicleId =
    typeof raw.vehicleId === "string" ? raw.vehicleId.trim() : "";

  if (!date || !isValidCalendarDate(date)) {
    return { ok: false, error: "Enter a valid date (yyyy-MM-dd)." };
  }
  if (!driverId) {
    return { ok: false, error: "driverId is required" };
  }
  if (!vehicleId) {
    return { ok: false, error: "vehicleId is required" };
  }

  return { ok: true, value: { date, driverId, vehicleId } };
}

export function sanitizeVehicleDayDateQuery(
  value: string | null
): { ok: true; date: string } | { ok: false; error: string } {
  const date = (value ?? "").trim();
  if (!date || !isValidCalendarDate(date)) {
    return { ok: false, error: "date query (yyyy-MM-dd) is required" };
  }
  return { ok: true, date };
}

/** Unique index on date + vehicleId. */
export function vehicleDayConflictMessage(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const rec = err as {
    code?: number;
    keyPattern?: Record<string, unknown>;
    message?: string;
  };
  if (rec.code !== 11000) return null;
  const keys = rec.keyPattern ? Object.keys(rec.keyPattern) : [];
  const message = String(rec.message || "").toLowerCase();
  if (
    keys.includes("vehicleId") ||
    keys.includes("date") ||
    (message.includes("date") && message.includes("vehicleid"))
  ) {
    return "That vehicle is already logged to a driver on this date";
  }
  return "That day log entry already exists";
}

export function toClientVehicleDayUse(
  doc: {
    id?: unknown;
    date?: unknown;
    driverId?: unknown;
    vehicleId?: unknown;
  },
  vehicle?: { label?: unknown; plate?: unknown } | null,
  driverName?: string | null
): ClientVehicleDayUse {
  return {
    id: String(doc.id ?? ""),
    date: String(doc.date ?? ""),
    driverId: String(doc.driverId ?? ""),
    vehicleId: String(doc.vehicleId ?? ""),
    driverName:
      typeof driverName === "string" && driverName.trim()
        ? driverName.trim()
        : "",
    label: typeof vehicle?.label === "string" ? vehicle.label : "",
    plate: typeof vehicle?.plate === "string" ? vehicle.plate : "",
  };
}

/**
 * Day-log bakkies for one driver on a booking's collection calendar day.
 * Empty when none logged — callers fall back to the standing vehicle.
 */
export async function listDayVehiclesForDriver(
  driverId: string | null | undefined,
  collectionDate: string | null | undefined
): Promise<VehicleLabelPlate[]> {
  const id = typeof driverId === "string" ? driverId.trim() : "";
  const rawDate = typeof collectionDate === "string" ? collectionDate.trim() : "";
  if (!id || !rawDate) return [];

  const date = bookingCalendarDate(rawDate) ?? rawDate.slice(0, 10);
  if (!isValidCalendarDate(date)) return [];

  const rows = await VehicleDayUse.find({ driverId: id, date })
    .sort({ createdAt: 1, id: 1 })
    .select({ vehicleId: 1 })
    .lean();
  if (rows.length === 0) return [];

  const vehicleIds = [
    ...new Set(
      rows
        .map((row) => String(row.vehicleId ?? "").trim())
        .filter(Boolean)
    ),
  ];
  const vehicles = await Vehicle.find({ id: { $in: vehicleIds } })
    .select({ id: 1, label: 1, plate: 1 })
    .lean();
  const byId = new Map(
    vehicles.map((vehicle) => [String(vehicle.id), vehicle] as const)
  );

  const listed: VehicleLabelPlate[] = [];
  for (const row of rows) {
    const vehicle = byId.get(String(row.vehicleId ?? ""));
    if (!vehicle) continue;
    const label = String(vehicle.label ?? "").trim();
    const plate = String(vehicle.plate ?? "").trim();
    if (!label && !plate) continue;
    listed.push({ label, plate });
  }
  return listed;
}
