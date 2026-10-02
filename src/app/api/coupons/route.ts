import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Coupon } from "@/models/Coupon";
import { isHttpError, requireAdmin } from "@/lib/adminAuth";
import { toPublicApiError } from "@/lib/publicApiError";
import {
  DUPLICATE_COUPON_MESSAGE,
  isDuplicateCouponCode,
  sanitizeCouponCreate,
  toClientCoupon,
} from "@/lib/coupon";

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
  console.error("[api/coupons]", err);
  if (
    err &&
    typeof err === "object" &&
    (err as { name?: string }).name === "ValidationError"
  ) {
    return NextResponse.json({ error: "Could not save coupon" }, { status: 400 });
  }
  return NextResponse.json(
    { error: toPublicApiError(err, fallback) },
    { status: 500 }
  );
}

/** Full and marketing-only admins. Clients and technicians receive 403. */
export async function GET() {
  try {
    await requireAdmin();
    await connectDB();
    const docs = await Coupon.find().sort({ createdAt: -1, code: 1 }).lean();
    return NextResponse.json(
      {
        coupons: docs.map((doc) =>
          toClientCoupon(doc as Record<string, unknown>)
        ),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return jsonError(err, "Failed to list coupons");
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const parsed = sanitizeCouponCreate(await request.json().catch(() => null));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await connectDB();

    const existing = await Coupon.findOne({ code: parsed.coupon.code })
      .select("_id")
      .lean();
    if (existing) {
      return NextResponse.json(
        { error: DUPLICATE_COUPON_MESSAGE },
        { status: 409 }
      );
    }

    const created = await Coupon.create({
      ...parsed.coupon,
      redeemedCount: 0,
    });
    const raw =
      typeof created.toObject === "function"
        ? (created.toObject() as Record<string, unknown>)
        : (created as unknown as Record<string, unknown>);

    return NextResponse.json(
      { coupon: toClientCoupon(raw) },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return jsonError(err, "Failed to create coupon");
  }
}
