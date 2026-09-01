import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const DriverSchema = new Schema(
  {
    /** Stable business id, e.g. driver_1 */
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    vehicle: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true, index: true },
    isActive: { type: Boolean, default: true },
    city: { type: String, trim: true },
  },
  {
    timestamps: true,
    collection: "drivers",
  }
);

export type DriverDocument = InferSchemaType<typeof DriverSchema> & {
  _id: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Driver: Model<DriverDocument> =
  (models.Driver as Model<DriverDocument>) ||
  model<DriverDocument>("Driver", DriverSchema);
