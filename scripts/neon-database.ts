// Deliberate CLI only. Does not load dotenv or select application configuration.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  neonOperationConfig,
  type NeonOperationConfig,
} from "../src/lib/db/neon-operation-config";
import { openVerifiedOperationConnection } from "../src/lib/db/staging-connection";
import { runDatabaseMain } from "./staging-database";
import { digest, MigrationFault } from "./staging-migrations/journal";
import type { StagingPurpose } from "../src/lib/db/staging-config";

export function inspectNeonConfiguration(
  value: unknown,
  target: unknown,
  purpose: StagingPurpose,
) {
  const parsed = z
    .strictObject({
      APP_ENV: z.enum(["development", "production"]),
      NEON_RUNTIME_INSPECTION_URL: z.string().min(1),
      NEON_MIGRATION_URL: z.string().min(1),
    })
    .safeParse(value);
  if (!parsed.success) throw new MigrationFault("config_invalid");
  const runtime = neonOperationConfig({
    appEnv: parsed.data.APP_ENV,
    url: parsed.data.NEON_RUNTIME_INSPECTION_URL,
    target,
    purpose:
      parsed.data.APP_ENV === "production" ? "inspect-runtime" : "runtime",
  });
  const owner = neonOperationConfig({
    appEnv: parsed.data.APP_ENV,
    url: parsed.data.NEON_MIGRATION_URL,
    target,
    purpose,
  });
  const targetHash = digest(JSON.stringify(owner.target));
  return {
    runtime,
    owner,
    identity: {
      environment: owner.target.environment,
      database: owner.target.database,
      migrationRole: owner.target.migrationRole,
      targetHash,
    },
    summary: {
      version: 1,
      status: "PASS",
      operation: "inspect-config",
      environment: owner.target.environment,
      targetHash,
      network: "NOT RUN",
    },
  };
}
export function neonMain(argv: string[], root = process.cwd()) {
  return runDatabaseMain<NeonOperationConfig>(
    argv,
    root,
    inspectNeonConfiguration,
    openVerifiedOperationConnection,
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await neonMain(process.argv.slice(2));
  console.log(JSON.stringify(result));
  process.exitCode = result.status === "PASS" ? 0 : 1;
}
