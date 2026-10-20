import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Coupon } from "@/models/Coupon";
import { isHttpError, requireAdmin } from "@/lib/adminAuth";
import { toPublicApiError } from "@/lib/publicApiError";
import {
  DUPLICATE_COUPON_MESSAGE,
  isDuplicateCouponCode,
  sanitizeCouponActivePatch,
  sanitizeCouponEditPatch,
  toClientCoupon,
} from "@/lib/coupon";

type Params = { params: Promise<{ id: string }> };

function jsonError(err: unknown, fallback: string) {
  if (isHttpError(err)) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (isDuplicateCouponCode(err)) {
    return NextResponse.json(
      { error: DUPLICATE_COUPON_MESSAGE },
      { status: 409 }
    );
  }
  console.error("[api/coupons/[id]]", err);
  return NextResponse.json(
    { error: toPublicApiError(err, fallback) },
    { status: 500 }
  );
}

/** Update a coupon or turn it on/off. Full and marketing-only admins. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const activeOnly =
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      Object.keys(body).every((key) => key === "active");

    await connectDB();
    if (activeOnly) {
      const parsed = sanitizeCouponActivePatch(body);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const updated = await Coupon.findByIdAndUpdate(
        id,
        { $set: { active: parsed.active } },
        { new: true, runValidators: true }
      ).lean();
      if (!updated) {
        return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
      }
      return NextResponse.json(
        { coupon: toClientCoupon(updated as Record<string, unknown>) },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const parsed = sanitizeCouponEditPatch(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const current = await Coupon.findById(id).lean();
    if (!current) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }
    const codeChanged = parsed.coupon.code !== current.code;
    if (codeChanged && Number(current.redeemedCount) > 0) {
      return NextResponse.json(
        { error: "Coupon code cannot be changed after it has been used" },
        { status: 409 }
      );
    }

    const filter: Record<string, unknown> = { _id: id };
    if (codeChanged) filter.redeemedCount = 0;
    const updated = await Coupon.findOneAndUpdate(
      filter,
      { $set: parsed.coupon },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) {
      return NextResponse.json(
        {
          error: codeChanged
            ? "Coupon code cannot be changed after it has been used"
            : "Coupon not found",
        },
        { status: codeChanged ? 409 : 404 }
      );
    }

    return NextResponse.json(
      { coupon: toClientCoupon(updated as Record<string, unknown>) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return jsonError(err, "Failed to update coupon");
  }
}

/** Delete an unused coupon. Full and marketing-only admins. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    await connectDB();
    const deleteFilter: Record<string, unknown> = {
      _id: id,
      redeemedCount: 0,
    };
    const deleted = await Coupon.findOneAndDelete(deleteFilter).lean();
    if (!deleted) {
      const current = await Coupon.findById(id).lean();
      if (!current) {
        return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Used coupons cannot be deleted" },
        { status: 409 }
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return jsonError(err, "Failed to delete coupon");
  }
}
