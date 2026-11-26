import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { WORKSHOP_ACTIVITY_ACTIONS } from "@/types/workshop";

const WorkshopActivitySchema = new Schema(
  {
    bookingId: { type: String, required: true, index: true },
    tagCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    action: {
      type: String,
      enum: WORKSHOP_ACTIVITY_ACTIONS,
      required: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorName: { type: String, required: true, trim: true },
    actorEmail: { type: String, required: true, lowercase: true, trim: true },
    occurredAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { collection: "workshopActivity", versionKey: false }
);

WorkshopActivitySchema.index({ bookingId: 1, occurredAt: -1 });
WorkshopActivitySchema.index({ tagCode: 1, occurredAt: -1 });

export type WorkshopActivityDocument = InferSchemaType<
  typeof WorkshopActivitySchema
> & {
  _id: Schema.Types.ObjectId;
};

if (models.WorkshopActivity) {
  delete models.WorkshopActivity;
}

export const WorkshopActivity: Model<WorkshopActivityDocument> =
  model<WorkshopActivityDocument>("WorkshopActivity", WorkshopActivitySchema);
