// Explicit bounded local recovery only; never a scheduler or public resend API.
import { createLocalAuth } from "../src/lib/auth-factory";
import { drainLocalBookingNotices } from "../src/features/transactional-delivery/local";

async function main() {
  const args = process.argv.slice(2);
  if (
    args.length > 1 ||
    (args.length === 1 && !/^(?:[1-9]|1[0-9]|2[0-5])$/.test(args[0]))
  )
    throw new Error("Use delivery:local with an optional limit 1–25.");
  const runtime = createLocalAuth(process.env);
  try {
    const result = await drainLocalBookingNotices(runtime, {
      limit: args.length ? Number(args[0]) : 25,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await runtime.pool.end();
  }
}
void main().catch(() => {
  process.stderr.write(
    "Local booking delivery unavailable. Details omitted.\n",
  );
  process.exitCode = 1;
});
