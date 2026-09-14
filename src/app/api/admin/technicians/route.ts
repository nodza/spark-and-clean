import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import { toClientUser } from "@/lib/serialize";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import {
  createTechnicianBodySchema,
  shouldGenerateTechnicianPassword,
} from "@/lib/createTechnician";
import { generateTemporaryPassword } from "@/lib/temporaryPassword";

function authError(err: unknown) {
  if (isHttpError(err)) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
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
    const vehicleByDriver = new Map(
      drivers.map((d) => [d.id, d.vehicle as string | undefined])
    );

    return NextResponse.json({
      technicians: techs.map((t) => {
        const user = toClientUser(t as Record<string, unknown>);
        const vehicle = t.driverProfileId
          ? vehicleByDriver.get(t.driverProfileId) ?? null
          : null;
        return { ...user, vehicle };
      }),
    });
  } catch (err) {
    if (isHttpError(err)) return authError(err);
    const message = err instanceof Error ? err.message : "Failed to list technicians";
    console.error("[api/admin/technicians GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
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

    let driverProfileId: string | undefined;
    const vehicle = body.vehicle?.trim();
    if (vehicle) {
      driverProfileId = `driver_${randomBytes(4).toString("hex")}`;
      await Driver.create({
        id: driverProfileId,
        name: body.name,
        vehicle,
        phone: body.phone,
        email: body.email,
        isActive: true,
      });
    }

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

    const clientUser = {
      ...toClientUser({
        ...(user.toObject() as Record<string, unknown>),
        _id: user._id,
      }),
      vehicle: vehicle || null,
    };

    return NextResponse.json(
      {
        user: clientUser,
        temporaryPassword: generate ? plaintext : undefined,
      },
      { status: 201 }
    );
  } catch (err) {
    if (isHttpError(err)) return authError(err);
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
    const message = err instanceof Error ? err.message : "Failed to create technician";
    console.error("[api/admin/technicians POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
