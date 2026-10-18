import { randomUUID } from "node:crypto";
import { lstat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { escapeHtml as escape } from "./escape-html";
import { isLoopbackOrigin, syntheticEmail } from "../local-mode";
import { mailboxSchema } from "./mailbox";
import {
  assertLocalWorkflowCapability,
  type LocalWorkflow,
} from "@/features/local-workflow/runtime";
import { safeHostedCallback } from "@/features/hosted-auth/callback";
import { z } from "zod";

export type LocalMessage =
  | {
      kind: "verification" | "reset";
      to: string;
      url: string;
    }
  | {
      kind: "email-change-current" | "email-change-new";
      to: string;
      url: string;
      otp: string;
    };
export function localMailbox(environment: "development" | "test") {
  return path.join(process.cwd(), ".local", "mail", environment);
}
export async function captureLocalMail(
  environment: "development" | "test",
  message: LocalMessage,
) {
  const url = new URL(message.url);
  if (!isLoopbackOrigin(url.origin) || !syntheticEmail(message.to))
    throw new Error("Local mail destination rejected.");
  const confirmation = "otp" in message;
  if (
    confirmation &&
    (url.pathname !== "/account/email" ||
      url.search ||
      url.hash ||
      !/^\d{6}$/.test(message.otp))
  )
    throw new Error("Local email confirmation rejected.");
  const directory = localMailbox(environment);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeLocalCapture(directory, message, false);
}

const operationalMessage = z.discriminatedUnion("kind", [
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

/** Provider proofs stay in owner-private files; no HTTP mailbox is exposed. */
export async function captureOperationalMail(
  capability: LocalWorkflow,
  input: LocalMessage,
  root = process.cwd(),
) {
  assertLocalWorkflowCapability(capability);
  const message = operationalMessage.parse(input);
  const url = new URL(message.url);
  if (
    !isLoopbackOrigin(capability.origin) ||
    url.origin !== capability.origin ||
    url.username ||
    url.password ||
    url.hash ||
    /[\s\\\u0000-\u001f\u007f]/.test(message.url) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(message.url)
  )
    throw new Error("Local mail destination rejected.");
  if ("otp" in message) {
    if (url.pathname !== "/account/email" || url.search)
      throw new Error("Local email confirmation rejected.");
  } else {
    const reset = message.kind === "reset";
    const token = reset
      ? url.pathname.slice("/api/auth/reset-password/".length)
      : url.searchParams.get("token");
    const allowed = reset ? ["callbackURL"] : ["token", "callbackURL"];
    if (
      !token ||
      !/^[A-Za-z0-9._~-]{16,2048}$/.test(token) ||
      (reset
        ? !/^\/api\/auth\/reset-password\/[A-Za-z0-9._~-]+$/.test(url.pathname)
        : url.pathname !== "/api/auth/verify-email") ||
      [...url.searchParams.keys()].some(
        (key) =>
          !allowed.includes(key) || url.searchParams.getAll(key).length !== 1,
      ) ||
      !safeHostedCallback(
        url.searchParams.get("callbackURL"),
        capability.origin,
        reset,
      )
    )
      throw new Error("Local account link rejected.");
  }
  let directory = path.resolve(root);
  for (const segment of [".local", "mail", "development"]) {
    directory = path.join(directory, segment);
    await mkdir(directory, { mode: 0o700 }).catch((error: unknown) => {
      if (!(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "EEXIST"
      ))
        throw error;
    });
    const stat = await lstat(directory);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== process.getuid?.() ||
      (stat.mode & 0o7777) !== 0o700
    )
      throw new Error("Private local mailbox is unavailable.");
  }
  await writeLocalCapture(directory, message, true);
}

async function writeLocalCapture(
  directory: string,
  message: LocalMessage,
  ordinary: boolean,
) {
  const confirmation = "otp" in message;
  const id = `${Date.now()}-${randomUUID()}`;
  await writeFile(path.join(directory, `${id}.json`), JSON.stringify(message), {
    mode: 0o600,
    flag: "wx",
  });
  await writeFile(
    path.join(directory, `${id}.html`),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Learli local message</title><h1>${confirmation ? (message.kind === "email-change-current" ? (ordinary ? "Confirm your current address" : "Confirm your current test address") : ordinary ? "Confirm your new address" : "Confirm your new test address") : message.kind === "verification" ? (ordinary ? "Verify your Learli account" : "Verify your test account") : ordinary ? "Reset your Learli password" : "Reset your test password"}</h1><p>Local capture only. No email was sent.</p><p>To: ${escape(message.to)}</p>${confirmation ? `<p>Enter this single-use code in your signed-in account: <strong>${escape(message.otp)}</strong></p><p>Expires in five minutes. Keep this code private.</p>` : ""}<p><a rel="noreferrer" href="${escape(message.url)}">Continue on local Learli</a></p></html>`,
    { mode: 0o600, flag: "wx" },
  );
}
