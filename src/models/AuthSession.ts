import {
  Schema,
  model,
  models,
  Types,
  type HydratedDocument,
  type Model,
} from "mongoose";

/**
 * Optional persisted session ledger (JWT remains the live session).
 * Revoked on password reset.
 */
export type AuthSessionFields = {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
};

const AuthSessionSchema = new Schema<AuthSessionFields>(
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

export type AuthSessionDocument = HydratedDocument<AuthSessionFields>;

if (models.AuthSession) {
  delete models.AuthSession;
}

export const AuthSession: Model<AuthSessionFields> = model<AuthSessionFields>(
  "AuthSession",
  AuthSessionSchema
);
