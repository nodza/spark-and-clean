import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Coupon } from "@/models/Coupon";
import {
  COUPON_APPLY_FIELDS,
  COUPON_CODE_PATTERN,
  couponApplyError,
  normalizeCouponCode,
  type CouponType,
} from "@/lib/coupon";
import { applyCoupon } from "@/lib/promotion/applyCoupon";
import { toPublicApiError } from "@/lib/publicApiError";
import { getSession } from "@/lib/session";
import { isPersistedClient } from "@/types/user";

function readEstimate(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

/**
 * Quote a coupon against an estimate that already includes add-ons.
 * Catalogue codes stay public so a guest can see the discounted price before booking.
 * A personal loyalty code is quoted only for the client who owns it.
 * This does not count a redemption. A use is counted only when a booking is saved.
 * Usage counts are not returned (admin-only via the catalogue API).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const raw =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    if (!raw || typeof raw.code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }
    const code = normalizeCouponCode(raw.code);
    if (!COUPON_CODE_PATTERN.test(code)) {
      return NextResponse.json(
        { error: "Invalid coupon format" },
        { status: 400 }
      );
    }

    const estimateMin = readEstimate(raw.estimateMin);
    const estimateMax = readEstimate(raw.estimateMax);
    if (estimateMin == null || estimateMax == null) {
      return NextResponse.json(
        { error: "Estimate is required" },
        { status: 400 }
      );
    }

    const city = typeof raw.city === "string" ? raw.city : null;

    await connectDB();
    const session = await getSession();
    const userId = session && isPersistedClient(session) ? session.id : null;
    const doc = await Coupon.findOne({ code })
      .select(`${COUPON_APPLY_FIELDS} type value`)
      .lean();
    const applyError = couponApplyError(doc, { city, userId });
    if (applyError || !doc) {
      return NextResponse.json(
        { error: applyError ?? "That coupon code isn't valid" },
        { status: 400 }
      );
    }

    const type: CouponType | null =
      doc.type === "PERCENT" || doc.type === "FIXED_CENTS" ? doc.type : null;
    const value = typeof doc.value === "number" ? doc.value : NaN;
    if (!type || !Number.isFinite(value)) {
      return NextResponse.json(
        { error: "That coupon code isn't valid" },
        { status: 400 }
      );
    }

    const applied = applyCoupon({ type, value }, estimateMin, estimateMax);
    return NextResponse.json(
      {
        code,
        type,
        value,
        discountCents: applied.discountCents,
        estimateMin: applied.estimateMin,
        estimateMax: applied.estimateMax,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[api/coupons/preview]", err);
    return NextResponse.json(
      { error: toPublicApiError(err, "Failed to check coupon") },
      { status: 500 }
    );
  }
}
