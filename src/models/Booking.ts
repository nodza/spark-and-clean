import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import type { BookingStatus, PaymentStatus } from "@/types/booking";

const BOOKING_STATUSES: BookingStatus[] = [
  "BOOKED",
  "SCHEDULED",
  "COLLECTED",
  "CLEANING",
  "DRYING",
  "READY",
  "DELIVERED",
];

const PAYMENT_STATUSES: PaymentStatus[] = ["UNPAID", "DEPOSIT", "PAID"];

const CustomerSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
  },
  { _id: false }
);

const RugSchema = new Schema(
  {
    type: { type: String, required: true, trim: true },
    widthM: { type: Number, default: null },
    lengthM: { type: Number, default: null },
    areaSqM: { type: Number, required: true },
    photos: { type: [String], default: [] },
    labelPhotos: { type: [String], default: [] },
  },
  { _id: false }
);

const CoordinatesSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false }
);

const AddOnsSchema = new Schema(
  {
    stainTreatment: { type: Boolean, default: false },
    fabricProtection: { type: Boolean, default: false },
  },
  { _id: false }
);

const BookingSchema = new Schema(
  {
    /** Business booking reference, e.g. SC-2025-0001 */
    id: { type: String, required: true, unique: true, index: true },
    /**
     * Registered client User._id. Guests keep denormalised customer.email only.
     */
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      sparse: true,
    },
    customer: { type: CustomerSchema, required: true },
    suburb: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true, index: true },
    coordinates: { type: CoordinatesSchema },
    collectionDate: { type: String, required: true },
    collectionSlot: {
      type: String,
      enum: ["MORNING", "AFTERNOON"],
      required: true,
    },
    rug: { type: RugSchema, required: true },
    addOns: { type: AddOnsSchema, default: () => ({}) },
    estimatedPriceMin: { type: Number, required: true },
    estimatedPriceMax: { type: Number, required: true },
    couponCode: { type: String, trim: true },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: "BOOKED",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "UNPAID",
      index: true,
    },
    assignedDriverId: { type: String, trim: true, index: true, sparse: true },
    createdAt: { type: String, required: true },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: "bookings",
  }
);

BookingSchema.index({ "customer.email": 1, status: 1 });

export type BookingDocument = InferSchemaType<typeof BookingSchema> & {
  _id: Schema.Types.ObjectId;
};

export const Booking: Model<BookingDocument> =
  (
    models.Booking as Model<BookingDocument>
  ) ||
  model<BookingDocument>(
    "Booking", BookingSchema
  );
