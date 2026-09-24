import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import { toClientDriver } from "@/lib/serialize";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import { toTechnicianRow } from "@/lib/technicianRow";
import { overlayDriverVehicle, vehiclesByDriverId } from "@/lib/vehicleStore";

type Params = { params: Promise<{ id: string }> };

/** Full admin only. User id is the technicians directory key. */
export async function GET(_request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    await connectDB();
    const user = isValidObjectId(id)
      ? await User.findById(id).lean()
      : await User.findOne({ driverProfileId: id, role: "technician" }).lean();
    if (user && user.role !== "technician") {
      return NextResponse.json({ error: "Technician not found" }, { status: 404 });
    }
    if (!user) {
      return NextResponse.json({ error: "Technician not found" }, { status: 404 });
    }

    const profileId =
      typeof user.driverProfileId === "string" ? user.driverProfileId : "";
    const driver = profileId
      ? await Driver.findOne({ id: profileId }).lean()
      : null;
    const current = profileId
      ? (await vehiclesByDriverId([profileId])).get(profileId)
      : undefined;
    const driverRow = driver
      ? overlayDriverVehicle(
          toClientDriver(driver as Record<string, unknown>) as Record<
            string,
            unknown
          >,
          current
        )
      : null;

    return NextResponse.json({
      technician: toTechnicianRow(
        user as Record<string, unknown>,
        driverRow
      ),
      driver: driverRow,
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to fetch technician";
    console.error("[api/admin/technicians/[id] GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
