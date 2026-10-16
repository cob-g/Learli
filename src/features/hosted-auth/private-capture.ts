import "server-only";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
  type Stats,
} from "node:fs";
import path from "node:path";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { mailboxSchema } from "@/lib/email/mailbox";
import { createAuthMessageConstructors } from "@/lib/email/transactional-message";
import { syntheticEmail } from "@/lib/local-mode";
import {
  assertHostedAuthConfig,
  HostedAuthError,
  type HostedAuthConfig,
} from "./config";
import type { AccountMail } from "./composition";

/** A full mailbox refuses new captures until its operator removes old files. */
export const privateCaptureLimits = Object.freeze({
  files: 100,
  messageBytes: 8192,
});
const messageSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.enum(["verification", "reset"]),
    to: mailboxSchema,
    url: z.string().max(4096),
  }),
  z.strictObject({
    kind: z.enum(["email-change-current", "email-change-new"]),
    to: mailboxSchema,
    url: z.string().max(4096),
    otp: z.string().regex(/^\d{6}$/),
  }),
]);
const captureName = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.json$/;

function owned(stat: Stats, mode: number) {
  return stat.uid === process.getuid?.() && (stat.mode & 0o7777) === mode;
}
function sameFile(first: Stats, second: Stats) {
  return first.dev === second.dev && first.ino === second.ino;
}
function privateFile(stat: Stats) {
  return stat.isFile() && owned(stat, 0o600) && stat.nlink === 1;
}

/** Every directory below the trusted checkout must already exist, owned and 0700. */
function privateDirectories(root: string, directory: string) {
  root = path.resolve(root);
  if (
    !path.isAbsolute(directory) ||
    path.resolve(directory) !== directory ||
    !directory.startsWith(`${root}${path.sep}.local${path.sep}`)
  )
    throw new Error();
  const rootStat = lstatSync(root);
  if (
    !rootStat.isDirectory() ||
    rootStat.isSymbolicLink() ||
    rootStat.uid !== process.getuid?.() ||
    rootStat.mode & 0o022
  )
    throw new Error();
  const stats = [rootStat];
  let current = root;
  for (const segment of path.relative(root, directory).split(path.sep)) {
    current = path.join(current, segment);
    const stat = lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !owned(stat, 0o700))
      throw new Error();
    stats.push(stat);
  }
  return stats;
}
function unchangedDirectories(
  root: string,
  directory: string,
  before: Stats[],
) {
  const after = privateDirectories(root, directory);
  if (
    before.length !== after.length ||
    before.some((stat, index) => !sameFile(stat, after[index]))
  )
    throw new Error();
}
function removeCreated(file: string, stat: Stats) {
  // Never remove a replacement file or a symlink supplied by another writer.
  if (!sameFile(stat, lstatSync(file))) throw new Error();
  unlinkSync(file);
}

function writeCapture(root: string, directory: string, payload: string) {
  const before = privateDirectories(root, directory);
  const lockPath = path.join(directory, ".capture.lock");
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL;
  let lock: number | undefined;
  let lockStat: Stats | undefined;
  let output: number | undefined;
  let outputPath: string | undefined;
  let outputStat: Stats | undefined;
  let saved = false;
  try {
    // Exclusive across processes, with no stale-lock deletion or unbounded queue.
    lock = openSync(lockPath, flags | constants.O_NOFOLLOW, 0o600);
    lockStat = fstatSync(lock);
    if (!privateFile(lockStat) || lockStat.size !== 0) throw new Error();
    unchangedDirectories(root, directory, before);
    const entries = readdirSync(directory).filter(
      (name) => name !== ".capture.lock",
    );
    if (entries.length >= privateCaptureLimits.files) throw new Error();
    for (const entry of entries) {
      const stat = lstatSync(path.join(directory, entry));
      if (
        !captureName.test(entry) ||
        !privateFile(stat) ||
        stat.size > privateCaptureLimits.messageBytes
      )
        throw new Error();
    }
    outputPath = path.join(directory, `${randomUUID()}.json`);
    output = openSync(outputPath, flags | constants.O_NOFOLLOW, 0o600);
    outputStat = fstatSync(output);
    if (!privateFile(outputStat) || outputStat.size !== 0) throw new Error();
    unchangedDirectories(root, directory, before);
    if (!sameFile(outputStat, lstatSync(outputPath))) throw new Error();
    writeFileSync(output, payload, "utf8");
    fsyncSync(output);
    const written = fstatSync(output);
    if (
      !privateFile(written) ||
      written.size !== Buffer.byteLength(payload) ||
      written.size > privateCaptureLimits.messageBytes
    )
      throw new Error();
    unchangedDirectories(root, directory, before);
    saved = true;
  } finally {
    try {
      if (output !== undefined) closeSync(output);
      if (!saved && outputPath && outputStat)
        removeCreated(outputPath, outputStat);
    } finally {
      if (lock !== undefined) closeSync(lock);
      if (lockStat) removeCreated(lockPath, lockStat);
    }
  }
}

/** Operator-only filesystem sink. Captures provider proofs; it never verifies users. */
export function createPrivateAccountCapture(
  config: HostedAuthConfig,
  root = process.cwd(),
) {
  assertHostedAuthConfig(config);
  if (config.mail.mode !== "private-capture")
    throw new HostedAuthError("configuration");
  const { directory, appOrigin } = config.mail;
  try {
    privateDirectories(root, directory);
  } catch {
    throw new HostedAuthError("private_file");
  }
  // Reuse the existing provider-link/code validation; its identities stay in memory.
  const constructors = createAuthMessageConstructors({
    appOrigin,
    identitySecret: config.secret,
  });
  return async (input: AccountMail) => {
    try {
      const mail = messageSchema.parse(input);
      if (
        !syntheticEmail(mail.to) ||
        !config.accountEmails.includes(mail.to) ||
        !mail.url.startsWith(`${appOrigin}/`) ||
        new URL(mail.url).href !== mail.url ||
        ("otp" in mail && mail.url !== `${appOrigin}/account/email`)
      )
        throw new Error();
      const base = { eventId: randomUUID(), firstAttemptAt: Date.now() };
      const result =
        "otp" in mail
          ? mail.kind === "email-change-current"
            ? constructors.emailChangeCurrent({
                ...base,
                provider: { email: mail.to, otp: mail.otp },
              })
            : constructors.emailChangeNew({
                ...base,
                provider: { email: mail.to, otp: mail.otp },
              })
          : mail.kind === "verification"
            ? constructors.verification({
                ...base,
                provider: { email: mail.to, url: mail.url },
              })
            : constructors.passwordReset({
                ...base,
                provider: { email: mail.to, url: mail.url },
              });
      if (!result.ok) throw new Error();
      const payload = JSON.stringify({
        version: 1,
        purpose: "private-fictional-account-mail",
        capturedAt: new Date(base.firstAttemptAt).toISOString(),
        ...mail,
      });
      if (Buffer.byteLength(payload) > privateCaptureLimits.messageBytes)
        throw new Error();
      writeCapture(root, directory, payload);
    } catch {
      // Provider hooks may swallow failures; the existing attempt boundary observes this.
      throw new APIError("SERVICE_UNAVAILABLE", {
        message:
          "Private account capture could not be completed. Restart verification or recovery.",
      });
    }
  };
}
