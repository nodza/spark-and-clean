import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import { toClientDriver } from "@/lib/serialize";
import { accountIsDisabled, isHttpError, requireFullAdmin } from "@/lib/adminAuth";

/** Treat missing isActive as active (legacy rows). */
const ACTIVE = { $or: [{ isActive: true }, { isActive: { $exists: false } }] };

type DriverOption = { id: string; name: string; vehicle?: string };

/** Active, logged-in technicians only — used by the booking assign dropdown. */
export async function GET() {
  try {
    await requireFullAdmin();
    await connectDB();

    const [docs, techs] = await Promise.all([
      Driver.find(ACTIVE).sort({ name: 1 }).lean(),
      User.find({ role: "technician" }).sort({ name: 1 }).lean(),
    ]);

    const disabledProfileIds = new Set(
      techs
        .filter((tech) => accountIsDisabled(tech))
        .map((tech) => tech.driverProfileId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    );

    const byId = new Map<string, DriverOption>();
    for (const doc of docs) {
      const row = toClientDriver(doc as Record<string, unknown>) as DriverOption;
      if (!row.id || disabledProfileIds.has(row.id)) continue;
      byId.set(row.id, row);
    }

    for (const tech of techs) {
      if (accountIsDisabled(tech)) continue;
      const profileId =
        typeof tech.driverProfileId === "string" && tech.driverProfileId
          ? tech.driverProfileId
          : "";
      if (!profileId) continue;
      const existing = byId.get(profileId);
      const name = String(tech.name || tech.email || profileId);
      if (!existing) {
        byId.set(profileId, {
          id: profileId,
          name,
          vehicle: undefined,
        });
      } else if (!existing.name) {
        existing.name = name;
      }
    }

    const list = [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );

    return NextResponse.json(list);
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to fetch drivers";
    console.error("[api/drivers GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
