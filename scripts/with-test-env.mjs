import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
const env = {
  ...process.env,
  ...parseEnv(readFileSync(".env.test.local", "utf8")),
};
if (env.APP_ENV !== "test" || env.AUTH_MODE !== "local")
  throw new Error("Dedicated local test configuration required.");
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A test command is required.");
const child = spawn(command, args, { stdio: "inherit", env });
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
child.on("error", () => {
  console.error("Test command could not start.");
  process.exitCode = 1;
});
