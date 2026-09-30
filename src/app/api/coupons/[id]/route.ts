import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Coupon } from "@/models/Coupon";
import { isHttpError, requireAdmin } from "@/lib/adminAuth";
import { sanitizeCouponActivePatch, toClientCoupon } from "@/lib/coupon";

type Params = { params: Promise<{ id: string }> };

function jsonError(err: unknown, fallback: string) {
  if (isHttpError(err)) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : fallback;
  console.error("[api/coupons/[id]]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Turn a coupon on or off. Full and marketing-only admins. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    const parsed = sanitizeCouponActivePatch(await request.json().catch(() => null));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await connectDB();
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
  } catch (err) {
    return jsonError(err, "Failed to update coupon");
  }
}
