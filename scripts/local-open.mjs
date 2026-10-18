import { readdirSync, existsSync, lstatSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const kind = process.argv[2];
let file;
if (kind === "fixtures") file = path.resolve(".local/fixtures.html");
else {
  const directory = path.resolve(".local/mail/development");
  let current = process.cwd();
  for (const segment of [".local", "mail", "development"]) {
    current = path.join(current, segment);
    if (!existsSync(current)) break;
    const stat = lstatSync(current);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== process.getuid?.() ||
      (stat.mode & 0o7777) !== 0o700
    )
      throw new Error("Private local mailbox is unavailable. Details omitted.");
  }
  const latest = existsSync(directory)
    ? readdirSync(directory)
        .filter((f) => /^\d+-[a-f0-9-]{36}\.html$/.test(f))
        .sort()
        .at(-1)
    : undefined;
  if (latest) {
    file = path.join(directory, latest);
    const stat = lstatSync(file);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.uid !== process.getuid?.() ||
      (stat.mode & 0o7777) !== 0o600 ||
      stat.nlink !== 1
    )
      throw new Error("Private local message is unavailable. Details omitted.");
  }
}
if (!file || !existsSync(file)) {
  console.error("No local capture is available yet.");
  process.exitCode = 1;
} else {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "explorer.exe"
        : "xdg-open";
  const result = spawnSync(command, [file], { stdio: "ignore" });
  if (result.status !== 0) {
    console.error("Open the private HTML file under .local manually.");
    process.exitCode = 1;
  } else console.log("Opened the private local file. No message was sent.");
}
