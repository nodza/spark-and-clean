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
  couponClaimOwner,
  normalizeCouponCode,
} from "@/lib/coupon";
import { toClientBooking } from "@/lib/serialize";
import { createNewBookingAlert } from "@/lib/createNewBookingAlert";
import { confirmBookingQuote } from "@/lib/promotion/confirmCoupon";
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

    // Create-only: never overwrite an existing booking (blocks coupon inventory attacks).
    const existingBefore = await Booking.findOne({ id }).select("_id").lean();
    if (existingBefore) {
      return NextResponse.json(
        { error: "A booking with this id already exists" },
        { status: 409 }
      );
    }

    const couponRaw =
      typeof body.couponCode === "string" ? body.couponCode.trim() : "";
    let couponCode = "";
    let couponMax: number | null = null;
    let claimOwner: { ownerUserId: string | null } | null = null;
    let couponForQuote: {
      couponId: string;
      code: string;
      coupon: { type: "PERCENT" | "FIXED_CENTS"; value: number };
    } | null = null;

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
      const userId = session && isPersistedClient(session) ? session.id : null;
      const applyError = couponApplyError(coupon, { city, userId });
      if (applyError || !coupon) {
        return NextResponse.json(
          { error: applyError ?? UNKNOWN_COUPON_MESSAGE },
          { status: 400 }
        );
      }
      const ownerClaim = couponClaimOwner(coupon, userId);
      if (!ownerClaim) {
        return NextResponse.json(
          { error: UNKNOWN_COUPON_MESSAGE },
          { status: 400 }
        );
      }
      claimOwner = ownerClaim;
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
      couponForQuote = {
        couponId: String(coupon._id),
        code: couponCode,
        coupon: { type, value },
      };
    }

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

    const quoted = confirmBookingQuote({
      coupon: couponForQuote,
      rug,
      addOns,
    });
    if ("error" in quoted) {
      return NextResponse.json({ error: quoted.error }, { status: 400 });
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
    delete rest.couponCode;
    delete rest.estimatedPriceMin;
    delete rest.estimatedPriceMax;

    const payload: Record<string, unknown> = {
      ...rest,
      id,
      createdAt: body.createdAt || new Date().toISOString(),
      paymentStatus: "UNPAID",
      estimatedPriceMin: quoted.estimatedPriceMin,
      estimatedPriceMax: quoted.estimatedPriceMax,
      customer: {
        ...body.customer,
        email: body.customer?.email?.toLowerCase?.() ?? body.customer?.email,
      },
    };

    if (
      payload.rug &&
      typeof payload.rug === "object" &&
      !Array.isArray(payload.rug)
    ) {
      payload.rug = {
        ...(payload.rug as Record<string, unknown>),
        areaSqM: quoted.areaSqM,
      };
    }

    if (quoted.promotion) {
      payload.couponCode = quoted.promotion.code;
      payload.promotion = quoted.promotion;
    }

    // Only a full client session may stamp userId. Guests stay unclaimed.
    if (session && isFullAccount(session) && isClientRole(session.role)) {
      payload.userId = session.id;
    }

    let claimedCode: string | null = null;
    if (couponCode) {
      if (!claimOwner) {
        return NextResponse.json(
          { error: UNKNOWN_COUPON_MESSAGE },
          { status: 400 }
        );
      }
      const claimFilter: Record<string, unknown> = {
        code: couponCode,
        ownerUserId: claimOwner.ownerUserId,
      };
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

    let created;
    try {
      created = await Booking.create(payload);
    } catch (writeErr) {
      if (claimedCode) {
        await Coupon.updateOne(
          { code: claimedCode, redeemedCount: { $gt: 0 } },
          { $inc: { redeemedCount: -1 } }
        );
      }
      if (
        writeErr &&
        typeof writeErr === "object" &&
        "code" in writeErr &&
        (writeErr as { code?: unknown }).code === 11000
      ) {
        return NextResponse.json(
          { error: "A booking with this id already exists" },
          { status: 409 }
        );
      }
      throw writeErr;
    }

    const clientBooking = toClientBooking(
      created.toObject() as Record<string, unknown>
    );

    // In-app ops alert only on create — no WhatsApp / SMS / email.
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

    return NextResponse.json(clientBooking);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create booking";
    console.error("[api/bookings POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
