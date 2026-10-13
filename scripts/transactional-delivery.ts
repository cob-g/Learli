// Explicit operator tool: no web endpoint, periodic loop or automatic startup.
import { loadHostedAuthConfig } from "../src/features/hosted-auth/config-file";
import { drainHostedTransactionalDelivery } from "../src/features/transactional-delivery/operator";

async function main() {
  const args = process.argv.slice(2);
  if (
    args.length > 1 ||
    (args.length === 1 && !/^(?:[1-9]|1[0-9]|2[0-5])$/.test(args[0]))
  )
    throw new Error("Use delivery:drain with an optional limit1–25.");
  const { config } = loadHostedAuthConfig(process.env);
  const result = await drainHostedTransactionalDelivery(config, {
    limit: args.length ? Number(args[0]) : 25,
  });
  // Only bounded counts/status. Never prints config, recipients, proof, bodies or IDs.
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
void main().catch(() => {
  process.stderr.write(
    "Transactional delivery unavailable. Details omitted.\n",
  );
  process.exitCode = 1;
});
