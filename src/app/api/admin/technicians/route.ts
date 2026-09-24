import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import {
  createTechnicianBodySchema,
  shouldGenerateTechnicianPassword,
} from "@/lib/createTechnician";
import { generateTemporaryPassword } from "@/lib/temporaryPassword";
import { toTechnicianRow } from "@/lib/technicianRow";
import { overlayDriverVehicle, vehiclesByDriverId } from "@/lib/vehicleStore";

function jsonError(err: unknown, fallback: string) {
  if (isHttpError(err)) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : fallback;
  console.error("[api/admin/technicians]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    await requireFullAdmin();
    await connectDB();

    const techs = await User.find({ role: "technician" })
      .sort({ name: 1, email: 1 })
      .lean();

    const driverIds = techs
      .map((t) => t.driverProfileId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const drivers = driverIds.length
      ? await Driver.find({ id: { $in: driverIds } }).lean()
      : [];
    const driverById = new Map(
      drivers.map((d) => [d.id as string, d as Record<string, unknown>])
    );
    const currentVehicles = await vehiclesByDriverId(driverIds);

    return NextResponse.json({
      technicians: techs.map((t) => {
        const profileId =
          typeof t.driverProfileId === "string" ? t.driverProfileId : "";
        const driver = profileId ? driverById.get(profileId) ?? null : null;
        return toTechnicianRow(
          t as Record<string, unknown>,
          driver
            ? overlayDriverVehicle(driver, currentVehicles.get(profileId))
            : null
        );
      }),
    });
  } catch (err) {
    return jsonError(err, "Failed to list technicians");
  }
}

export async function POST(request: Request) {
  try {
    await requireFullAdmin();
    const json: unknown = await request.json();
    const parsed = createTechnicianBodySchema.safeParse(json);
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message || "Invalid technician details";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const body = parsed.data;
    await connectDB();

    const existing = await User.findOne({ email: body.email });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const generate = shouldGenerateTechnicianPassword(body);
    const plaintext = generate
      ? generateTemporaryPassword()
      : String(body.password);
    const passwordHash = await bcrypt.hash(plaintext, 10);

    const driverProfileId = `driver_${randomBytes(4).toString("hex")}`;
    const driver = await Driver.create({
      id: driverProfileId,
      name: body.name,
      phone: body.phone,
      email: body.email,
      isActive: true,
    });
    const createdDriver = driver.toObject() as Record<string, unknown>;

    const user = await User.create({
      email: body.email,
      passwordHash,
      name: body.name,
      phone: body.phone,
      role: "technician",
      adminTier: null,
      driverProfileId,
      emailVerifiedAt: null,
      emailVerified: false,
      disabledAt: null,
      isActive: true,
      mustChangePassword: true,
    });

    return NextResponse.json(
      {
        user: toTechnicianRow(
          {
            ...(user.toObject() as Record<string, unknown>),
            _id: user._id,
          },
          createdDriver
        ),
        temporaryPassword: generate ? plaintext : undefined,
      },
      { status: 201 }
    );
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    return jsonError(err, "Failed to create technician");
  }
}
