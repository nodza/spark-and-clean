import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  buildRugPhotoKey,
  isRugPhotoContentType,
  isRugPhotoKey,
  type RugPhotoContentType,
} from "@/lib/rugPhotos";

/** Long enough to upload on a slow connection, short enough to limit a leaked URL. */
export const RUG_PHOTO_PUT_TTL_SECONDS = 5 * 60;
/** A copied photo link stops working after this. */
export const RUG_PHOTO_GET_TTL_SECONDS = 15 * 60;

type S3Settings = {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

let client: S3Client | null = null;

export function readS3Settings(): S3Settings {
  const region = process.env.AWS_REGION?.trim() ?? "";
  const bucket = (
    process.env.S3_BUCKET ||
    process.env.S3_BUCKET_NAME ||
    ""
  ).trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim() ?? "";
  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 is not configured");
  }
  return { region, bucket, accessKeyId, secretAccessKey };
}

function s3Client(): { client: S3Client; bucket: string } {
  const settings = readS3Settings();
  if (!client) {
    client = new S3Client({
      region: settings.region,
      credentials: {
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey,
      },
      // Browser PUTs do not send the SDK's default checksum headers.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return { client, bucket: settings.bucket };
}

export async function createRugPhotoUpload(contentType: RugPhotoContentType) {
  const { client: s3, bucket } = s3Client();
  const key = buildRugPhotoKey(contentType);
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: RUG_PHOTO_PUT_TTL_SECONDS }
  );
  return { key, uploadUrl, contentType };
}

export async function presignRugPhotoGet(key: string): Promise<string> {
  if (!isRugPhotoKey(key)) {
    throw new Error("Invalid rug photo key");
  }
  const { client: s3, bucket } = s3Client();
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key.trim() }),
    { expiresIn: RUG_PHOTO_GET_TTL_SECONDS }
  );
}

/** Turn a stored key into a short-lived URL. Leave an older http or /uploads path as-is. */
export async function presentStoredPhoto(value: string): Promise<string | null> {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("blob:")) return null;
  if (isRugPhotoKey(trimmed)) return presignRugPhotoGet(trimmed);
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return trimmed;
    }
  } catch {
    return null;
  }
  return null;
}

export async function presentPhotoList(
  values: string[] | undefined
): Promise<string[]> {
  if (!values?.length) return [];
  const shown = await Promise.all(values.map((value) => presentStoredPhoto(value)));
  return shown.filter((value): value is string => Boolean(value));
}

export function assertRugPhotoContentType(value: unknown): RugPhotoContentType {
  if (typeof value !== "string" || !isRugPhotoContentType(value)) {
    throw new Error("Use a JPG, PNG, or WebP image.");
  }
  return value;
}
