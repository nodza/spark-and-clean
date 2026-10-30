import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import {
  adminAccountIsActive,
  guardAdminTeamChange,
  otherActiveFullAdminFilter,
  toAdminTeamMember,
} from "@/lib/adminTeam";
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
    const user = await User.findById(id);
    if (!user || normalizeUserRole(user.role) !== "admin") {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    const currentTier: AdminTier | null =
      user.adminTier === "full" || user.adminTier === "marketing-only"
        ? user.adminTier
        : null;
    if (!currentTier) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    const currentActive = adminAccountIsActive(user);
    const nextTier = parsed.data.adminTier ?? currentTier;
    const nextActive = parsed.data.active ?? currentActive;

    const otherActiveFullAdmins = await User.countDocuments(
      otherActiveFullAdminFilter(String(user._id)) as never
    );
    const blocked = guardAdminTeamChange({
      actorId: actor.id,
      targetId: String(user._id),
      currentTier,
      currentActive,
      nextTier,
      nextActive,
      otherActiveFullAdmins,
    });
    if (blocked) {
      return NextResponse.json({ error: blocked }, { status: 409 });
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
    // End open sessions so a deactivated or retiered admin cannot keep the old JWT.
    if (tierChanged || deactivating) {
      user.sessionsInvalidatedAt = new Date();
    }
    await user.save();

    const admin = toAdminTeamMember({
      _id: user._id,
      name: user.name,
      email: user.email,
      adminTier: user.adminTier,
      disabledAt: user.disabledAt,
      isActive: user.isActive,
    });

    return NextResponse.json({ admin });
  } catch (err) {
    return jsonError(err, "Failed to update admin");
  }
}
