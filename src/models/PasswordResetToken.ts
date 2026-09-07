import {
  Schema,
  model,
  models,
  Types,
  type HydratedDocument,
  type Model,
} from "mongoose";

/**
 * Password reset tokens. Store only a hash of the token — never the raw token.
 * TTL: documents are removed after expiresAt (60 minutes from issue).
 */
export type PasswordResetTokenFields = {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

const PasswordResetTokenSchema = new Schema<PasswordResetTokenFields>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetTokenDocument =
  HydratedDocument<PasswordResetTokenFields>;

if (models.PasswordResetToken) {
  delete models.PasswordResetToken;
}

export const PasswordResetToken: Model<PasswordResetTokenFields> =
  model<PasswordResetTokenFields>(
    "PasswordResetToken",
    PasswordResetTokenSchema
  );
