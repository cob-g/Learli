import { spawn } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { parseEnv } from "node:util";
import path from "node:path";

const expected = path.resolve(".local/local-operation-20261018/fixture");
const selected = process.env.LOCAL_OPERATION_FIXTURE_ROOT;
function privateEntry(file, directory = false) {
  const stat = lstatSync(file);
  if (
    stat.isSymbolicLink() ||
    (directory ? !stat.isDirectory() : !stat.isFile()) ||
    stat.uid !== process.getuid?.() ||
    (stat.mode & 0o7777) !== (directory ? 0o700 : 0o600)
  )
    throw new Error("Owned operation fixture required. Values omitted.");
}
if (!selected || selected !== expected || realpathSync(selected) !== expected)
  throw new Error("Explicit isolated operation fixture required.");
privateEntry(selected, true);
const envFile = path.join(selected, ".env.operation.test.local");
privateEntry(envFile);
const stateFile = path.join(selected, ".local/database.json");
privateEntry(stateFile);
const state = JSON.parse(readFileSync(stateFile, "utf8"));
const configured = parseEnv(readFileSync(envFile, "utf8"));
const url = new URL(configured.DATABASE_URL);
if (
  state.ports.database !== 55434 ||
  state.ports.development !== 3300 ||
  state.ports.test !== 3301 ||
  url.hostname !== "127.0.0.1" ||
  url.port !== "55434" ||
  url.pathname !== "/learli_dev" ||
  url.username !== "learli_app" ||
  configured.APP_ENV !== "development" ||
  configured.APP_URL !== "http://127.0.0.1:3300" ||
  configured.LOCAL_WORKFLOW_MODE !== "enabled" ||
  configured.DATABASE_URL_DIRECT
)
  throw new Error(
    "Isolated operation fixture binding refused. Values omitted.",
  );
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A fixture test command is required.");
const env = {
  ...process.env,
  DATABASE_URL_DIRECT: "",
  NEON_DEVELOPMENT_CONFIG_FILE: "",
  PRIVATE_WORKFLOW_CONFIG_FILE: "",
  HOSTED_AUTH_CONFIG_FILE: "",
  HOSTED_INGRESS_SECRET: "",
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
  ...configured,
  LOCAL_OPERATION_FIXTURE_ROOT: selected,
};
const child = spawn(command, args, { stdio: "inherit", env });
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
child.on("error", () => {
  console.error("Operation fixture test command could not start.");
  process.exitCode = 1;
});
