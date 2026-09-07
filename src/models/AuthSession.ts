import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Optional persisted session ledger (JWT remains the live session).
 * Useful for revoke / audit in later auth tickets — schema only for now.
 */
const AuthSessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    /** Hash of refresh / session id — never store raw tokens */
    tokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, trim: true },
    ip: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type AuthSessionDocument = InferSchemaType<typeof AuthSessionSchema> & {
  _id: Schema.Types.ObjectId;
};

export const AuthSession: Model<AuthSessionDocument> =
  (models.AuthSession as Model<AuthSessionDocument>) ||
  model<AuthSessionDocument>("AuthSession", AuthSessionSchema);
