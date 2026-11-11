import "server-only";
import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson, sameDomainOrigin } from "@/lib/auth-handler";
import { mutationErrorResponse } from "@/lib/mutation-handler";
import { emitDiagnostic } from "@/lib/diagnostics.server";
import { maxPhotoUploadBytes } from "./image";
import {
  readTutorPhotoForServing,
  removeTutorPhoto,
  submitTutorPhoto,
} from "./service";
import { photoStorage } from "./configured";

const invalid = () => ({ message: "Check your photo and try again." });
// Multipart framing around the largest accepted photo.
const maxBodyBytes = maxPhotoUploadBytes + 64 * 1024;

/** PUT multipart/form-data with one "photo" file; DELETE removes the photo. */
export async function handleTutorPhotoRequest(
  runtime: AuthRuntime | null,
  request: Request,
) {
  if (!runtime) {
    emitDiagnostic("mutation.unavailable");
    return privateJson({ message: "This service is unavailable." }, 503);
  }
  if (!sameDomainOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  try {
    if (request.method === "DELETE")
      return privateJson(
        await removeTutorPhoto(runtime, request.headers, photoStorage()),
      );
    if (request.method !== "PUT")
      return privateJson({ message: "Method not allowed." }, 405);
    const length = Number(request.headers.get("content-length"));
    if (!Number.isSafeInteger(length) || length < 1)
      return privateJson({ message: "Choose a photo to upload." }, 411);
    if (length > maxBodyBytes)
      return privateJson({ message: "Choose a photo under 5 MB." }, 413);
    let photo: FormDataEntryValue | null;
    try {
      photo = (await request.formData()).get("photo");
    } catch {
      return privateJson(invalid(), 400);
    }
    if (!(photo instanceof File) || photo.size < 1)
      return privateJson({ message: "Choose a photo to upload." }, 400);
    return privateJson(
      await submitTutorPhoto(
        runtime,
        request.headers,
        photoStorage(),
        new Uint8Array(await photo.arrayBuffer()),
      ),
    );
  } catch (error) {
    return mutationErrorResponse(error, invalid);
  }
}

const notFound = () =>
  new Response(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });

/** Serves a photo only to the audience readTutorPhotoForServing allows. */
export async function serveTutorPhoto(
  runtime: AuthRuntime | null,
  request: Request,
  photoId: string,
) {
  if (!runtime) return notFound();
  const photo = await readTutorPhotoForServing(
    runtime,
    request.headers,
    photoStorage(),
    photoId,
  );
  if (!photo) return notFound();
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(photo.bytes.byteLength),
      // A photo id never changes its image; private ones are never stored.
      "Cache-Control": photo.shared
        ? "public, max-age=3600"
        : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      ...(photo.shared ? {} : { Vary: "Cookie" }),
    },
  });
}
