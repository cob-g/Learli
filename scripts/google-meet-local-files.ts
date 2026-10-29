import { existsSync, lstatSync, mkdirSync } from "node:fs";

/** Reuse the migration backup directory without following links or broadening
 * credential access. Called before any worker-role mutation. */
export function prepareGoogleMeetPrivateDirectory(path: string) {
  if (!existsSync(path)) mkdirSync(path, { mode: 0o700 });
  const directory = lstatSync(path);
  if (
    !directory.isDirectory() ||
    directory.isSymbolicLink() ||
    (directory.mode & 0o077) !== 0 ||
    (typeof process.getuid === "function" && directory.uid !== process.getuid())
  )
    throw new Error("An owned private meeting directory is required.");
}
