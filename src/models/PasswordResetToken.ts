import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Password reset tokens (E6). Store only a hash of the token — never the raw token.
 * This ticket creates the schema only; issuance UI comes later.
 */
const PasswordResetTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetTokenDocument = InferSchemaType<
  typeof PasswordResetTokenSchema
> & {
  _id: Schema.Types.ObjectId;
};

export const PasswordResetToken: Model<PasswordResetTokenDocument> =
  (models.PasswordResetToken as Model<PasswordResetTokenDocument>) ||
  model<PasswordResetTokenDocument>(
    "PasswordResetToken",
    PasswordResetTokenSchema
  );
