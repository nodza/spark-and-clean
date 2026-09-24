import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Vehicle } from "@/models/Vehicle";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import {
  mongoDuplicateField,
  plateUniqueKey,
  sanitizeVehiclePatch,
  toClientVehicle,
  vehicleConflictMessage,
} from "@/lib/vehicle";
import {
  persistVehicleAssignment,
  requireAssignableDriver,
  assertPlateAvailable,
} from "@/lib/vehicleStore";

type Params = { params: Promise<{ id: string }> };

function jsonError(err: unknown, fallback: string) {
  if (isHttpError(err)) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const conflict = vehicleConflictMessage(mongoDuplicateField(err));
  if (conflict) {
    return NextResponse.json({ error: conflict.error }, { status: conflict.status });
  }
  const message = err instanceof Error ? err.message : fallback;
  console.error("[api/admin/vehicles/[id]]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Edit label/plate, assign, or unassign. Moving a bakkie clears the previous driver. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    const parsed = sanitizeVehiclePatch(await request.json().catch(() => null));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await connectDB();
    const existing = await Vehicle.findOne({ id }).lean();
    if (!existing) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    if (parsed.assignedDriverId) {
      await requireAssignableDriver(parsed.assignedDriverId);
    }

    if (parsed.plate) {
      await assertPlateAvailable(parsed.plate, id);
    }

    if (parsed.label || parsed.plate) {
      const $set: { label?: string; plate?: string; plateKey?: string } = {};
      if (parsed.label) $set.label = parsed.label;
      if (parsed.plate) {
        $set.plate = parsed.plate;
        $set.plateKey = plateUniqueKey(parsed.plate);
      }
      const updated = await Vehicle.findOneAndUpdate(
        { id },
        { $set },
        { new: true, runValidators: true }
      ).lean();
      if (!updated) {
        return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
      }
    }

    if ("assignedDriverId" in parsed) {
      const vehicle = await persistVehicleAssignment(
        id,
        parsed.assignedDriverId ?? null
      );
      if (!vehicle) {
        return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
      }
      return NextResponse.json({ vehicle });
    }

    const vehicle = await Vehicle.findOne({ id }).lean();
    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
    return NextResponse.json({
      vehicle: toClientVehicle(vehicle as Record<string, unknown>),
    });
  } catch (err) {
    return jsonError(err, "Failed to update vehicle");
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    await connectDB();
    const existing = await Vehicle.findOne({ id }).lean();
    if (!existing) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
    await Vehicle.deleteOne({ id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, "Failed to delete vehicle");
  }
}
