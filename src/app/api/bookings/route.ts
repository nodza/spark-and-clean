import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Coupon } from "@/models/Coupon";
import { getSession } from "@/lib/session";
import {
  COUPON_APPLY_FIELDS,
  COUPON_CODE_PATTERN,
  UNKNOWN_COUPON_MESSAGE,
  couponApplyError,
  normalizeCouponCode,
} from "@/lib/coupon";
import { toClientBooking } from "@/lib/serialize";
import { createNewBookingAlert } from "@/lib/createNewBookingAlert";
import { confirmCouponQuote } from "@/lib/promotion/confirmCoupon";
import { isClientRole, isFullAccount, isPersistedClient } from "@/types/user";

export async function GET() {
  try {
    await connectDB();
    const session = await getSession();

    // Guests / leftover guest JWTs cannot list bookings by email.
    if (!session || !isFullAccount(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const filter: Record<string, unknown> = {};

    if (isPersistedClient(session)) {
      filter.$or = [
        { userId: session.id },
        { "customer.email": session.email.toLowerCase() },
      ];
    } else if (session.role === "technician") {
      // Fail closed: no driverProfileId must never mean "all bookings".
      if (!session.driverProfileId) {
        return NextResponse.json([]);
      }
      filter.assignedDriverId = session.driverProfileId;
    } else if (session.role === "admin") {
      // Operations booking list — full admin only (marketing-only denied)
      if (session.adminTier === "marketing-only") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // empty filter = all bookings
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const docs = await Booking.find(filter)
      // Admin list default: newest createdAt. Client list may re-sort by collectionDate.
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json(
      docs.map((d) => toClientBooking(d as Record<string, unknown>))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch bookings";
    console.error("[api/bookings GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const session = await getSession();
    const body = await request.json();

    const id =
      body.id ||
      `SC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0")}`;

    const couponRaw =
      typeof body.couponCode === "string" ? body.couponCode.trim() : "";
    let couponCode = "";
    let couponMax: number | null = null;
    let confirmed: ReturnType<typeof confirmCouponQuote> | null = null;
    if (couponRaw) {
      couponCode = normalizeCouponCode(couponRaw);
      if (!COUPON_CODE_PATTERN.test(couponCode)) {
        return NextResponse.json(
          { error: UNKNOWN_COUPON_MESSAGE },
          { status: 400 }
        );
      }
      const coupon = await Coupon.findOne({ code: couponCode })
        .select(`${COUPON_APPLY_FIELDS} type value`)
        .lean();
      const city = typeof body.city === "string" ? body.city : null;
      const applyError = couponApplyError(coupon, { city });
      if (applyError || !coupon) {
        return NextResponse.json(
          { error: applyError ?? UNKNOWN_COUPON_MESSAGE },
          { status: 400 }
        );
      }
      const type =
        coupon.type === "PERCENT" || coupon.type === "FIXED_CENTS"
          ? coupon.type
          : null;
      const value = typeof coupon.value === "number" ? coupon.value : NaN;
      if (!type || !Number.isFinite(value)) {
        return NextResponse.json(
          { error: UNKNOWN_COUPON_MESSAGE },
          { status: 400 }
        );
      }
      couponMax =
        typeof coupon.maxRedemptions === "number" &&
        Number.isInteger(coupon.maxRedemptions)
          ? coupon.maxRedemptions
          : null;
      const rug =
        body.rug && typeof body.rug === "object" && !Array.isArray(body.rug)
          ? body.rug
          : null;
      const addOns =
        body.addOns &&
        typeof body.addOns === "object" &&
        !Array.isArray(body.addOns)
          ? body.addOns
          : null;
      confirmed = confirmCouponQuote({
        couponId: String(coupon._id),
        code: couponCode,
        coupon: { type, value },
        rug,
        addOns,
      });
    }

    const rest = { ...(body as Record<string, unknown>) };
    delete rest.userId;
    delete rest.notes;
    delete rest.fieldMessages;
    delete rest.fieldThreadReadAt;
    delete rest.couponHoldId;
    delete rest.promotion;
    delete rest.paymentStatus;
    delete rest.billing;

    const payload: Record<string, unknown> = {
      ...rest,
      id,
      createdAt: body.createdAt || new Date().toISOString(),
      customer: {
        ...body.customer,
        email: body.customer?.email?.toLowerCase?.() ?? body.customer?.email,
      },
    };

    if (confirmed) {
      payload.couponCode = confirmed.promotion.code;
      payload.promotion = confirmed.promotion;
      payload.estimatedPriceMin = confirmed.estimatedPriceMin;
      payload.estimatedPriceMax = confirmed.estimatedPriceMax;
      if (
        payload.rug &&
        typeof payload.rug === "object" &&
        !Array.isArray(payload.rug)
      ) {
        payload.rug = {
          ...(payload.rug as Record<string, unknown>),
          areaSqM: confirmed.areaSqM,
        };
      }
    }

    // Only a full client session may stamp userId. Guests stay unclaimed.
    if (session && isFullAccount(session) && isClientRole(session.role)) {
      payload.userId = session.id;
    }

    const existingBefore = await Booking.findOne({ id })
      .select("_id couponCode")
      .lean();
    const previousCode =
      existingBefore &&
      typeof (existingBefore as { couponCode?: unknown }).couponCode === "string"
        ? (existingBefore as { couponCode: string }).couponCode
        : "";

    if (!existingBefore) {
      payload.paymentStatus = "UNPAID";
    }

    let claimedCode: string | null = null;
    if (couponCode && previousCode !== couponCode) {
      const claimFilter: Record<string, unknown> = { code: couponCode };
      if (couponMax != null) claimFilter.redeemedCount = { $lt: couponMax };
      const claimed = await Coupon.findOneAndUpdate(claimFilter, {
        $inc: { redeemedCount: 1 },
      });
      if (!claimed) {
        const used = couponMax ?? 0;
        return NextResponse.json(
          { error: `This coupon has been fully used (${used}/${used})` },
          { status: 400 }
        );
      }
      claimedCode = couponCode;
    }
    if (previousCode && previousCode !== couponCode) {
      await Coupon.updateOne(
        { code: previousCode, redeemedCount: { $gt: 0 } },
        { $inc: { redeemedCount: -1 } }
      );
    }

    const update: {
      $set: Record<string, unknown>;
      $unset?: { promotion: 1 };
    } = { $set: payload };
    if (!confirmed) {
      update.$unset = { promotion: 1 };
    }

    let created;
    try {
      created = await Booking.findOneAndUpdate(
        { id },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();
    } catch (writeErr) {
      if (claimedCode) {
        await Coupon.updateOne(
          { code: claimedCode, redeemedCount: { $gt: 0 } },
          { $inc: { redeemedCount: -1 } }
        );
      }
      if (previousCode && previousCode !== couponCode) {
        await Coupon.updateOne({ code: previousCode }, { $inc: { redeemedCount: 1 } });
      }
      throw writeErr;
    }

    const clientBooking = toClientBooking(created as Record<string, unknown>);

    // In-app ops alert only on create — no WhatsApp / SMS / email.
    if (!existingBefore) {
      try {
        await createNewBookingAlert({
          id: clientBooking.id,
          customer: clientBooking.customer,
          suburb: clientBooking.suburb,
        });
      } catch (alertErr) {
        console.error(
          "[api/bookings POST] ops alert failed",
          alertErr instanceof Error ? alertErr.message : alertErr
        );
      }
    }

    return NextResponse.json(clientBooking);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create booking";
    console.error("[api/bookings POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
