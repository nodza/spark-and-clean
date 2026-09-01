import type { Booking } from "@/types/booking";

/** Strip Mongo internal fields for client responses */
export function toClientBooking(doc: Record<string, unknown>): Booking {
  const { _id, __v, updatedAt, ...rest } = doc;
  return rest as unknown as Booking;
}

export function toClientDriver(doc: Record<string, unknown>) {
  const { _id, __v, createdAt, updatedAt, ...rest } = doc;
  return rest;
}

export function toClientUser(doc: Record<string, unknown>) {
  const { _id, __v, passwordHash, createdAt, updatedAt, ...rest } = doc;
  return {
    id: String(_id),
    ...rest,
    createdAt:
      createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    updatedAt:
      updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt,
  };
}
