import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const NOTIFICATION_RESULTS = ["sent", "skipped", "failed"] as const;
export type NotificationResult = (typeof NOTIFICATION_RESULTS)[number];

const NotificationAttemptSchema = new Schema(
  {
    bookingId: { type: String, required: true, trim: true },
    status: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    claimKey: { type: String, default: undefined },
    claimState: { type: String, enum: ["pending", "complete"], default: undefined },
    result: { type: String, enum: NOTIFICATION_RESULTS, required: true },
    providerMessageId: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "notificationAttempts",
  }
);

NotificationAttemptSchema.index(
  { bookingId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { result: "sent" },
  }
);

export type NotificationAttemptDocument = InferSchemaType<
  typeof NotificationAttemptSchema
> & {
  _id: Schema.Types.ObjectId;
};

if (models.NotificationAttempt) {
  delete models.NotificationAttempt;
}

export const NotificationAttempt: Model<NotificationAttemptDocument> = model<NotificationAttemptDocument>(
  "NotificationAttempt",
  NotificationAttemptSchema
);

NotificationAttemptSchema.index({ claimKey: 1 }, { unique: true, sparse: true });