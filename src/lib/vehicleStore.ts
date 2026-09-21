import { Vehicle } from "@/models/Vehicle";
import { Driver } from "@/models/Driver";
import { formatVehicleFull, toClientVehicle } from "@/lib/vehicle";

export async function vehiclesByDriverId(
  driverIds: string[]
): Promise<Map<string, { label: string; plate: string }>> {
  const ids = [...new Set(driverIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const rows = await Vehicle.find({ assignedDriverId: { $in: ids } }).lean();
  const map = new Map<string, { label: string; plate: string }>();
  for (const row of rows) {
    const driverId =
      typeof row.assignedDriverId === "string" ? row.assignedDriverId : "";
    if (!driverId || map.has(driverId)) continue;
    map.set(driverId, { label: String(row.label), plate: String(row.plate) });
  }
  return map;
}

export function overlayDriverVehicle(
  driver: Record<string, unknown>,
  current: { label: string; plate: string } | undefined
): Record<string, unknown> {
  if (!current) {
    const legacy = typeof driver.vehicle === "string" ? driver.vehicle.trim() : "";
    return { ...driver, vehicle: legacy || undefined };
  }
  return { ...driver, vehicle: formatVehicleFull(current.label, current.plate) };
}

/** Persist exclusive assignment: one vehicle per driver, no history table. */
export async function persistVehicleAssignment(
  vehicleId: string,
  driverId: string | null
) {
  if (driverId) {
    await Vehicle.updateMany(
      { assignedDriverId: driverId, id: { $ne: vehicleId } },
      { $set: { assignedDriverId: null } }
    );
  }

  const vehicle = await Vehicle.findOneAndUpdate(
    { id: vehicleId },
    { $set: { assignedDriverId: driverId } },
    { new: true, runValidators: true }
  ).lean();

  return vehicle ? toClientVehicle(vehicle as Record<string, unknown>) : null;
}

export async function driverNameById(
  driverIds: string[]
): Promise<Map<string, string>> {
  const ids = [...new Set(driverIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const rows = await Driver.find({ id: { $in: ids } })
    .select("id name")
    .lean();
  return new Map(
    rows.map((row) => [String(row.id), String(row.name || row.id)])
  );
}
