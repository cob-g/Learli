// Explicit bounded local invocation. No web route, timer or provider client.
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { createDatabase } from "../src/lib/db/connection";
import { parseServerEnv } from "../src/lib/env/schema";
import { dispatchPendingBookingNotices } from "../src/features/booking-notifications/dispatch";

async function main() {
  const args = process.argv.slice(2);
  const testing = args.includes("--test");
  const seen = new Set<string>();
  let limit = 25,
    eventId: string | undefined;
  for (const arg of args) {
    const name = arg.split("=")[0];
    if (seen.has(name)) throw new Error();
    seen.add(name);
    if (/^--limit=\d+$/.test(arg)) limit = Number(arg.slice(8));
    else if (arg.startsWith("--event=")) eventId = z.uuid().parse(arg.slice(8));
    else if (arg !== "--test") throw new Error();
  }
  if (!existsSync(".local/postgres/learli-owned")) throw new Error();
  process.loadEnvFile(testing ? ".env.test.local" : ".env.local");
  const env = parseServerEnv(process.env);
  const environment = testing ? "test" : "development";
  if (env.APP_ENV !== environment || env.AUTH_MODE !== "local")
    throw new Error();
  // Read only the ownership port; never output the private credential manifest.
  const ownedPort = z
    .object({ ports: z.object({ database: z.number().int() }) })
    .parse(JSON.parse(readFileSync(".local/database.json", "utf8")))
    .ports.database;
  const runtime = createDatabase(env.DATABASE_URL ?? "", testing);
  try {
    if (runtime.pool.options.port !== ownedPort) throw new Error();
    const result = await dispatchPendingBookingNotices(
      { pool: runtime.pool, environment, origin: env.APP_URL },
      { limit, eventId },
    );
    console.log(
      `Local capture only. No email was sent. No confirmed lesson. Captured: ${result.captured}; suppressed: ${result.suppressed}; retryable: ${result.retryable}; skipped: ${result.skipped}.`,
    );
    if (result.retryable) process.exitCode = 1;
  } finally {
    await runtime.pool.end();
  }
}
main().catch(() => {
  console.error(
    "Local notice capture stopped safely. Use --limit=1..25, optional --event=<committed-event-uuid> and --test only for the owned test environment; details omitted.",
  );
  process.exitCode = 1;
});
