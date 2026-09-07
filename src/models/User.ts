import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import {
  ADMIN_TIERS,
  SERVICE_CITIES,
  USER_ROLES,
  type AdminTier,
  type ServiceCity,
  type UserRole,
} from "@/types/user";
import { assertRoleTierInvariants } from "@/lib/userValidation";

export type { AdminTier, ServiceCity, UserRole };
export { ADMIN_TIERS, SERVICE_CITIES, USER_ROLES };

const CoordinatesSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false }
);

const AddressSchema = new Schema(
  {
    label: { type: String, trim: true, default: "Home" },
    addressLine1: { type: String, required: true, trim: true },
    suburb: { type: String, trim: true },
    city: {
      type: String,
      enum: SERVICE_CITIES,
      required: true,
    },
    postalCode: { type: String, trim: true },
    coordinates: { type: CoordinatesSchema },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const LoyaltySchema = new Schema(
  {
    punches: { type: Number, default: 0, min: 0 },
    rewardsRedeemed: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/**
 * Persisted User — exactly one role; admins carry adminTier.
 * passwordHash is select:false and stripped in toJSON (never expose via public API).
 */
const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    /** bcrypt hash — never plaintext, never localStorage, never public API */
    passwordHash: { type: String, select: false },
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "client",
      required: true,
      index: true,
    },
    /**
     * Required when role === "admin"; must be null for client/technician.
     */
    adminTier: {
      type: String,
      enum: [...ADMIN_TIERS, null],
      default: null,
      required: false,
    },
    preferredCity: {
      type: String,
      enum: SERVICE_CITIES,
    },
    addresses: { type: [AddressSchema], default: [] },
    loyalty: { type: LoyaltySchema, default: () => ({}) },
    marketingOptIn: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },
    disabledAt: { type: Date, default: null },
    /** @deprecated use emailVerifiedAt */
    emailVerified: { type: Boolean, default: false },
    /** @deprecated use disabledAt === null */
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    /**
     * Technician → Driver profile (`drivers.id`) for vehicle / display name (E5).
     */
    driverProfileId: { type: String, trim: true, index: true, sparse: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

UserSchema.pre("validate", function (next) {
  try {
    const { role, adminTier } = assertRoleTierInvariants({
      role: this.role as UserRole,
      adminTier: (this.adminTier as AdminTier | null | undefined) ?? null,
    });
    this.role = role;
    this.adminTier = adminTier;
    // Keep legacy flags in sync for existing auth queries
    if (this.disabledAt) {
      this.isActive = false;
    } else if (this.isActive === false && !this.disabledAt) {
      this.disabledAt = new Date();
    }
    if (this.emailVerifiedAt && !this.emailVerified) {
      this.emailVerified = true;
    } else if (this.emailVerified && !this.emailVerifiedAt) {
      this.emailVerifiedAt = new Date();
    }
    next();
  } catch (err) {
    next(err instanceof Error ? err : new Error(String(err)));
  }
});

UserSchema.index({ role: 1, preferredCity: 1 });
UserSchema.index({ role: 1, adminTier: 1 });

export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const User: Model<UserDocument> =
  (models.User as Model<UserDocument>) || model<UserDocument>("User", UserSchema);
