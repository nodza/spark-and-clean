export type VehicleFields = {
  id: string;
  label: string;
  plate: string;
  assignedDriverId: string | null;
};

export type VehicleAssignment = Pick<VehicleFields, "id" | "assignedDriverId">;

const MAX_LABEL = 80;
const MAX_PLATE = 20;

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
  const plate = raw.plate.trim().replace(/\s+/g, " ").toUpperCase();
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
