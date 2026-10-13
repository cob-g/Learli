// Deliberate empty-target backup/recovery only. Never resets a provider target.
import { spawnSync } from "node:child_process";
import {
  constants,
  closeSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  neonOperationConfig,
  neonOperationPoolConfig,
  type NeonOperationConfig,
} from "../src/lib/db/neon-operation-config";
import { openVerifiedOperationConnection } from "../src/lib/db/staging-connection";
import { readPrivateJson } from "./staging-database";
import {
  digest,
  loadCandidate,
  MigrationFault,
} from "./staging-migrations/journal";

const pgBin = "/opt/homebrew/opt/libpq/bin";
function privateDirectory(root: string, file: string, create: boolean) {
  const resolved = path.resolve(root, file);
  if (!resolved.startsWith(`${path.resolve(root, ".local")}${path.sep}`))
    throw new MigrationFault("private_file_invalid");
  // Validate parent before creating anything, and never replace an existing run.
  for (
    let dir = path.dirname(resolved);
    dir !== root;
    dir = path.dirname(dir)
  ) {
    const stat = lstatSync(dir);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== process.getuid?.() ||
      stat.mode & 0o077
    )
      throw new MigrationFault("private_file_invalid");
  }
  if (create) mkdirSync(resolved, { mode: 0o700 });
  const stat = lstatSync(resolved);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    stat.uid !== process.getuid?.() ||
    stat.mode & 0o077
  )
    throw new MigrationFault("private_file_invalid");
  return resolved;
}
function archiveBytes(file: string) {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (
      !stat.isFile() ||
      stat.uid !== process.getuid?.() ||
      stat.mode & 0o077 ||
      stat.size > 16_000_000
    )
      throw new MigrationFault("private_file_invalid");
    return readFileSync(fd);
  } finally {
    closeSync(fd);
  }
}
/** No URL/password enters argv, inherited libpq options or output. */
export function recoveryToolEnvironment(config: NeonOperationConfig) {
  const options = neonOperationPoolConfig(config);
  if (config.purpose !== "bootstrap" || config.role !== "neondb_owner")
    throw new MigrationFault("config_invalid");
  return {
    NODE_ENV: "production" as const,
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    LANG: "C",
    LC_ALL: "C",
    PGHOST: config.target.hostname,
    PGPORT: "5432",
    PGDATABASE: config.target.database,
    PGUSER: config.role,
    PGPASSWORD: String(options.password),
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "system",
    PGCHANNELBINDING: "require",
    PGCONNECT_TIMEOUT: "15",
    PGAPPNAME: "learli-neon-recovery",
  };
}
function pgTool(
  name: "pg_dump" | "pg_restore",
  argv: string[],
  config: NeonOperationConfig,
) {
  const command = path.join(pgBin, name),
    env = recoveryToolEnvironment(config);
  const version = spawnSync(command, ["--version"], {
    env,
    encoding: "utf8",
    timeout: 10000,
  });
  if (
    version.status !== 0 ||
    !/^pg_(?:dump|restore) \(PostgreSQL\) 18\./.test(version.stdout)
  )
    throw new MigrationFault("migration_prerequisite");
  const result = spawnSync(command, argv, {
    env,
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 1_000_000,
  });
  // Never log driver/tool details, including private SQL or credential context.
  if (result.status !== 0) throw new MigrationFault("apply_failed");
  return { version: version.stdout.trim(), stdout: result.stdout };
}
async function emptyInventory(config: NeonOperationConfig) {
  const connection = await openVerifiedOperationConnection(config);
  try {
    return await connection.withClient(async (client) => {
      await client.query("BEGIN READ ONLY");
      try {
        const row = (
          await client.query<{
            safe: boolean;
            server_version: number;
            observed_at: string;
            wal_lsn: string;
          }>(`SELECT current_user='neondb_owner' AND session_user=current_user
          AND EXISTS (SELECT 1 FROM pg_database WHERE datname=current_database() AND pg_get_userbyid(datdba)='neondb_owner')
          AND EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='public' AND pg_get_userbyid(nspowner) IN ('pg_database_owner','neondb_owner'))
          AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('learli_app','learli_migrator'))
          AND NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname NOT LIKE 'pg_%')
          AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S'))
          AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')
          AND NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e') AS safe,
          current_setting('server_version_num')::int AS server_version,
          clock_timestamp()::text AS observed_at, pg_current_wal_lsn()::text AS wal_lsn`)
        ).rows[0];
        if (
          !row?.safe ||
          row.server_version < 180000 ||
          row.server_version >= 190000
        )
          throw new MigrationFault("schema_unrecognized");
        await client.query("COMMIT");
        return row;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
  } finally {
    await connection.close();
  }
}
const backupReceiptSchema = z.strictObject({
  version: z.literal(1),
  status: z.literal("PASS"),
  kind: z.literal("empty-production-backup"),
  targetHash: z.string().regex(/^[a-f0-9]{64}$/),
  candidateHash: z.string().regex(/^[a-f0-9]{64}$/),
  archiveHash: z.string().regex(/^[a-f0-9]{64}$/),
  archiveBytes: z.number().int().positive(),
  toolVersion: z.string(),
  restorePointReference: z.string(),
  dataTables: z.literal(0),
});
export async function backupEmptyNeonTarget(
  config: NeonOperationConfig,
  out: string,
  root = process.cwd(),
) {
  recoveryToolEnvironment(config);
  if (config.target.environment !== "production")
    throw new MigrationFault("config_invalid");
  root = path.resolve(root);
  const directory = privateDirectory(root, out, true),
    candidate = loadCandidate(root);
  const before = await emptyInventory(config);
  const file = path.join(directory, "database.dump");
  writeFileSync(file, "", { mode: 0o600, flag: "wx" });
  const tool = pgTool(
    "pg_dump",
    [
      "--no-password",
      "--format=custom",
      "--lock-wait-timeout=10000",
      `--file=${file}`,
    ],
    config,
  );
  const listing = pgTool("pg_restore", ["--list", file], config);
  if (/;?\s\d+\s+\d+\s+TABLE DATA\b/m.test(listing.stdout))
    throw new MigrationFault("schema_unrecognized");
  await emptyInventory(config);
  if (loadCandidate(root).hash !== candidate.hash)
    throw new MigrationFault("candidate_changed");
  const bytes = archiveBytes(file),
    receipt = backupReceiptSchema.parse({
      version: 1,
      status: "PASS",
      kind: "empty-production-backup",
      targetHash: digest(JSON.stringify(config.target)),
      candidateHash: candidate.hash,
      archiveHash: digest(bytes),
      archiveBytes: bytes.length,
      toolVersion: tool.version,
      restorePointReference: `${config.target.branchId}@${before.wal_lsn} observed ${before.observed_at}`,
      dataTables: 0,
    });
  writeFileSync(
    path.join(directory, "backup.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
    { mode: 0o600, flag: "wx" },
  );
  return receipt;
}
export async function restoreEmptyNeonBackup(
  config: NeonOperationConfig,
  source: NeonOperationConfig,
  backup: string,
  out: string,
  root = process.cwd(),
) {
  recoveryToolEnvironment(config);
  // Require the genuine opaque production configuration; never connect it here.
  recoveryToolEnvironment(source);
  if (
    source.target.environment !== "production" ||
    config.target.environment !== "development" ||
    config.target.database !== source.target.database ||
    config.target.projectId !== source.target.projectId ||
    config.target.operatorApproval.sourceBranchId !== source.target.branchId ||
    config.target.branchId === source.target.branchId
  )
    throw new MigrationFault("config_invalid");
  root = path.resolve(root);
  const directory = privateDirectory(root, backup, false),
    destination = privateDirectory(root, out, true);
  const receipt = backupReceiptSchema.parse(
    readPrivateJson(root, path.join(directory, "backup.json")),
  );
  const candidate = loadCandidate(root),
    file = path.join(directory, "database.dump");
  const bytes = archiveBytes(file);
  if (
    receipt.targetHash !== digest(JSON.stringify(source.target)) ||
    receipt.candidateHash !== candidate.hash ||
    receipt.archiveHash !== digest(bytes) ||
    receipt.archiveBytes !== bytes.length
  )
    throw new MigrationFault("plan_mismatch");
  await emptyInventory(config);
  pgTool(
    "pg_restore",
    [
      "--no-password",
      "--exit-on-error",
      "--single-transaction",
      "--no-owner",
      "--no-acl",
      `--dbname=${config.target.database}`,
      file,
    ],
    config,
  );
  await emptyInventory(config);
  if (loadCandidate(root).hash !== candidate.hash)
    throw new MigrationFault("candidate_changed");
  const result = {
    version: 1,
    status: "PASS",
    kind: "empty-backup-development-restore",
    sourceTargetHash: receipt.targetHash,
    destinationTargetHash: digest(JSON.stringify(config.target)),
    candidateHash: candidate.hash,
    archiveHash: receipt.archiveHash,
    realRowsCopied: 0,
    productionRestored: false,
  };
  writeFileSync(
    path.join(destination, "restore.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    { mode: 0o600, flag: "wx" },
  );
  return result;
}
async function main(argv: string[]) {
  try {
    const [operation, ...args] = argv,
      flags = new Map<string, string>();
    if (!["backup", "restore-empty"].includes(operation) || args.length % 2)
      throw new MigrationFault("arguments_invalid");
    const allowed =
      operation === "backup"
        ? ["--config", "--target", "--out"]
        : [
            "--config",
            "--target",
            "--out",
            "--backup",
            "--production-config",
            "--production-target",
          ];
    for (let i = 0; i < args.length; i += 2) {
      if (!allowed.includes(args[i]) || flags.has(args[i]) || !args[i + 1])
        throw new MigrationFault("arguments_invalid");
      flags.set(args[i], args[i + 1]);
    }
    if (flags.size !== allowed.length)
      throw new MigrationFault("arguments_invalid");
    const root = process.cwd(),
      raw = z
        .strictObject({
          APP_ENV: z.enum(["production", "development"]),
          NEON_BOOTSTRAP_URL: z.string().min(1),
        })
        .parse(readPrivateJson(root, flags.get("--config")!));
    const config = neonOperationConfig({
      appEnv: raw.APP_ENV,
      url: raw.NEON_BOOTSTRAP_URL,
      target: readPrivateJson(root, flags.get("--target")!),
      purpose: "bootstrap",
    });
    return operation === "backup"
      ? await backupEmptyNeonTarget(config, flags.get("--out")!, root)
      : await restoreEmptyNeonBackup(
          config,
          neonOperationConfig({
            appEnv: "production",
            url: z
              .strictObject({
                APP_ENV: z.literal("production"),
                NEON_BOOTSTRAP_URL: z.string().min(1),
              })
              .parse(readPrivateJson(root, flags.get("--production-config")!))
              .NEON_BOOTSTRAP_URL,
            target: readPrivateJson(root, flags.get("--production-target")!),
            purpose: "bootstrap",
          }),
          flags.get("--backup")!,
          flags.get("--out")!,
          root,
        );
  } catch (error) {
    return {
      version: 1,
      status: "FAIL",
      category:
        error instanceof MigrationFault ? error.category : "operation_failed",
    };
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await main(process.argv.slice(2));
  console.log(JSON.stringify(result));
  process.exitCode = result.status === "PASS" ? 0 : 1;
}
