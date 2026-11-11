import "server-only";
import { getServerEnv } from "@/lib/env/server";
import { localPhotoStorage, type PhotoStorage } from "./storage";

/** The configured store, or null when photo uploads are off here. */
export function photoStorage(): PhotoStorage | null {
  const env = getServerEnv();
  if (env.TUTOR_PHOTO_STORAGE !== "local") return null;
  // The configuration schema already refuses local disk outside these.
  if (env.APP_ENV !== "development" && env.APP_ENV !== "test") return null;
  return localPhotoStorage(env.APP_ENV);
}
