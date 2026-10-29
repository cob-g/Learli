import { googleMeetChildEnvironments } from "../src/features/google-meet/process-env";
import { spawn } from "node:child_process";
import { googleMeetConfig } from "../src/features/google-meet/config";
import {
  assertGoogleMeetDatabasePair,
  createGoogleMeetWorkerDatabase,
} from "../src/features/google-meet/worker-database";

/** Explicit local launcher only. Never loaded by default dev/start/build/tests. */
async function main() {
  if (process.argv.length !== 2) throw new Error();
  process.loadEnvFile(".env.local");
  if (!googleMeetConfig()) throw new Error();
  assertGoogleMeetDatabasePair(
    process.env.DATABASE_URL,
    process.env.GOOGLE_MEET_WORKER_DATABASE_URL,
  );
  const db = await createGoogleMeetWorkerDatabase(
    process.env.GOOGLE_MEET_WORKER_DATABASE_URL,
  );
  await db.end();
  const childEnv = googleMeetChildEnvironments(process.env);
  let stopping = false;
  const web = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
    ],
    { stdio: "inherit", env: childEnv.web },
  );
  const worker = spawn(
    process.execPath,
    ["--import", "tsx", "scripts/google-meet-worker.ts"],
    { stdio: "inherit", env: childEnv.worker },
  );
  const stop = (code: number) => {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    web.kill("SIGTERM");
    worker.kill("SIGTERM");
    const timer = setTimeout(() => {
      web.kill("SIGKILL");
      worker.kill("SIGKILL");
    }, 20_000);
    timer.unref();
  };
  process.on("SIGINT", () => stop(0));
  process.on("SIGTERM", () => stop(0));
  web.on("error", () => stop(1));
  worker.on("error", () => stop(1));
  web.on("exit", (code) => stop(code ?? 1));
  worker.on("exit", (code) => stop(code ?? 1));
}
main().catch(() => {
  console.error(
    "Google Meet launcher requires complete isolated local configuration and a restricted worker credential. Values omitted; no server started.",
  );
  process.exitCode = 1;
});
