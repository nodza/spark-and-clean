import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const RugAssetSchema = new Schema(
  {
    tagCode: { type: String, required: true, unique: true, index: true, trim: true },
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      sparse: true,
    },
    ownerEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    type: { type: String, required: true, trim: true },
    photoUrls: { type: [String], default: [] },
    currentBookingId: { type: String, ref: "Booking", default: null, index: true, sparse: true },
    status: {
      type: String,
      enum: ["IN_CARE", "RETURNED", "RETIRED"],
      default: "IN_CARE",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "rugAssets",
  }
);

export type RugAssetDocument = InferSchemaType<typeof RugAssetSchema> & {
  _id: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

if (models.RugAsset) {
  delete models.RugAsset;
}

export const RugAsset: Model<RugAssetDocument> = model<RugAssetDocument>(
  "RugAsset",
  RugAssetSchema
);