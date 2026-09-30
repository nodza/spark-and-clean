import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Coupon } from "@/models/Coupon";
import {
  COUPON_CODE_PATTERN,
  couponApplyError,
  normalizeCouponCode,
} from "@/lib/coupon";

/**
 * Checkout apply check. Public so a guest can try a code.
 * The code must be an active coupon in the catalogue.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const raw =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).code
        : null;
    if (typeof raw !== "string") {
      return NextResponse.json(
        { valid: false, error: "Code is required" },
        { status: 400 }
      );
    }
    const code = normalizeCouponCode(raw);
    if (!COUPON_CODE_PATTERN.test(code)) {
      return NextResponse.json(
        { valid: false, error: "Invalid coupon format" },
        { status: 400 }
      );
    }

    await connectDB();
    const doc = await Coupon.findOne({ code }).select("active").lean();
    const applyError = couponApplyError(doc);
    if (applyError) {
      return NextResponse.json(
        { valid: false, error: applyError },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { valid: true, code },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to check coupon";
    console.error("[api/coupons/validate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
