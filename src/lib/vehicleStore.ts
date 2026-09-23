import { Vehicle } from "@/models/Vehicle";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import { accountIsDisabled, HttpError } from "@/lib/adminAuth";
import { plateUniqueKey, toClientVehicle } from "@/lib/vehicle";

export { overlayDriverVehicle } from "@/lib/vehicle";

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

export async function assertPlateAvailable(plate: string, excludeId?: string) {
  const key = plateUniqueKey(plate);
  if (!key) return;
  const rows = await Vehicle.find().select("id plate").lean();
  const taken = rows.some(
    (row) =>
      row.id !== excludeId && plateUniqueKey(String(row.plate ?? "")) === key
  );
  if (taken) {
    throw new HttpError(409, "A vehicle with this plate already exists");
  }
}

export async function requireAssignableDriver(driverId: string) {
  const driver = await Driver.findOne({ id: driverId }).lean();
  if (!driver || driver.isActive === false) {
    throw new HttpError(400, "Driver not found or inactive");
  }
  const tech = await User.findOne({
    role: "technician",
    driverProfileId: driverId,
  })
    .select("disabledAt isActive")
    .lean();
  if (tech && accountIsDisabled(tech)) {
    throw new HttpError(400, "Driver not found or inactive");
  }
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
