import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { escapeHtml as escape } from "./escape-html";
import { isLoopbackOrigin, syntheticEmail } from "../local-mode";

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
  const id = `${Date.now()}-${randomUUID()}`;
  await writeFile(path.join(directory, `${id}.json`), JSON.stringify(message), {
    mode: 0o600,
    flag: "wx",
  });
  await writeFile(
    path.join(directory, `${id}.html`),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Learli local message</title><h1>${confirmation ? (message.kind === "email-change-current" ? "Confirm your current test address" : "Confirm your new test address") : message.kind === "verification" ? "Verify your test account" : "Reset your test password"}</h1><p>Local capture only. No email was sent.</p><p>To: ${escape(message.to)}</p>${confirmation ? `<p>Enter this single-use code in your signed-in account: <strong>${escape(message.otp)}</strong></p><p>Expires in five minutes. Keep this code private.</p>` : ""}<p><a rel="noreferrer" href="${escape(message.url)}">Continue on local Learli</a></p></html>`,
    { mode: 0o600, flag: "wx" },
  );
}
