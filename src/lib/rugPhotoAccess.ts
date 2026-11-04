import { canViewBookingPhotos } from "@/lib/rugPhotos";
import { presentPhotoList } from "@/lib/s3RugPhotos";
import type { SessionUser } from "@/lib/sessionJwt";

type PhotoBooking = {
  userId?: string;
  assignedDriverId?: string;
  customer: { email: string };
  rug?: {
    photos?: string[];
    labelPhotos?: string[];
  };
};

/**
 * Replace stored S3 keys with short-lived GET URLs for an allowed viewer.
 * Everyone else receives no photo URLs, including a public tracking link.
 */
export async function withViewableRugPhotos<T extends PhotoBooking>(
  booking: T,
  allowed: boolean
): Promise<T> {
  if (!booking.rug) return booking;
  const stored =
    (booking.rug.photos?.length ?? 0) + (booking.rug.labelPhotos?.length ?? 0);
  if (stored === 0) return booking;

  if (!allowed) {
    return {
      ...booking,
      rug: { ...booking.rug, photos: [], labelPhotos: [] },
    };
  }

  const [photos, labelPhotos] = await Promise.all([
    presentPhotoList(booking.rug.photos),
    presentPhotoList(booking.rug.labelPhotos),
  ]);
  return { ...booking, rug: { ...booking.rug, photos, labelPhotos } };
}

export async function rugPhotosForSession<T extends PhotoBooking>(
  booking: T,
  session: SessionUser | null
): Promise<T> {
  try {
    return await withViewableRugPhotos(
      booking,
      canViewBookingPhotos(session, booking)
    );
  } catch (err) {
    console.error(
      "[rug-photos] could not sign photo URLs",
      err instanceof Error ? err.message : err
    );
    return withViewableRugPhotos(booking, false);
  }
}
