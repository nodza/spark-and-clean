import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
} from "@/lib/bookingPatchFields";
import { MAX_NOTE_LEN } from "@/lib/internalNotes";
import { MAX_FIELD_MESSAGE_LEN } from "@/lib/fieldMessages";

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
    tagCode: { type: String, trim: true },
    assetId: { type: Schema.Types.ObjectId, ref: "RugAsset" },
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

const InternalNoteSchema = new Schema(
  {
    id: { type: String, required: true },
    body: { type: String, required: true, trim: true, maxlength: MAX_NOTE_LEN },
    author: { type: String, required: true, trim: true },
    createdAt: { type: String, required: true },
  },
  { _id: false }
);

/**
 * Field channel (tech ↔ ops). Separate from ops-only `notes` so Internal notes
 * stay hidden from the van without a visibleToDriver flag on every note.
 */
const FieldMessageSchema = new Schema(
  {
    id: { type: String, required: true },
    authorRole: {
      type: String,
      enum: ["admin", "technician"],
      required: true,
    },
    authorName: { type: String, required: true, trim: true },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_FIELD_MESSAGE_LEN,
    },
    createdAt: { type: String, required: true },
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
    /** Ops-only internal notes — never exposed on public booking APIs */
    notes: { type: [InternalNoteSchema], default: [] },
    /** Tech ↔ ops field thread — never on customer/public booking payloads */
    fieldMessages: { type: [FieldMessageSchema], default: [] },
    /** When the assigned driver last opened the field thread (inbox unread). */
    fieldThreadReadAt: { type: String, default: null },
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

// Hot reload can keep a stale schema without fieldMessages — strip + re-register.
if (models.Booking) {
  delete models.Booking;
}

export const Booking: Model<BookingDocument> = model<BookingDocument>(
  "Booking",
  BookingSchema
);
