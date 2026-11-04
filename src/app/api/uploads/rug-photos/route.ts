import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { checkRateLimit } from "@/lib/rateLimit";
import { isRugPhotoKey, rugPhotoSizeError } from "@/lib/rugPhotos";
import {
  assertRugPhotoContentType,
  createRugPhotoUpload,
  deleteRugPhoto,
} from "@/lib/s3RugPhotos";

const UPLOAD_LIMIT = 30;
const UPLOAD_WINDOW_MS = 15 * 60 * 1000;

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Presign one private PUT. Guests can upload before they have an account.
 * The booking stores the key, never this URL.
 */
export async function POST(request: Request) {
  const rate = checkRateLimit(
    `rug-photo:${clientIp(request)}`,
    UPLOAD_LIMIT,
    UPLOAD_WINDOW_MS
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many photos. Try again in a few minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  let body: { contentType?: unknown; size?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  let contentType;
  try {
    contentType = assertRugPhotoContentType(body.contentType);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Use a JPG, PNG, or WebP image.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const sizeError = rugPhotoSizeError(body.size);
  if (sizeError || typeof body.size !== "number") {
    return NextResponse.json(
      { error: sizeError || "Choose a photo to upload." },
      { status: 400 }
    );
  }

  try {
    const upload = await createRugPhotoUpload(contentType, body.size);
    return NextResponse.json(upload);
  } catch (err) {
    console.error(
      "[api/uploads/rug-photos]",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: "Could not start the photo upload. Try again." },
      { status: 500 }
    );
  }
}

/** Remove an upload that was never saved on a booking. */
export async function DELETE(request: Request) {
  const rate = checkRateLimit(
    `rug-photo:${clientIp(request)}`,
    UPLOAD_LIMIT,
    UPLOAD_WINDOW_MS
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many photos. Try again in a few minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  let body: { key?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!isRugPhotoKey(key)) {
    return NextResponse.json({ error: "Invalid rug photo." }, { status: 400 });
  }

  try {
    await connectDB();
    const saved = await Booking.findOne({
      $or: [{ "rug.photos": key }, { "rug.labelPhotos": key }],
    })
      .select({ _id: 1 })
      .lean();
    if (saved) {
      return NextResponse.json(
        { error: "This photo is already on a booking." },
        { status: 409 }
      );
    }
    await deleteRugPhoto(key);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(
      "[api/uploads/rug-photos]",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: "Could not remove the photo. Try again." },
      { status: 500 }
    );
  }
}
