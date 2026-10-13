import {
  constants,
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { HostedAuthError, parseHostedAuthConfig } from "./config";

export function readHostedAuthPacket(root: string, file: string): unknown {
  let fd: number | undefined;
  try {
    root = path.resolve(root);
    const resolved = path.resolve(file);
    if (
      !path.isAbsolute(file) ||
      resolved !== file ||
      !resolved.startsWith(`${root}/.local/`)
    )
      throw new Error();
    for (
      let dir = path.dirname(resolved);
      dir !== root;
      dir = path.dirname(dir)
    ) {
      const stat = lstatSync(dir);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        stat.uid !== process.getuid?.() ||
        stat.mode & 0o077
      )
        throw new Error();
    }
    fd = openSync(resolved, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(fd);
    if (
      !stat.isFile() ||
      stat.uid !== process.getuid?.() ||
      stat.mode & 0o077 ||
      stat.size > 65536
    )
      throw new Error();
    const raw = readFileSync(fd, "utf8");
    if (Buffer.byteLength(raw) > 65536) throw new Error();
    return JSON.parse(raw);
  } catch {
    throw new HostedAuthError("private_file");
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
export function loadHostedAuthConfig(
  source: Record<string, string | undefined>,
  root = process.cwd(),
) {
  // Refuse mode/environment before reading a packet or evaluating credentials.
  if (
    source.APP_ENV !== "staging" ||
    source.AUTH_MODE !== "hosted-synthetic" ||
    !source.HOSTED_AUTH_CONFIG_FILE
  )
    throw new HostedAuthError("configuration");
  const packet = readHostedAuthPacket(root, source.HOSTED_AUTH_CONFIG_FILE);
  const config = parseHostedAuthConfig(source, packet);
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        source.APP_ENV,
        source.AUTH_MODE,
        source.APP_URL,
        source.BETTER_AUTH_URL,
        source.BETTER_AUTH_SECRET,
        source.HOSTED_INGRESS_SECRET,
        source.HOSTED_AUTH_CONFIG_FILE,
        packet,
      ]),
    )
    .digest("hex");
  return { config, fingerprint };
}
