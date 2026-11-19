import { canViewBookingPhotos } from "@/lib/rugPhotos";
import { presentPhotoList } from "@/lib/s3RugPhotos";
import type { SessionUser } from "@/lib/sessionJwt";

type RugPhotoFields = {
  photos?: string[];
  labelPhotos?: string[];
};

type PhotoBooking = {
  userId?: string;
  assignedDriverId?: string;
  customer: { email: string };
  rug?: RugPhotoFields;
  rugs?: RugPhotoFields[];
};

function storedPhotoCount(booking: PhotoBooking): number {
  const lines = [
    ...(booking.rug ? [booking.rug] : []),
    ...(booking.rugs ?? []),
  ];
  return lines.reduce(
    (count, line) =>
      count + (line.photos?.length ?? 0) + (line.labelPhotos?.length ?? 0),
    0
  );
}

async function presentLine<T extends RugPhotoFields>(
  line: T,
  allowed: boolean
): Promise<T> {
  if (!allowed) {
    return { ...line, photos: [], labelPhotos: [] };
  }
  const [photos, labelPhotos] = await Promise.all([
    presentPhotoList(line.photos),
    presentPhotoList(line.labelPhotos),
  ]);
  return { ...line, photos, labelPhotos };
}

/**
 * Replace stored S3 keys with short-lived GET URLs for an allowed viewer.
 * Everyone else receives no photo URLs, including a public tracking link.
 */
export async function withViewableRugPhotos<T extends PhotoBooking>(
  booking: T,
  allowed: boolean
): Promise<T> {
  if (storedPhotoCount(booking) === 0) return booking;

  const [rug, rugs] = await Promise.all([
    booking.rug ? presentLine(booking.rug, allowed) : Promise.resolve(undefined),
    booking.rugs
      ? Promise.all(booking.rugs.map((line) => presentLine(line, allowed)))
      : Promise.resolve(undefined),
  ]);

  return {
    ...booking,
    ...(rug ? { rug } : {}),
    ...(rugs ? { rugs } : {}),
  };
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
