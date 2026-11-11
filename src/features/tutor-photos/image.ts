import "server-only";
import { RuleError } from "@/lib/rule-error";

/** Largest upload accepted, before re-encoding. */
export const maxPhotoUploadBytes = 5 * 1024 * 1024;
/** Stored photos are this many pixels square. */
export const photoPixels = 512;
const minimumPixels = 128;
const formats = new Set(["jpeg", "png", "webp"]);
const decode = { limitInputPixels: 40_000_000, failOn: "error" } as const;
const unreadable = "Choose a JPG, PNG or WebP photo.";

/**
 * Re-encodes an upload as a square WebP. Re-encoding drops everything embedded
 * in the original (camera and location metadata included) and applies the
 * camera's orientation; only still JPG, PNG and WebP images are accepted.
 */
export async function preparePhoto(input: Uint8Array) {
  // The native image library loads only when a photo is actually processed.
  const { default: sharp } = await import("sharp");
  if (input.byteLength === 0 || input.byteLength > maxPhotoUploadBytes)
    throw new RuleError(400, "Choose a photo under 5 MB.");
  let metadata;
  try {
    metadata = await sharp(input, decode).metadata();
  } catch {
    throw new RuleError(400, unreadable);
  }
  if (!formats.has(metadata.format) || (metadata.pages ?? 1) > 1)
    throw new RuleError(400, unreadable);
  if (
    (metadata.width ?? 0) < minimumPixels ||
    (metadata.height ?? 0) < minimumPixels
  )
    throw new RuleError(400, "Choose a photo at least 128 × 128 pixels.");
  try {
    return await sharp(input, decode)
      .rotate()
      .resize(photoPixels, photoPixels, { fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new RuleError(400, unreadable);
  }
}
