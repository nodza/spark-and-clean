import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Vehicle } from "@/models/Vehicle";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import { accountIsDisabled, isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import { sanitizeVehicleAssign } from "@/lib/vehicle";
import { persistVehicleAssignment } from "@/lib/vehicleStore";

type Params = { params: Promise<{ id: string }> };

function jsonError(err: unknown, fallback: string) {
  if (isHttpError(err)) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : fallback;
  console.error("[api/admin/vehicles/[id]]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Assign or unassign. Moving the bakkie clears it from the previous driver. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    const parsed = sanitizeVehicleAssign(await request.json().catch(() => null));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await connectDB();
    const existing = await Vehicle.findOne({ id }).lean();
    if (!existing) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    if (parsed.assignedDriverId) {
      const driver = await Driver.findOne({ id: parsed.assignedDriverId }).lean();
      if (!driver || driver.isActive === false) {
        return NextResponse.json(
          { error: "Driver not found or inactive" },
          { status: 400 }
        );
      }
      const tech = await User.findOne({
        role: "technician",
        driverProfileId: parsed.assignedDriverId,
      })
        .select("disabledAt isActive")
        .lean();
      if (tech && accountIsDisabled(tech)) {
        return NextResponse.json(
          { error: "Driver not found or inactive" },
          { status: 400 }
        );
      }
    }

    const vehicle = await persistVehicleAssignment(id, parsed.assignedDriverId);
    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
    return NextResponse.json({ vehicle });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: "That driver already has a vehicle" },
        { status: 409 }
      );
    }
    return jsonError(err, "Failed to update vehicle");
  }
}
