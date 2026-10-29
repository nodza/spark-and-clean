import { Schema, model, models, type Model } from "mongoose";

export type RateLimitCounterFields = {
  _id: string;
  count: number;
  resetAt: Date;
  expiresAt: Date;
};

const RateLimitCounterSchema = new Schema<RateLimitCounterFields>(
  {
    _id: { type: String, required: true },
    count: { type: Number, required: true },
    resetAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

RateLimitCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitCounter: Model<RateLimitCounterFields> =
  (models.RateLimitCounter as Model<RateLimitCounterFields> | undefined) ??
  model<RateLimitCounterFields>("RateLimitCounter", RateLimitCounterSchema);
