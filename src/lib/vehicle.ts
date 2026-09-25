export type VehicleFields = {
  id: string;
  label: string;
  plate: string;
  assignedDriverId: string | null;
};

export type VehicleAssignment = Pick<VehicleFields, "id" | "assignedDriverId">;

const MAX_LABEL = 80;
const MAX_PLATE = 20;

/** Display plate: uppercase, single spaces. */
export function normalizePlateDisplay(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Same bakkie even if typed as "ca 123-456", "CA-123-456", or "CA123456".
 */
export function plateUniqueKey(plate: string): string {
  return normalizePlateDisplay(plate).replace(/[\s-]/g, "");
}

export function platesClash(a: string, b: string): boolean {
  const left = plateUniqueKey(a);
  const right = plateUniqueKey(b);
  return Boolean(left) && left === right;
}

export function formatVehicleFull(label: string, plate: string): string {
  return `${label.trim()} (${plate.trim()})`;
}

/** Last token of the label + plate, e.g. "NP200 CA 123-456". */
export function formatVehicleCompact(label: string, plate: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  const short = parts[parts.length - 1] || label.trim();
  return `${short} ${plate.trim()}`.trim();
}

/** Compact line from a stored full string like "Nissan NP200 (CA 123-456)". */
export function compactVehicleFromDisplay(display: string): string {
  const trimmed = display.trim();
  const match = trimmed.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return formatVehicleCompact(match[1], match[2]);
  }
  return trimmed;
}

/**
 * Booking / Today display: "Thabo · NP200 CA 123-456".
 * No vehicle → driver name only. Jobs never store their own vehicleId.
 */
export function formatAssignedDriverLine(
  driverName: string,
  vehicle?: { label: string; plate: string } | string | null
): string {
  const name = driverName.trim();
  if (!name) return "";
  const first = name.split(/\s+/).filter(Boolean)[0] || name;
  if (!vehicle) return first;
  const compact =
    typeof vehicle === "string"
      ? compactVehicleFromDisplay(vehicle)
      : formatVehicleCompact(vehicle.label, vehicle.plate);
  if (!compact) return first;
  return `${first} · ${compact}`;
}

/** Assigning V to B clears it from A. A driver has at most one current vehicle. */
export function nextVehicleAssignments(
  vehicles: VehicleAssignment[],
  vehicleId: string,
  driverId: string | null
): VehicleAssignment[] {
  return vehicles.map((vehicle) => {
    if (vehicle.id === vehicleId) {
      return { ...vehicle, assignedDriverId: driverId };
    }
    if (driverId && vehicle.assignedDriverId === driverId) {
      return { ...vehicle, assignedDriverId: null };
    }
    return vehicle;
  });
}

export function sanitizeVehicleCreate(
  body: unknown
):
  | { ok: true; label: string; plate: string; assignedDriverId: string | null }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid body" };
  }
  const raw = body as Record<string, unknown>;
  if (typeof raw.label !== "string") {
    return { ok: false, error: "Label is required" };
  }
  if (typeof raw.plate !== "string") {
    return { ok: false, error: "Plate is required" };
  }
  const label = raw.label.trim().replace(/\s+/g, " ");
  const plate = normalizePlateDisplay(raw.plate);
  if (!label) return { ok: false, error: "Label is required" };
  if (!plate) return { ok: false, error: "Plate is required" };
  if (label.length > MAX_LABEL) {
    return { ok: false, error: `Label must be at most ${MAX_LABEL} characters` };
  }
  if (plate.length > MAX_PLATE) {
    return { ok: false, error: `Plate must be at most ${MAX_PLATE} characters` };
  }

  let assignedDriverId: string | null = null;
  if ("assignedDriverId" in raw && raw.assignedDriverId != null && raw.assignedDriverId !== "") {
    if (typeof raw.assignedDriverId !== "string") {
      return { ok: false, error: "assignedDriverId must be a string" };
    }
    const id = raw.assignedDriverId.trim();
    assignedDriverId = id || null;
  }

  return { ok: true, label, plate, assignedDriverId };
}

