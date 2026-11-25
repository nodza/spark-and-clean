import { branchContacts, type BranchContact } from "@/data/branchContacts";

/**
 * How a rug reaches the branch, and how it goes home.
 * Missing values mean collection and delivery, so older bookings stay the same.
 * The price does not change for a branch drop-off or collect until that is decided.
 */
export const HANDOVER_IN = ["collection", "dropoff"] as const;
export const HANDOVER_OUT = ["delivery", "collect"] as const;
export type HandoverIn = (typeof HANDOVER_IN)[number];
export type HandoverOut = (typeof HANDOVER_OUT)[number];
export type BranchKey = BranchContact["id"];

export type HandoverFields = {
  handoverIn?: HandoverIn | null;
  handoverOut?: HandoverOut | null;
  branchKey?: string | null;
};

export function handoverInOf(booking: HandoverFields): HandoverIn {
  return booking.handoverIn === "dropoff" ? "dropoff" : "collection";
}

export function handoverOutOf(booking: HandoverFields): HandoverOut {
  return booking.handoverOut === "collect" ? "collect" : "delivery";
}

/** A driver collects this rug. Office drop-off does not. */
export function isDriverCollection(booking: HandoverFields): boolean {
  return handoverInOf(booking) === "collection";
}

/** A driver brings this rug back. Office collect does not. */
export function isDriverDelivery(booking: HandoverFields): boolean {
  return handoverOutOf(booking) === "delivery";
}

export function isOfficeDropoff(booking: HandoverFields): boolean {
  return !isDriverCollection(booking);
}

export function isOfficeCollect(booking: HandoverFields): boolean {
  return !isDriverDelivery(booking);
}

/** Street address is the customer's when either leg is a driver leg. */
export function needsCustomerAddress(booking: HandoverFields): boolean {
  return isDriverCollection(booking) || isDriverDelivery(booking);
}

export function needsBranch(booking: HandoverFields): boolean {
  return isOfficeDropoff(booking) || isOfficeCollect(booking);
}

export function isBranchKey(value: unknown): value is BranchKey {
  return value === "gauteng" || value === "cape-town";
}

export function branchByKey(value: unknown): BranchContact | null {
  if (!isBranchKey(value)) return null;
  return branchContacts.find((branch) => branch.id === value) ?? null;
}

export function branchForBooking(booking: HandoverFields): BranchContact | null {
  if (!needsBranch(booking)) return null;
  return branchByKey(booking.branchKey);
}

export function branchLabel(booking: HandoverFields): string {
  const branch = branchForBooking(booking);
  if (!branch) return "the branch";
  return `${branch.name}, ${branch.area}`;
}

/**
 * Writes the stored handover onto a create payload.
 * Office drop-off has no collection slot. Office collect has no delivery slot.
 * An office-only booking stores the branch address, because the client did not enter one.
 * Returns an error message, or null when the payload can be saved.
 */
export function normalizeBookingHandover(
  payload: Record<string, unknown>
): string | null {
  const inbound: HandoverIn = payload.handoverIn === "dropoff" ? "dropoff" : "collection";
  const outbound: HandoverOut = payload.handoverOut === "collect" ? "collect" : "delivery";
  payload.handoverIn = inbound;
  payload.handoverOut = outbound;

  const office = inbound === "dropoff" || outbound === "collect";
  const branch = office ? branchByKey(payload.branchKey) : null;
  if (office && !branch) return "Choose a branch.";
  if (!office) delete payload.branchKey;
  else payload.branchKey = branch!.id;

  if (inbound === "dropoff") {
    delete payload.collectionSlot;
    delete payload.assignedDriverId;
  } else if (
    payload.collectionSlot !== "MORNING" &&
    payload.collectionSlot !== "AFTERNOON"
  ) {
    return "Choose morning or afternoon for collection.";
  }

  if (outbound === "collect") {
    delete payload.deliveryDate;
    delete payload.deliverySlot;
    delete payload.deliveryDriverId;
  }

  if (inbound === "dropoff" && outbound === "collect" && branch) {
    payload.addressLine1 = branch.address;
    payload.suburb = branch.area;
    payload.city = branch.serviceCity;
    delete payload.coordinates;
    delete payload.postalCode;
  }

  if (inbound === "dropoff" && !String(payload.collectionDate ?? "").trim()) {
    return "Choose the day you will drop the rug off.";
  }

  return null;
}
