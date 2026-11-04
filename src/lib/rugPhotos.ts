import { clientOwnsBooking } from "@/lib/payments/checkoutAccess";
import type { SessionUser } from "@/lib/sessionJwt";

export const RUG_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const RUG_PHOTO_MAX_LABEL = "5 MB";

export const RUG_PHOTO_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type RugPhotoContentType = keyof typeof RUG_PHOTO_CONTENT_TYPES;

const RUG_PHOTO_KEY =
  /^rug-photos\/\d{4}\/(0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

export function isRugPhotoContentType(
  value: string
): value is RugPhotoContentType {
  return Object.prototype.hasOwnProperty.call(RUG_PHOTO_CONTENT_TYPES, value);
}

export function isRugPhotoKey(value: string): boolean {
  return RUG_PHOTO_KEY.test(value.trim());
}

export function buildRugPhotoKey(
  contentType: RugPhotoContentType,
  now = new Date(),
  id = crypto.randomUUID()
): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const ext = RUG_PHOTO_CONTENT_TYPES[contentType];
  return `rug-photos/${year}/${month}/${id}.${ext}`;
}

/** `undefined` when omitted. `null` when the list is not our private photo keys. */
export function parseRugPhotoKeys(value: unknown): string[] | null | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) return null;
  const keys: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !isRugPhotoKey(item)) return null;
    keys.push(item.trim());
  }
  return keys;
}

export function rugPhotoSizeError(size: unknown): string | null {
  if (typeof size !== "number" || !Number.isInteger(size) || size < 1) {
    return "Choose a photo to upload.";
  }
  if (size > RUG_PHOTO_MAX_BYTES) {
    return `This photo is larger than ${RUG_PHOTO_MAX_LABEL}.`;
  }
  return null;
}

type PhotoBooking = {
  userId?: string;
  assignedDriverId?: string;
  customer: { email: string };
};

/** Full admin, the assigned technician, or the client who owns the booking. */
export function canViewBookingPhotos(
  session: SessionUser | null,
  booking: PhotoBooking
): boolean {
  if (!session) return false;
  if (session.role === "admin" && session.adminTier === "full") return true;
  if (
    session.role === "technician" &&
    session.driverProfileId &&
    booking.assignedDriverId === session.driverProfileId
  ) {
    return true;
  }
  return clientOwnsBooking(session, booking);
}
