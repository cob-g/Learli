import {
  constants,
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  stagingDatabaseConfig,
  StagingDatabaseError,
  type StagingPurpose,
} from "../src/lib/db/staging-config";
import { verifyRuntimeGrants } from "./staging-migrations/privileges";
import { openStagingConnection } from "../src/lib/db/staging-connection";
import {
  digest,
  loadCandidate,
  MigrationFault,
} from "./staging-migrations/journal";
import {
  applyPlan,
  inspectTarget,
  planHash,
  validateApplyInputs,
  type Connection,
} from "./staging-migrations/runner";

const configSchema = z
  .object({
    APP_ENV: z.literal("staging"),
    STAGING_DATABASE_URL: z.string().min(1),
    STAGING_DATABASE_URL_DIRECT: z.string().min(1),
  })
  .strict();
/** Pure configuration inspection; no implicit dotenv, environment or I/O. */
export function inspectConfiguration(
  value: unknown,
  target: unknown,
  purpose: StagingPurpose,
) {
  const parsed = configSchema.safeParse(value);
  if (!parsed.success) throw new MigrationFault("config_invalid");
  const runtime = stagingDatabaseConfig({
    appEnv: parsed.data.APP_ENV,
    url: parsed.data.STAGING_DATABASE_URL,
    target,
    purpose: "runtime",
  });
  const owner = stagingDatabaseConfig({
    appEnv: parsed.data.APP_ENV,
    url: parsed.data.STAGING_DATABASE_URL_DIRECT,
    target,
    purpose,
  });
  const targetHash = digest(JSON.stringify(owner.target));
  return {
    runtime,
    owner,
    identity: {
      database: owner.target.database,
      migrationRole: owner.target.migrationRole,
      targetHash,
    },
    summary: {
      version: 1,
      status: "PASS",
      operation: "inspect-config",
      targetHash,
      network: "NOT RUN",
    },
  };
}
function privatePath(root: string, file: string) {
  root = path.resolve(root);
  const local = path.join(root, ".local"),
    resolved = path.resolve(root, file);
  if (!resolved.startsWith(`${local}${path.sep}`))
    throw new MigrationFault("private_file_invalid");
  for (
    let directory = path.dirname(resolved);
    directory !== root;
    directory = path.dirname(directory)
  ) {
    const stat = lstatSync(directory);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== process.getuid?.() ||
      (stat.mode & 0o077) !== 0
    )
      throw new MigrationFault("private_file_invalid");
  }
  return resolved;
}
export function readPrivateJson(root: string, file: string): unknown {
  let fd: number | undefined;
  try {
    const resolved = privatePath(root, file);
    fd = openSync(resolved, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(fd);
    if (
      !stat.isFile() ||
      stat.uid !== process.getuid?.() ||
      (stat.mode & 0o077) !== 0 ||
      stat.size > 65536
    )
      throw new Error();
    return JSON.parse(readFileSync(fd, "utf8"));
  } catch {
    throw new MigrationFault("private_file_invalid");
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
function writePrivateJson(root: string, file: string, value: unknown) {
  try {
    writeFileSync(
      privatePath(root, file),
      `${JSON.stringify(value, null, 2)}\n`,
      { mode: 0o600, flag: "wx" },
    );
  } catch {
    throw new MigrationFault("private_file_invalid");
  }
}
const categories = new Set([
  "config_invalid",
  "connection_failed",
  "identity_mismatch",
  "runtime_privilege",
  "cleanup_failed",
  "candidate_invalid",
  "history_divergent",
  "schema_unrecognized",
  "runtime_role_invalid",
  "migration_prerequisite",
  "grant_mismatch",
  "protection_mismatch",
  "runtime_probe_failed",
  "plan_invalid",
  "plan_mismatch",
  "recovery_required",
  "runner_busy",
  "candidate_changed",
  "plan_stale",
  "private_file_invalid",
  "arguments_invalid",
  "apply_failed",
]);
const safeCategory = (error: unknown) => {
  const code =
    error instanceof MigrationFault
      ? error.category
      : error instanceof StagingDatabaseError
        ? error.code
        : "apply_failed";
  return categories.has(code) ? code : "apply_failed";
};
export async function runDatabaseMain<
  C extends import("../src/lib/db/verified-config").VerifiedDatabaseConfig,
>(
  argv: string[],
  root: string,
  configure: (
    value: unknown,
    target: unknown,
    purpose: StagingPurpose,
  ) => {
    runtime: C;
    owner: C;
    identity: import("./staging-migrations/runner").Identity;
    summary: Record<string, unknown>;
  },
  connect: (config: C) => Promise<Connection>,
) {
  let owner: Connection | undefined, runtime: Connection | undefined;
  let result: Record<string, unknown> = {
    version: 1,
    status: "FAIL",
    category: "arguments_invalid",
  };
  try {
    const operation = argv[0];
    if (!["inspect-config", "inspect", "plan", "apply"].includes(operation))
      throw new MigrationFault("arguments_invalid");
    const values: Record<string, string> = {};
    for (let index = 1; index < argv.length; index += 2) {
      const name = argv[index],
        value = argv[index + 1];
      if (
        ![
          "--config",
          "--target",
          "--out",
          "--plan",
          "--plan-hash",
          "--recovery",
        ].includes(name) ||
        !value ||
        value.startsWith("--") ||
        values[name]
      )
        throw new MigrationFault("arguments_invalid");
      values[name] = value;
    }
    const allowed =
      operation === "apply"
        ? ["--config", "--target", "--plan", "--plan-hash", "--recovery"]
        : operation === "plan"
          ? ["--config", "--target", "--out"]
          : ["--config", "--target"];
    if (
      !values["--config"] ||
      !values["--target"] ||
      Object.keys(values).some((key) => !allowed.includes(key)) ||
      (operation === "plan" && !values["--out"]) ||
      (operation === "apply" && (!values["--plan"] || !values["--plan-hash"]))
    )
      throw new MigrationFault("arguments_invalid");
    const config = configure(
      readPrivateJson(root, values["--config"]),
      readPrivateJson(root, values["--target"]),
      operation === "apply" ? "migrate" : "inspect",
    );
    if (operation === "inspect-config") return config.summary;
    const candidate = loadCandidate(root);
    // Read and validate all operator input before opening a connection.
    const plan =
      operation === "apply"
        ? readPrivateJson(root, values["--plan"])
        : undefined;
    const recovery = values["--recovery"]
      ? readPrivateJson(root, values["--recovery"])
      : undefined;
    if (operation === "apply")
      validateApplyInputs(
        candidate,
        config.identity,
        plan,
        values["--plan-hash"],
        recovery,
      );
    if (operation === "plan") privatePath(root, values["--out"]);
    owner = await connect(config.owner);
    if (operation === "apply") {
      runtime = await connect(config.runtime);
      result = await applyPlan({
        owner,
        runtime,
        candidate,
        identity: config.identity,
        plan,
        recovery,
        expectedPlanHash: values["--plan-hash"],
        recheckCandidate: () => loadCandidate(root),
      });
    } else {
      const planned = await inspectTarget(owner, candidate, config.identity);
      if (operation === "inspect" && planned.pending.length === 0) {
        await owner.withClient(verifyRuntimeGrants);
        runtime = await connect(config.runtime);
        await runtime.withClient(async () => {});
      }
      if (operation === "plan")
        writePrivateJson(root, values["--out"], planned);
      result = {
        version: 1,
        status: "PASS",
        operation,
        targetHash: config.identity.targetHash,
        candidateHash: candidate.hash,
        planHash: planHash(planned),
        state: planned.state,
        protections: "verified for applied history",
        runtimeGrants:
          operation === "inspect" && planned.pending.length === 0
            ? "verified"
            : "NOT VERIFIED",
        applied: planned.history.length,
        pending: planned.pending.length,
        providerEvidence:
          "Operator execution only; provider verification requires separately retained observed evidence",
      };
    }
  } catch (error) {
    result = { version: 1, status: "FAIL", category: safeCategory(error) };
  } finally {
    const closed = await Promise.allSettled([owner?.close(), runtime?.close()]);
    if (closed.some((value) => value.status === "rejected"))
      result = { ...result, status: "FAIL", category: "cleanup_failed" };
  }
  return result;
}
export function stagingMain(argv: string[], root = process.cwd()) {
  return runDatabaseMain(
    argv,
    root,
    inspectConfiguration,
    openStagingConnection,
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await stagingMain(process.argv.slice(2));
  console.log(JSON.stringify(result));
  process.exitCode = result.status === "PASS" ? 0 : 1;
}
