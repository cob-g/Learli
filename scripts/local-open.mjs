import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const kind = process.argv[2];
let file;
if (kind === "fixtures") file = path.resolve(".local/fixtures.html");
else {
  const directory = path.resolve(".local/mail/development");
  const latest = existsSync(directory)
    ? readdirSync(directory)
        .filter((f) => f.endsWith(".html"))
        .sort()
        .at(-1)
    : undefined;
  if (latest) file = path.join(directory, latest);
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
