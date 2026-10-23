import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Day log: which driver used which bakkie on a calendar day.
 * Separate from Vehicle.assignedDriverId (standing register).
 * Unique on date + vehicleId — one vehicle, one driver per day.
 * Not unique on date + driverId — one driver may use several vehicles.
 */
const VehicleDayUseSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    /** Calendar day yyyy-MM-dd (Africa/Johannesburg intent). */
    date: { type: String, required: true, trim: true, index: true },
    driverId: { type: String, required: true, trim: true, index: true },
    vehicleId: { type: String, required: true, trim: true, index: true },
  },
  {
    timestamps: true,
    collection: "vehicleDayUses",
  }
);

VehicleDayUseSchema.index({ date: 1, vehicleId: 1 }, { unique: true });

export type VehicleDayUseDocument = InferSchemaType<typeof VehicleDayUseSchema> & {
  _id: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

if (models.VehicleDayUse) {
  delete models.VehicleDayUse;
}

export const VehicleDayUse: Model<VehicleDayUseDocument> = model<VehicleDayUseDocument>(
  "VehicleDayUse",
  VehicleDayUseSchema
);
