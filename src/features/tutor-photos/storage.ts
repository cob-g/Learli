import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/** Where photo bytes live. PostgreSQL keeps only the key (architecture §15). */
export type PhotoStorage = {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
};

const keyPattern =
  /^tutor-photos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export function newPhotoKey() {
  return `tutor-photos/${randomUUID()}.webp`;
}

type LocalEnvironment = "development" | "test";

/**
 * Owner-only files under .local/tutor-photos/<environment>, never used by a
 * deployment. Every path is written out from the working directory so build
 * tracing stays inside that folder instead of scanning the checkout.
 */
export function localPhotoStorage(environment: LocalEnvironment): PhotoStorage {
  const folder = () =>
    path.join(process.cwd(), ".local", "tutor-photos", environment);
  const file = (key: string) => {
    if (!keyPattern.test(key)) throw new Error("Invalid photo key.");
    return path.join(
      process.cwd(),
      ".local",
      "tutor-photos",
      environment,
      path.basename(key),
    );
  };
  return {
    async put(key, bytes) {
      const target = file(key);
      await mkdir(folder(), { recursive: true, mode: 0o700 });
      const stat = await lstat(folder());
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new Error("Photo storage is unavailable.");
      await writeFile(target, bytes, { mode: 0o600, flag: "wx" });
    },
    async get(key) {
      try {
        return await readFile(file(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async remove(key) {
      await rm(file(key), { force: true });
    },
  };
}

/** Best effort: a leftover file is unreachable once its row is not served. */
export async function discardPhotos(
  storage: PhotoStorage | null,
  keys: string[],
) {
  if (!storage) return;
  await Promise.all(keys.map((key) => storage.remove(key).catch(() => {})));
}
