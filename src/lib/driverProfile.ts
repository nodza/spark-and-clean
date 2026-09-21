/** Ops notes stored on a Driver profile (not booking Internal notes). */
export const MAX_DRIVER_NOTE_LEN = 2000;

/** Keep User.disabledAt / User.isActive in lockstep with Driver.isActive. */
export function technicianLoginFields(isActive: boolean, at: Date = new Date()) {
  return isActive
    ? { disabledAt: null as Date | null, isActive: true as const }
    : { disabledAt: at, isActive: false as const };
}

export type DriverPatchUpdates = {
  isActive?: boolean;
  notes?: string;
  phone?: string;
  email?: string;
  city?: string;
};

export function sanitizeDriverPatch(
  body: unknown
): { ok: true; updates: DriverPatchUpdates } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid body" };
  }
  const raw = body as Record<string, unknown>;
  const updates: DriverPatchUpdates = {};

  if ("isActive" in raw) {
    if (typeof raw.isActive !== "boolean") {
      return { ok: false, error: "isActive must be a boolean" };
    }
    updates.isActive = raw.isActive;
  }

  if ("notes" in raw) {
    if (typeof raw.notes !== "string") {
      return { ok: false, error: "notes must be a string" };
    }
    const notes = raw.notes.trim();
    if (notes.length > MAX_DRIVER_NOTE_LEN) {
      return {
        ok: false,
        error: `Notes must be at most ${MAX_DRIVER_NOTE_LEN} characters`,
      };
    }
    updates.notes = notes;
  }

  if ("phone" in raw) {
    if (typeof raw.phone !== "string") {
      return { ok: false, error: "phone must be a string" };
    }
    updates.phone = raw.phone.trim();
  }
  if ("email" in raw) {
    if (typeof raw.email !== "string") {
      return { ok: false, error: "email must be a string" };
    }
    updates.email = raw.email.trim().toLowerCase();
  }
  if ("city" in raw) {
    if (typeof raw.city !== "string") {
      return { ok: false, error: "city must be a string" };
    }
    updates.city = raw.city.trim();
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: "No updates provided" };
  }
  return { ok: true, updates };
}
