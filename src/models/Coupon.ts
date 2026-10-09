import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import {
  COUPON_CODE_PATTERN,
  COUPON_TYPES,
  couponValueError,
  normalizeCouponCode,
  type CouponType,
} from "@/lib/coupon";
import { SERVICE_CITIES, type ServiceCity } from "@/types/user";

/**
 * Marketing coupon catalogue. Checkout will validate codes against this
 * collection. Codes are unique and case-sensitive.
 */
const CouponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: COUPON_TYPES,
      required: true,
    },
    /** PERCENT: 1–100. FIXED_CENTS: positive integer cents. */
    value: { type: Number, required: true },
    active: { type: Boolean, required: true, default: true },
    /** Null means unlimited. */
    maxRedemptions: { type: Number, default: null },
    redeemedCount: { type: Number, required: true, default: 0, min: 0 },
    validFrom: { type: Date, default: null },
    validTo: { type: Date, default: null },
    city: {
      type: String,
      enum: [...SERVICE_CITIES, null],
      default: null,
    },
    /**
     * Personal loyalty reward. Catalogue codes leave this empty.
     * Preview and checkout accept the code only for this user.
     */
    ownerUserId: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "coupons",
  }
);

CouponSchema.pre("validate", function () {
  const code =
    typeof this.code === "string" ? normalizeCouponCode(this.code) : "";
  this.code = code;
  if (!COUPON_CODE_PATTERN.test(code)) {
    this.invalidate("code", "Code must be 2–32 letters or numbers");
  }

  if (this.type === "PERCENT" || this.type === "FIXED_CENTS") {
    const message = couponValueError(this.type, Number(this.value));
    if (message) this.invalidate("value", message);
  }

  if (this.maxRedemptions != null) {
    const max = Number(this.maxRedemptions);
    if (!Number.isInteger(max) || max < 1) {
      this.invalidate(
        "maxRedemptions",
        "Max redemptions must be a positive whole number"
      );
    }
  }

  if (
    this.validFrom instanceof Date &&
    this.validTo instanceof Date &&
    this.validTo.getTime() < this.validFrom.getTime()
  ) {
    this.invalidate("validTo", "Valid to must be on or after valid from");
  }
});

export type CouponDocument = InferSchemaType<typeof CouponSchema> & {
  _id: Schema.Types.ObjectId;
  type: CouponType;
  city?: ServiceCity | null;
  createdAt: Date;
  updatedAt: Date;
};

if (models.Coupon) {
  delete models.Coupon;
}

export const Coupon: Model<CouponDocument> = model<CouponDocument>(
  "Coupon",
  CouponSchema
);
