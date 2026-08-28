import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import {
  SERVICE_CITIES,
  USER_ROLES,
  type ServiceCity,
  type UserRole,
} from "@/types/user";

export type { ServiceCity, UserRole };
export { SERVICE_CITIES, USER_ROLES };

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
    /** Punch-card: completed cleans toward a reward */
    punches: { type: Number, default: 0, min: 0 },
    rewardsRedeemed: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

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
    /** bcrypt/argon2 hash — never store plaintext passwords */
    passwordHash: { type: String, select: false },
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "CUSTOMER",
      index: true,
    },
    preferredCity: {
      type: String,
      enum: SERVICE_CITIES,
    },
    addresses: { type: [AddressSchema], default: [] },
    loyalty: { type: LoyaltySchema, default: () => ({}) },
    marketingOptIn: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    /**
     * Optional link to Driver collection (`drivers.id`) for DRIVER role users.
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

UserSchema.index({ role: 1, preferredCity: 1 });

export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const User: Model<UserDocument> =
  (models.User as Model<UserDocument>) || model<UserDocument>("User", UserSchema);
