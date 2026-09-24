import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { connectDB } from "@/lib/mongodb";
import { Vehicle } from "@/models/Vehicle";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import {
  mongoDuplicateField,
  plateUniqueKey,
  sanitizeVehicleCreate,
  toClientVehicle,
  vehicleConflictMessage,
} from "@/lib/vehicle";
import {
  assertPlateAvailable,
  driverNameById,
  persistVehicleAssignment,
  requireAssignableDriver,
} from "@/lib/vehicleStore";

function jsonError(err: unknown, fallback: string) {
  if (isHttpError(err)) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const conflict = vehicleConflictMessage(mongoDuplicateField(err));
  if (conflict) {
    return NextResponse.json({ error: conflict.error }, { status: conflict.status });
  }
  const message = err instanceof Error ? err.message : fallback;
  console.error("[api/admin/vehicles]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Full admin only — fleet list with current driver. */
export async function GET() {
  try {
    await requireFullAdmin();
    await connectDB();

    const docs = await Vehicle.find().sort({ label: 1, plate: 1 }).lean();
    const driverIds = docs
      .map((d) =>
        typeof d.assignedDriverId === "string" ? d.assignedDriverId : ""
      )
      .filter(Boolean);
    const names = await driverNameById(driverIds);

    return NextResponse.json({
      vehicles: docs.map((doc) => {
        const row = toClientVehicle(doc as Record<string, unknown>);
        return {
          ...row,
          assignedDriverName: row.assignedDriverId
            ? names.get(row.assignedDriverId) ?? null
            : null,
        };
      }),
    });
  } catch (err) {
    return jsonError(err, "Failed to list vehicles");
  }
}

export async function POST(request: Request) {
  try {
    await requireFullAdmin();
    const parsed = sanitizeVehicleCreate(await request.json().catch(() => null));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await connectDB();

    let assignedDriverId = parsed.assignedDriverId;
    if (assignedDriverId) {
      await requireAssignableDriver(assignedDriverId);
    } else {
      assignedDriverId = null;
    }

    await assertPlateAvailable(parsed.plate);

    const created = await Vehicle.create({
      id: `vehicle_${randomBytes(4).toString("hex")}`,
      label: parsed.label,
      plate: parsed.plate,
      plateKey: plateUniqueKey(parsed.plate),
      assignedDriverId: null,
    });

    const row = assignedDriverId
      ? await persistVehicleAssignment(created.id, assignedDriverId)
      : toClientVehicle(created.toObject() as Record<string, unknown>);

    return NextResponse.json({ vehicle: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Failed to add vehicle");
  }
}
