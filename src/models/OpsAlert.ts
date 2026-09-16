import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const OpsAlertSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ["NEW_BOOKING"],
      index: true,
    },
    bookingId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    meta: { type: String, required: true, trim: true },
    /** Set when any admin dismisses — shared across admins / refresh */
    dismissedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: "ops_alerts",
  }
);

export type OpsAlertDocument = InferSchemaType<typeof OpsAlertSchema> & {
  _id: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const OpsAlert: Model<OpsAlertDocument> =
  (models.OpsAlert as Model<OpsAlertDocument>) ||
  model<OpsAlertDocument>("OpsAlert", OpsAlertSchema);
