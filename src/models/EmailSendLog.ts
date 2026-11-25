import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * One row per outbound email attempt. `dedupeKey` is unique so the same
 * customer event cannot be sent twice. SCW-116 (admin and driver mail)
 * should reuse this collection with its own keys.
 */
const EmailSendLogSchema = new Schema(
  {
    dedupeKey: { type: String, required: true, unique: true, index: true },
    kind: { type: String, required: true, trim: true, index: true },
    bookingId: { type: String, trim: true, index: true },
    to: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "sent", "logged", "failed"],
      required: true,
      index: true,
    },
    error: { type: String, trim: true },
  },
  {
    timestamps: true,
    collection: "email_send_logs",
  }
);

export type EmailSendLogDocument = InferSchemaType<typeof EmailSendLogSchema> & {
  _id: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

if (models.EmailSendLog) {
  delete models.EmailSendLog;
}

export const EmailSendLog: Model<EmailSendLogDocument> =
  model<EmailSendLogDocument>("EmailSendLog", EmailSendLogSchema);
