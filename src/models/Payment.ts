import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const PAYMENT_PROVIDERS = ["stripe", "ozow", "manual", "test"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number] | string;

export const PAYMENT_KINDS = ["DEPOSIT", "BALANCE", "REFUND"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_TRANSFER_STATUSES = [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "REFUNDED",
] as const;
export type PaymentTransferStatus = (typeof PAYMENT_TRANSFER_STATUSES)[number];

/**
 * Ledger row for a provider transfer (Stripe / Ozow / manual).
 * paymentStatus on the booking is derived from succeeded cents vs amount due.
 */
const PaymentSchema = new Schema(
  {
    provider: { type: String, required: true, trim: true, index: true },
    /** Unique at the provider — duplicate inserts are rejected. */
    providerRef: { type: String, required: true, trim: true, unique: true },
    bookingId: { type: String, required: true, trim: true, index: true },
    userId: { type: String, trim: true, index: true, sparse: true },
    kind: {
      type: String,
      enum: PAYMENT_KINDS,
      required: true,
      index: true,
    },
    amountCents: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, trim: true, default: "ZAR" },
    status: {
      type: String,
      enum: PAYMENT_TRANSFER_STATUSES,
      required: true,
      index: true,
    },
    createdAt: { type: String, required: true },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: "payments",
  }
);

PaymentSchema.index({ bookingId: 1, status: 1, kind: 1 });

export type PaymentDocument = InferSchemaType<typeof PaymentSchema> & {
  _id: Schema.Types.ObjectId;
  updatedAt: Date;
};

if (models.Payment) {
  delete models.Payment;
}

export const Payment: Model<PaymentDocument> = model<PaymentDocument>(
  "Payment",
  PaymentSchema
);
