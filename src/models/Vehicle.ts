import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Basic bakkie assignment (one current driver).
 * E10 will own the flexible model (pools, history, types, maintenance).
 */
const VehicleSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    /** Make / model, e.g. Nissan NP200 */
    label: { type: String, required: true, trim: true },
    plate: { type: String, required: true, trim: true, unique: true },
    /** At most one vehicle per driver — sparse unique. Null = unassigned. */
    assignedDriverId: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "vehicles",
  }
);

VehicleSchema.index(
  { assignedDriverId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      assignedDriverId: { $type: "string", $gt: "" },
    },
  }
);

export type VehicleDocument = InferSchemaType<typeof VehicleSchema> & {
  _id: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Vehicle: Model<VehicleDocument> =
  (models.Vehicle as Model<VehicleDocument>) ||
  model<VehicleDocument>("Vehicle", VehicleSchema);
