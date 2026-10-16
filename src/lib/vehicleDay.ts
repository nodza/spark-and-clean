import { isValidCalendarDate } from "@/lib/johannesburgDate";

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
  vehicle?: { label?: unknown; plate?: unknown } | null
): ClientVehicleDayUse {
  return {
    id: String(doc.id ?? ""),
    date: String(doc.date ?? ""),
    driverId: String(doc.driverId ?? ""),
    vehicleId: String(doc.vehicleId ?? ""),
    label: typeof vehicle?.label === "string" ? vehicle.label : "",
    plate: typeof vehicle?.plate === "string" ? vehicle.plate : "",
  };
}
