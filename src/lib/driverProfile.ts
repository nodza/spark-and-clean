import { validateCustomerName } from "@/lib/bookingValidation";

/** Keep User.disabledAt / User.isActive in lockstep with Driver.isActive. */
export function technicianLoginFields(isActive: boolean, at: Date = new Date()) {
  return isActive
    ? { disabledAt: null as Date | null, isActive: true as const }
    : { disabledAt: at, isActive: false as const };
}

/**
 * Assigned bookings in these statuses may stay when the technician login
 * is removed. Anything else still blocks deletion.
 */
export const TECHNICIAN_DELETE_CLOSED_STATUSES = ["DELIVERED", "CANCELLED"] as const;

export type DriverPatchUpdates = {
  isActive?: boolean;
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
};

/**
 * Why a technician cannot be removed, or null when deletion is allowed.
 * Callers only read jobs and vehicles. This function does not write them.
 */
export function technicianDeleteBlockMessage(input: {
  openJobCount: number;
  hasStandingVehicle: boolean;
}): string | null {
  const openJobs = input.openJobCount > 0;
  const standing = input.hasStandingVehicle;
  if (!openJobs && !standing) return null;

  const parts: string[] = [];
  if (openJobs) {
    parts.push(
      input.openJobCount === 1
        ? "Has 1 job that is not Delivered or Cancelled."
        : `Has ${input.openJobCount} jobs that are not Delivered or Cancelled.`
    );
  }
  if (standing) {
    parts.push(
      "Still the standing driver on a vehicle."
    );
  }
  return parts.join(" ");
}

export function technicianDeleteRefusal(input: {
  openJobCount: number;
  hasStandingVehicle: boolean;
}): string | null {
  const message = technicianDeleteBlockMessage(input);
  if (!message) return null;
  return `${message} Nothing was removed.`;
}

/** Hover and button state for the admin UI. Null means delete is allowed. */
export function technicianDeletePreview(input: {
  driverProfileId?: string | null;
  bookings: { assignedDriverId?: string | null; status?: string | null }[];
  hasStandingVehicle: boolean;
}): string | null {
  if (!input.driverProfileId) {
    return "This technician has no driver profile, so they cannot be removed.";
  }
  const closed = new Set<string>(TECHNICIAN_DELETE_CLOSED_STATUSES);
  const openJobCount = input.bookings.filter(
    (job) =>
      job.assignedDriverId === input.driverProfileId &&
      !closed.has(String(job.status ?? ""))
  ).length;
  return technicianDeleteBlockMessage({
    openJobCount,
    hasStandingVehicle: input.hasStandingVehicle,
  });
}

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
    return {
      ok: false,
      error: "Use POST /api/drivers/[id]/notes to add notes",
    };
  }

  if ("name" in raw) {
    if (typeof raw.name !== "string") {
      return { ok: false, error: "name must be a string" };
    }
    const name = raw.name.trim().replace(/\s+/g, " ");
    const nameError = validateCustomerName(name);
    if (nameError) {
      return { ok: false, error: nameError };
    }
    updates.name = name;
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
