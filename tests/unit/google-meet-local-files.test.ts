import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { prepareGoogleMeetPrivateDirectory } from "../../scripts/google-meet-local-files";

it("prepares private worker files alongside existing migration backups without overwriting them", () => {
  const root = mkdtempSync(join(tmpdir(), "learli-meet-files-"));
  try {
    const directory = join(root, "meet");
    prepareGoogleMeetPrivateDirectory(directory);
    expect(statSync(directory).mode & 0o077).toBe(0);
    const backup = join(directory, "before-migration.dump");
    writeFileSync(backup, "synthetic-backup", { mode: 0o600 });
    expect(() => prepareGoogleMeetPrivateDirectory(directory)).not.toThrow();
    expect(readFileSync(backup, "utf8")).toBe("synthetic-backup");
    expect(existsSync(join(directory, "worker.env"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("rejects linked, non-directory and publicly accessible credential destinations", () => {
  const root = mkdtempSync(join(tmpdir(), "learli-meet-files-"));
  try {
    const privateDirectory = join(root, "private");
    mkdirSync(privateDirectory, { mode: 0o700 });
    const link = join(root, "link");
    symlinkSync(privateDirectory, link);
    const file = join(root, "file");
    writeFileSync(file, "preserve", { mode: 0o600 });
    const broad = join(root, "broad");
    mkdirSync(broad);
    chmodSync(broad, 0o755);
    for (const path of [link, file, broad])
      expect(() => prepareGoogleMeetPrivateDirectory(path)).toThrow(
        "owned private meeting directory",
      );
    expect(readFileSync(file, "utf8")).toBe("preserve");
    expect(statSync(broad).mode & 0o777).toBe(0o755);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
