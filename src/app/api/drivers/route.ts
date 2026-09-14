import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import { getSession } from "@/lib/session";
import { toClientDriver } from "@/lib/serialize";

/** Treat missing isActive as active (legacy rows). */
const ACTIVE = { $or: [{ isActive: true }, { isActive: { $exists: false } }] };

type DriverOption = { id: string; name: string; vehicle?: string };

/** Driver directory — full admin operations only. */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "admin" || session.adminTier === "marketing-only") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();

    const [docs, techs] = await Promise.all([
      Driver.find(ACTIVE).sort({ name: 1 }).lean(),
      User.find({
        role: "technician",
        $and: [
          { $or: [{ disabledAt: null }, { disabledAt: { $exists: false } }] },
          ACTIVE,
        ],
      })
        .sort({ name: 1 })
        .lean(),
    ]);

    const byId = new Map<string, DriverOption>();
    for (const doc of docs) {
      const row = toClientDriver(doc as Record<string, unknown>) as DriverOption;
      if (row.id) byId.set(row.id, row);
    }

    for (const tech of techs) {
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
    const message = err instanceof Error ? err.message : "Failed to fetch drivers";
    console.error("[api/drivers GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
