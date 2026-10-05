import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Coupon } from "@/models/Coupon";
import {
  COUPON_APPLY_FIELDS,
  COUPON_CODE_PATTERN,
  COUPON_FULLY_USED_MESSAGE,
  couponApplyError,
  normalizeCouponCode,
  type CouponType,
} from "@/lib/coupon";
import { applyCoupon } from "@/lib/promotion/applyCoupon";
import { toPublicApiError } from "@/lib/publicApiError";

function readEstimate(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

function readCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readMax(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/** Count one apply for this browser hold. The same hold id is a no-op. */
async function recordCouponUse(
  code: string,
  holdId: string,
  maxRedemptions: number | null
): Promise<{ redeemedCount: number } | { error: string }> {
  const cap =
    maxRedemptions != null ? { redeemedCount: { $lt: maxRedemptions } } : {};
  const updated = await Coupon.findOneAndUpdate(
    { code, redemptionHoldId: { $ne: holdId }, ...cap },
    { $inc: { redeemedCount: 1 }, $set: { redemptionHoldId: holdId } },
    { new: true }
  )
    .select("redeemedCount")
    .lean();
  if (updated && typeof updated.redeemedCount === "number") {
    return { redeemedCount: updated.redeemedCount };
  }

  const again = await Coupon.findOne({ code })
    .select("redeemedCount redemptionHoldId")
    .lean();
  if (
    again &&
    again.redemptionHoldId === holdId &&
    typeof again.redeemedCount === "number"
  ) {
    return { redeemedCount: again.redeemedCount };
  }

  const used = maxRedemptions ?? readCount(again?.redeemedCount);
  return { error: `${COUPON_FULLY_USED_MESSAGE} (${used}/${used})` };
}

/**
 * Quote a catalogue coupon against an estimate that already includes add-ons.
 * Public so a guest can see the discounted price before booking.
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
    const holdId =
      typeof raw.holdId === "string" ? raw.holdId.trim().slice(0, 80) : "";
    const recordUse = raw.recordUse === true && holdId.length > 0;

    await connectDB();
    const doc = await Coupon.findOne({ code })
      .select(`${COUPON_APPLY_FIELDS} type value redemptionHoldId`)
      .lean();
    const holdsThis = Boolean(
      holdId && doc && doc.redemptionHoldId === holdId
    );
    const applyError = couponApplyError(doc, { city, holding: holdsThis });
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

    const maxRedemptions = readMax(doc.maxRedemptions);
    let redeemedCount = readCount(doc.redeemedCount);
    if (recordUse && !holdsThis) {
      const recorded = await recordCouponUse(code, holdId, maxRedemptions);
      if ("error" in recorded) {
        return NextResponse.json({ error: recorded.error }, { status: 400 });
      }
      redeemedCount = recorded.redeemedCount;
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
        redeemedCount,
        maxRedemptions,
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
