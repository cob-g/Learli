import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { preparePhoto } from "@/features/tutor-photos/image";
import {
  localPhotoStorage,
  newPhotoKey,
  type PhotoStorage,
} from "@/features/tutor-photos/storage";
import { tutorPhotoUrl } from "@/features/tutor-photos/photo-url";
import { parseServerEnv } from "@/lib/env/schema";

const image = (
  width: number,
  height: number,
  format: "jpeg" | "png" | "webp" | "gif" = "jpeg",
) =>
  sharp({
    create: { width, height, channels: 3, background: "#5bc4b0" },
  })
    .toFormat(format)
    .toBuffer();

describe("tutor photo preparation", () => {
  it("re-encodes a still photo as a 512px square WebP without its metadata", async () => {
    const original = await sharp(await image(900, 600))
      .withExif({ IFD0: { Copyright: "Synthetic camera", Artist: "Someone" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const stored = await sharp(await preparePhoto(original)).metadata();
    expect(stored).toMatchObject({ format: "webp", width: 512, height: 512 });
    expect(stored.exif).toBeUndefined();
    for (const format of ["png", "webp"] as const)
      expect(
        (
          await sharp(
            await preparePhoto(await image(300, 300, format)),
          ).metadata()
        ).format,
      ).toBe("webp");
  });

  it("refuses what is not a usable still JPG, PNG or WebP", async () => {
    await expect(preparePhoto(new Uint8Array())).rejects.toThrow(
      "Choose a photo under 5 MB.",
    );
    await expect(
      preparePhoto(new Uint8Array(5 * 1024 * 1024 + 1)),
    ).rejects.toThrow("Choose a photo under 5 MB.");
    await expect(
      preparePhoto(new TextEncoder().encode("<svg></svg>")),
    ).rejects.toThrow("Choose a JPG, PNG or WebP photo.");
    await expect(preparePhoto(await image(300, 300, "gif"))).rejects.toThrow(
      "Choose a JPG, PNG or WebP photo.",
    );
    await expect(preparePhoto(await image(127, 400))).rejects.toThrow(
      "Choose a photo at least 128 × 128 pixels.",
    );
  });
});

describe("local photo storage", () => {
  let root: string;
  let storage: PhotoStorage;
  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "learli-photo-unit-"));
    // Storage paths are fixed under the working directory; point it here.
    vi.spyOn(process, "cwd").mockReturnValue(root);
    storage = localPhotoStorage("test");
  });
  afterAll(async () => {
    vi.mocked(process.cwd).mockRestore();
    await rm(root, { recursive: true, force: true });
  });

  it("keeps owner-only files by opaque key and removes them", async () => {
    const key = newPhotoKey();
    await storage.put(key, new Uint8Array([1, 2, 3]));
    const file = path.join(root, ".local/tutor-photos/test", key.slice(13));
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect((await stat(path.dirname(file))).mode & 0o777).toBe(0o700);
    expect([...(await storage.get(key))!]).toEqual([1, 2, 3]);
    // Keys are never reused or overwritten.
    await expect(storage.put(key, new Uint8Array([4]))).rejects.toThrow();
    await storage.remove(key);
    expect(await storage.get(key)).toBeNull();
    await storage.remove(key);
  });

  it("accepts only its own key shape", async () => {
    for (const key of [
      "tutor-photos/../../.env.local",
      "tutor-photos/not-a-uuid.webp",
      `${newPhotoKey()}.png`,
      "/etc/passwd",
    ]) {
      await expect(storage.get(key)).rejects.toThrow("Invalid photo key.");
      await expect(storage.put(key, new Uint8Array([1]))).rejects.toThrow(
        "Invalid photo key.",
      );
    }
    expect(tutorPhotoUrl("a/b")).toBe("/api/tutor-photos/a%2Fb");
  });
});

describe("photo storage configuration", () => {
  it("is off by default and local disk only on a loopback dev or test origin", () => {
    expect(parseServerEnv({}).TUTOR_PHOTO_STORAGE).toBe("disabled");
    expect(
      parseServerEnv({
        TUTOR_PHOTO_STORAGE: "local",
        APP_URL: "http://127.0.0.1:3000",
      }).TUTOR_PHOTO_STORAGE,
    ).toBe("local");
    for (const env of [
      { APP_ENV: "staging", APP_URL: "https://staging.example.test" },
      { APP_ENV: "production", APP_URL: "https://learli.example.test" },
      { APP_ENV: "development", APP_URL: "https://learli.example.test" },
    ])
      expect(() =>
        parseServerEnv({ ...env, TUTOR_PHOTO_STORAGE: "local" }),
      ).toThrow(/TUTOR_PHOTO_STORAGE/);
    expect(() => parseServerEnv({ TUTOR_PHOTO_STORAGE: "s3" })).toThrow(
      /TUTOR_PHOTO_STORAGE/,
    );
  });
});
