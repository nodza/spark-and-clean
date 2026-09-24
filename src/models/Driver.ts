import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { MAX_NOTE_LEN } from "@/lib/internalNotes";

const InternalNoteSchema = new Schema(
  {
    id: { type: String, required: true },
    body: { type: String, required: true, trim: true, maxlength: MAX_NOTE_LEN },
    author: { type: String, required: true, trim: true },
    createdAt: { type: String, required: true },
  },
  { _id: false }
);

const DriverSchema = new Schema(
  {
    /** Stable business id, e.g. driver_1 */
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true, index: true },
    isActive: { type: Boolean, default: true },
    city: { type: String, trim: true },
    /**
     * Ops-only append-only notes (same UX as booking Internal notes).
     * Only via /api/drivers/[id]/notes — never on tech/customer payloads.
     */
    notes: { type: [InternalNoteSchema], default: [] },
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
