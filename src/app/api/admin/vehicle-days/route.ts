import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { connectDB } from "@/lib/mongodb";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import { Vehicle } from "@/models/Vehicle";
import { VehicleDayUse } from "@/models/VehicleDayUse";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import { isAssignableDriverPair } from "@/lib/assignableDriver";
import {
  sanitizeVehicleDayCreate,
  sanitizeVehicleDayDateQuery,
  toClientVehicleDayUse,
  vehicleDayConflictMessage,
} from "@/lib/vehicleDay";
import { toPublicApiError } from "@/lib/publicApiError";

function jsonError(err: unknown, fallback: string) {
  if (isHttpError(err)) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const conflict = vehicleDayConflictMessage(err);
  if (conflict) {
    return NextResponse.json({ error: conflict }, { status: 409 });
  }
  const message = err instanceof Error ? err.message : fallback;
  console.error("[api/admin/vehicle-days]", message);
  return NextResponse.json(
    { error: toPublicApiError(err, fallback) },
    { status: 500 }
  );
}

/** Full admin — day log rows for one calendar date, with vehicle label/plate. */
export async function GET(request: Request) {
  try {
    await requireFullAdmin();
    const parsed = sanitizeVehicleDayDateQuery(
      new URL(request.url).searchParams.get("date")
    );
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await connectDB();
    const rows = await VehicleDayUse.find({ date: parsed.date })
      .sort({ driverId: 1, createdAt: 1 })
      .lean();

    const vehicleIds = [
      ...new Set(rows.map((row) => String(row.vehicleId ?? "")).filter(Boolean)),
    ];
    const vehicles = vehicleIds.length
      ? await Vehicle.find({ id: { $in: vehicleIds } })
          .select({ id: 1, label: 1, plate: 1 })
          .lean()
      : [];
    const byId = new Map(
      vehicles.map((vehicle) => [String(vehicle.id), vehicle] as const)
    );

    return NextResponse.json({
      date: parsed.date,
      entries: rows.map((row) =>
        toClientVehicleDayUse(row, byId.get(String(row.vehicleId)))
      ),
    });
  } catch (err) {
    return jsonError(err, "Failed to list vehicle day uses");
  }
}

/** Log one driver + vehicle on a date. Does not touch Vehicle.assignedDriverId. */
export async function POST(request: Request) {
  try {
    await requireFullAdmin();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = sanitizeVehicleDayCreate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await connectDB();

    const [driver, vehicle] = await Promise.all([
      Driver.findOne({ id: parsed.value.driverId }).lean(),
      Vehicle.findOne({ id: parsed.value.vehicleId })
        .select({ id: 1, label: 1, plate: 1 })
        .lean(),
    ]);

    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }
    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    const tech = await User.findOne({
      role: "technician",
      driverProfileId: parsed.value.driverId,
    })
      .select({ disabledAt: 1, isActive: 1 })
      .lean();

    if (!isAssignableDriverPair(driver, tech)) {
      return NextResponse.json(
        { error: "Driver not found or inactive" },
        { status: 400 }
      );
    }

    try {
      const created = await VehicleDayUse.create({
        id: `vday_${randomBytes(4).toString("hex")}`,
        date: parsed.value.date,
        driverId: parsed.value.driverId,
        vehicleId: parsed.value.vehicleId,
      });

      return NextResponse.json(
        {
          entry: toClientVehicleDayUse(
            created.toObject() as Record<string, unknown>,
            vehicle
          ),
        },
        { status: 201 }
      );
    } catch (err) {
      const conflict = vehicleDayConflictMessage(err);
      if (conflict) {
        return NextResponse.json({ error: conflict }, { status: 409 });
      }
      throw err;
    }
  } catch (err) {
    return jsonError(err, "Failed to create vehicle day use");
  }
}
