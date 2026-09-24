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
    /** Display plate, e.g. CA 123-456 */
    plate: { type: String, required: true, trim: true },
    /**
     * Normalized uniqueness key (spaces/hyphens stripped, uppercased).
     * "CA 123-456", "CA-123-456", and "ca123456" share one key.
     */
    plateKey: { type: String, required: true, unique: true, index: true },
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

// Hot reload can keep a stale schema without plateKey — strip + re-register.
if (models.Vehicle) {
  delete models.Vehicle;
}

export const Vehicle: Model<VehicleDocument> =
  model<VehicleDocument>("Vehicle", VehicleSchema);
