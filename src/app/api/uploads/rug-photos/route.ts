import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { rugPhotoSizeError } from "@/lib/rugPhotos";
import {
  assertRugPhotoContentType,
  createRugPhotoUpload,
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
  if (sizeError) {
    return NextResponse.json({ error: sizeError }, { status: 400 });
  }

  try {
    const upload = await createRugPhotoUpload(contentType);
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
