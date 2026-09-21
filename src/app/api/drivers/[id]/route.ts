import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import { toClientDriver } from "@/lib/serialize";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import { sanitizeDriverPatch, technicianLoginFields } from "@/lib/driverProfile";

type Params = { params: Promise<{ id: string }> };

function jsonError(err: unknown, fallback: string) {
  if (isHttpError(err)) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : fallback;
  console.error("[api/drivers/[id]]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Full admin only — driver PII is never public. Lookup by business id only. */
export async function GET(_request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    await connectDB();

    const driver = await Driver.findOne({ id }).lean();
    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    const row = toClientDriver(driver as Record<string, unknown>) as {
      id?: string;
      phone?: string;
      [key: string]: unknown;
    };
    if (!row.phone?.trim()) {
      const tech = await User.findOne({
        role: "technician",
        driverProfileId: id,
      })
        .select("phone")
        .lean();
      if (typeof tech?.phone === "string" && tech.phone.trim()) {
        row.phone = tech.phone.trim();
      }
    }

    return NextResponse.json(row);
  } catch (err) {
    return jsonError(err, "Failed to fetch driver");
  }
}

/** Full admin only. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    const parsed = sanitizeDriverPatch(await request.json().catch(() => null));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await connectDB();
    const driver = await Driver.findOneAndUpdate(
      { id },
      { $set: parsed.updates },
      { new: true, runValidators: true }
    ).lean();

    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    if (typeof parsed.updates.isActive === "boolean") {
      await User.updateMany(
        { role: "technician", driverProfileId: id },
        { $set: technicianLoginFields(parsed.updates.isActive) }
      );
    }

    return NextResponse.json(toClientDriver(driver as Record<string, unknown>));
  } catch (err) {
    return jsonError(err, "Failed to update driver");
  }
}
