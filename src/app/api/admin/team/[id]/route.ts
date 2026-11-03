import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import type { ClientSession } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { HttpError, isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import {
  adminAccountIsActive,
  guardAdminTeamChange,
  otherActiveFullAdminFilter,
  toAdminTeamMember,
} from "@/lib/adminTeam";
import { runInTransaction } from "@/lib/promotion/runInTransaction";
import { ADMIN_TIERS, normalizeUserRole, type AdminTier } from "@/types/user";

type Params = { params: Promise<{ id: string }> };

const patchAdminBodySchema = z
  .object({
    adminTier: z.enum(ADMIN_TIERS).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => value.adminTier !== undefined || value.active !== undefined, {
    message: "Provide a tier or an active status.",
  });

function jsonError(err: unknown, fallback: string) {
  if (isHttpError(err)) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : fallback;
  console.error("[api/admin/team/[id]]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Full admin only. Change tier, or deactivate / reactivate. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const actor = await requireFullAdmin();
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    const json: unknown = await request.json();
    const parsed = patchAdminBodySchema.safeParse(json);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || "Invalid admin update";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    await connectDB();
    const admin = await runInTransaction((dbSession) =>
      applyAdminChange(actor.id, id, parsed.data, dbSession)
    );

    return NextResponse.json({ admin });
  } catch (err) {
    return jsonError(err, "Failed to update admin");
  }
}

async function readWithSession<T>(
  query: T,
  dbSession: ClientSession
): Promise<unknown> {
  if (
    query !== null &&
    typeof query === "object" &&
    "session" in query &&
    typeof (query as { session?: unknown }).session === "function"
  ) {
    return (query as { session: (s: ClientSession) => Promise<unknown> }).session(
      dbSession
    );
  }
  return query;
}

async function applyAdminChange(
  actorId: string,
  id: string,
  data: { adminTier?: AdminTier; active?: boolean },
  dbSession: ClientSession
) {
  const user = (await readWithSession(User.findById(id), dbSession)) as {
    _id: { toString(): string };
    name?: unknown;
    email?: unknown;
    role?: unknown;
    adminTier?: AdminTier | null;
    disabledAt?: Date | null;
    isActive?: boolean | null;
    sessionsInvalidatedAt?: Date | null;
    save: (options?: { session?: ClientSession }) => Promise<unknown>;
  } | null;

  if (!user || normalizeUserRole(user.role) !== "admin") {
    throw new HttpError(404, "Admin not found");
  }

  const currentTier: AdminTier | null =
    user.adminTier === "full" || user.adminTier === "marketing-only"
      ? user.adminTier
      : null;
  if (!currentTier) {
    throw new HttpError(404, "Admin not found");
  }

  const currentActive = adminAccountIsActive(user);
  const nextTier = data.adminTier ?? currentTier;
  const nextActive = data.active ?? currentActive;
  const removesActiveFull =
    currentTier === "full" &&
    currentActive &&
    !(nextActive && nextTier === "full");

  if (removesActiveFull) {
    await readWithSession(
      User.updateMany(
        {
          role: { $in: ["admin", "ADMIN"] },
          adminTier: "full",
          disabledAt: null,
          isActive: { $ne: false },
        },
        { $currentDate: { updatedAt: true } }
      ),
      dbSession
    );
  }

  const otherActiveFullAdmins = Number(
    await readWithSession(
      User.countDocuments(otherActiveFullAdminFilter(String(user._id)) as never),
      dbSession
    )
  );
  const blocked = guardAdminTeamChange({
    actorId,
    targetId: String(user._id),
    currentTier,
    currentActive,
    nextTier,
    nextActive,
    otherActiveFullAdmins,
  });
  if (blocked) {
    throw new HttpError(409, blocked);
  }

  const tierChanged = nextTier !== currentTier;
  const deactivating = currentActive && !nextActive;
  const reactivating = !currentActive && nextActive;

  if (tierChanged) {
    user.adminTier = nextTier;
  }
  if (deactivating) {
    user.disabledAt = new Date();
    user.isActive = false;
  }
  if (reactivating) {
    user.isActive = true;
    user.disabledAt = null;
  }
  if (tierChanged || deactivating) {
    user.sessionsInvalidatedAt = new Date();
  }
  await user.save({ session: dbSession });

  return toAdminTeamMember({
    _id: user._id,
    name: user.name,
    email: user.email,
    adminTier: user.adminTier,
    disabledAt: user.disabledAt,
    isActive: user.isActive,
  });
}
