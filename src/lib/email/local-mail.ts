import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isLoopbackOrigin, syntheticEmail } from "../local-mode";

export type LocalMessage = {
  kind: "verification" | "reset";
  to: string;
  url: string;
};
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
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
  const directory = localMailbox(environment);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const id = `${Date.now()}-${randomUUID()}`;
  await writeFile(path.join(directory, `${id}.json`), JSON.stringify(message), {
    mode: 0o600,
    flag: "wx",
  });
  await writeFile(
    path.join(directory, `${id}.html`),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Learli local message</title><h1>${message.kind === "verification" ? "Verify your test account" : "Reset your test password"}</h1><p>Local capture only. No email was sent.</p><p>To: ${escape(message.to)}</p><p><a rel="noreferrer" href="${escape(message.url)}">Continue on local Learli</a></p></html>`,
    { mode: 0o600, flag: "wx" },
  );
}