export function sanitizeVehicleAssign(
  body: unknown
): { ok: true; assignedDriverId: string | null } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid body" };
  }
  const raw = body as Record<string, unknown>;
  if (!("assignedDriverId" in raw)) {
    return { ok: false, error: "assignedDriverId is required" };
  }
  if (raw.assignedDriverId == null || raw.assignedDriverId === "") {
    return { ok: true, assignedDriverId: null };
  }
  if (typeof raw.assignedDriverId !== "string") {
    return { ok: false, error: "assignedDriverId must be a string" };
  }
  const id = raw.assignedDriverId.trim();
  return { ok: true, assignedDriverId: id || null };
}

export function sanitizeVehiclePatch(
  body: unknown
):
  | {
      ok: true;
      label?: string;
      plate?: string;
      assignedDriverId?: string | null;
    }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid body" };
  }
  const raw = body as Record<string, unknown>;
  const updates: {
    label?: string;
    plate?: string;
    assignedDriverId?: string | null;
  } = {};

  if ("label" in raw) {
    if (typeof raw.label !== "string") {
      return { ok: false, error: "Label must be a string" };
    }
    const label = raw.label.trim().replace(/\s+/g, " ");
    if (!label) return { ok: false, error: "Label is required" };
    if (label.length > MAX_LABEL) {
      return { ok: false, error: `Label must be at most ${MAX_LABEL} characters` };
    }
    updates.label = label;
  }

  if ("plate" in raw) {
    if (typeof raw.plate !== "string") {
      return { ok: false, error: "Plate must be a string" };
    }
    const plate = normalizePlateDisplay(raw.plate);
    if (!plate) return { ok: false, error: "Plate is required" };
    if (plate.length > MAX_PLATE) {
      return { ok: false, error: `Plate must be at most ${MAX_PLATE} characters` };
    }
    updates.plate = plate;
  }

  if ("assignedDriverId" in raw) {
    const assigned = sanitizeVehicleAssign({ assignedDriverId: raw.assignedDriverId });
    if (!assigned.ok) return assigned;
    updates.assignedDriverId = assigned.assignedDriverId;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: "No updates provided" };
  }
  return { ok: true, ...updates };
}

/** Display comes only from Vehicle.assignedDriverId — never Driver.vehicle. */
export function overlayDriverVehicle(
  driver: Record<string, unknown>,
  current: { label: string; plate: string } | undefined
): Record<string, unknown> {
  const { vehicle: _legacy, ...rest } = driver;
  if (!current) {
    return { ...rest, vehicle: undefined };
  }
  return { ...rest, vehicle: formatVehicleFull(current.label, current.plate) };
}

export function mongoDuplicateField(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const rec = err as {
    code?: number;
    keyPattern?: Record<string, unknown>;
    keyValue?: Record<string, unknown>;
    message?: string;
  };
  if (rec.code !== 11000) return null;
  if (rec.keyPattern && Object.keys(rec.keyPattern).length > 0) {
    return Object.keys(rec.keyPattern)[0] ?? "unknown";
  }
  if (rec.keyValue && Object.keys(rec.keyValue).length > 0) {
    return Object.keys(rec.keyValue)[0] ?? "unknown";
  }
  const message = String(rec.message || "").toLowerCase();
  if (message.includes("platekey") || message.includes("plate")) return "plate";
  if (message.includes("assigneddriverid")) return "assignedDriverId";
  return "unknown";
}

export function vehicleConflictMessage(field: string | null): {
  status: number;
  error: string;
} | null {
  if (!field) return null;
  if (field === "plate" || field === "plateKey") {
    return { status: 409, error: "A vehicle with this plate already exists" };
  }
  if (field === "assignedDriverId") {
    return { status: 409, error: "That driver already has a vehicle" };
  }
  return { status: 409, error: "That record already exists" };
}

export function toClientVehicle(doc: Record<string, unknown>) {
  const assigned =
    typeof doc.assignedDriverId === "string" && doc.assignedDriverId.trim()
      ? doc.assignedDriverId.trim()
      : null;
  return {
    id: String(doc.id ?? ""),
    label: String(doc.label ?? ""),
    plate: String(doc.plate ?? ""),
    assignedDriverId: assigned,
  };
}
