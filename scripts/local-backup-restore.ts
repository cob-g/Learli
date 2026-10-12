import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { Client, type ClientConfig } from "pg";

const fail = (code: string): never => {
  throw new Error(
    `Local restore drill refused (${code}); private evidence preserved.`,
  );
};
const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
export function validateRunId(value: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) fail("run-id");
  return value;
}
export function validateRestorePort(value: number, sourcePort: number) {
  if (
    !Number.isInteger(value) ||
    value < 1024 ||
    value > 65535 ||
    value === sourcePort
  )
    fail("restore-port");
  return value;
}
export function normalizeSchema(value: string) {
  // pg_dump 17 emits random psql restriction keys, not schema content.
  return value
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("\\restrict ") &&
        !line.startsWith("\\unrestrict ") &&
        !line.startsWith("--"),
    )
    .join("\n")
    .trim();
}
export function assertPrivatePath(
  root: string,
  file: string,
  directory = false,
) {
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    fail("path-boundary");
  let current = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (lstatSync(current).isSymbolicLink()) fail("symlink");
  }
  const stat = lstatSync(file);
  if (
    (directory ? !stat.isDirectory() : !stat.isFile()) ||
    stat.uid !== process.getuid?.() ||
    (stat.mode & 0o077) !== 0
  )
    fail("private-ownership");
}
function privateWrite(file: string, value: string) {
  writeFileSync(file, value, { mode: 0o600, flag: "wx" });
}
export function readSource(root: string) {
  root = realpathSync(root);
  const local = path.join(root, ".local");
  const data = path.join(local, "postgres", "data");
  for (const directory of [local, path.join(local, "postgres"), data])
    assertPrivatePath(root, directory, true);
  for (const file of [
    ".env.test.local",
    ".local/database.json",
    ".local/postgres/learli-owned",
    ".local/postgres/data/postmaster.pid",
  ])
    assertPrivatePath(root, path.join(root, file));
  if (
    readFileSync(path.join(local, "postgres", "learli-owned"), "utf8") !==
    "Learli local development cluster\n"
  )
    fail("source-marker");
  const state = JSON.parse(
    readFileSync(path.join(local, "database.json"), "utf8"),
  ) as {
    ports: { database: number };
    ownerPassword: string;
    appPassword: string;
  };
  const env = parseEnv(
    readFileSync(path.join(root, ".env.test.local"), "utf8"),
  );
  if (env.APP_ENV !== "test" || env.AUTH_MODE !== "local")
    fail("test-local-only");
  if (
    !/^[a-f0-9]{64}$/.test(state.ownerPassword) ||
    !/^[a-f0-9]{64}$/.test(state.appPassword)
  )
    fail("source-state");
  for (const [key, user, password] of [
    ["DATABASE_URL_DIRECT", "learli_owner", state.ownerPassword],
    ["DATABASE_URL", "learli_app", state.appPassword],
  ]) {
    const url = new URL(env[key] ?? "");
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.hostname !== "127.0.0.1" ||
      url.search ||
      url.hash ||
      url.pathname !== "/learli_test" ||
      Number(url.port) !== state.ports.database ||
      decodeURIComponent(url.username) !== user ||
      decodeURIComponent(url.password) !== password
    )
      fail("source-config");
  }
  const config = {
    host: "127.0.0.1",
    port: state.ports.database,
    user: "learli_owner",
    password: state.ownerPassword,
    database: "learli_test",
    connectionTimeoutMillis: 3000,
  };
  return { root, local, data, config, appPassword: state.appPassword };
}
async function connect(config: ClientConfig) {
  const client = new Client(config);
  client.on("error", () => {}); // never print provider error payloads
  await client.connect();
  await client.query(
    "SET statement_timeout = '30s'; SET lock_timeout = '3s'; SET timezone = 'UTC'",
  );
  return client;
}
async function identity(
  client: Client,
  data: string,
  port: number,
  user: string,
) {
  const row = (
    await client.query<{
      data: string;
      port: number;
      host: string;
      user: string;
      system: string;
      version: number;
      listen: string;
    }>(
      `SELECT current_setting('data_directory') AS data, inet_server_port() AS port, host(inet_server_addr()) AS host, current_user AS "user", system_identifier::text AS system, current_setting('server_version_num')::int AS version, current_setting('listen_addresses') AS listen FROM pg_control_system()`,
    )
  ).rows[0];
  if (
    !row ||
    realpathSync(row.data) !== data ||
    row.port !== port ||
    row.host !== "127.0.0.1" ||
    row.listen !== "127.0.0.1" ||
    row.user !== user ||
    row.version < 170000 ||
    row.version >= 180000
  )
    fail("server-identity");
  const pid = readFileSync(path.join(data, "postmaster.pid"), "utf8").split(
    "\n",
  );
  if (pid[1] !== data || Number(pid[3]) !== port || pid[5] !== "127.0.0.1")
    fail("postmaster-identity");
  return row.system;
}
async function freePort(port: number) {
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () =>
      reject(new Error("Local restore drill refused (occupied-port).")),
    );
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () =>
      server.close(() => resolve()),
    );
  });
}
export function validateOwnedPostmaster(
  pidFile: string,
  command: string,
  data: string,
  port: number,
  token: string,
) {
  const pid = pidFile.split("\n");
  if (
    !/^[1-9][0-9]*$/.test(pid[0]) ||
    pid[1] !== data ||
    Number(pid[3]) !== port ||
    pid[5] !== "127.0.0.1" ||
    !command.trim().includes(`postgres -D ${data} `) ||
    !command.trim().endsWith(`-c cluster_name=${token}`)
  )
    fail("stop-identity");
  return Number(pid[0]);
}
function stopOwnedTarget(
  root: string,
  directory: string,
  data: string,
  port: number,
  token: string,
) {
  // Authority is the new private directory plus actual live process identity,
  // never the outcome of pg_ctl or the subsequent evidence write.
  assertPrivatePath(root, directory, true);
  assertPrivatePath(root, data, true);
  const marker = path.join(directory, "ownership.json");
  assertPrivatePath(root, marker);
  const ownership = JSON.parse(readFileSync(marker, "utf8")) as {
    root: string;
    data: string;
    port: number;
    targetToken: string;
  };
  if (
    ownership.root !== root ||
    ownership.data !== data ||
    ownership.port !== port ||
    ownership.targetToken !== token
  )
    fail("stop-ownership");
  const file = path.join(data, "postmaster.pid");
  if (!existsSync(file)) return;
  assertPrivatePath(root, file);
  const pidFile = readFileSync(file, "utf8");
  const pid = pidFile.split("\n")[0];
  if (!/^[1-9][0-9]*$/.test(pid)) fail("stop-identity");
  const processState = spawnSync("ps", ["-p", pid, "-o", "args="], {
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 64 * 1024,
  });
  if (processState.status !== 0) {
    // A stale PID is safe to leave only when the OS confirms it is absent.
    try {
      process.kill(Number(pid), 0);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ESRCH"
      )
        return;
    }
    fail("stop-process-identity");
  }
  validateOwnedPostmaster(pidFile, processState.stdout, data, port, token);
  if (readFileSync(file, "utf8") !== pidFile) fail("stop-identity-changed");
  runTool("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"], directory);
  if (existsSync(file)) fail("stop-incomplete");
}
function runTool(
  name: string,
  args: string[],
  directory: string,
  passfile?: string,
) {
  const executable = process.env.PG_BIN
    ? path.join(process.env.PG_BIN, name)
    : name;
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
    env: {
      NODE_ENV: "test",
      PATH: process.env.PATH,
      LANG: "C",
      LC_ALL: "C",
      ...(passfile ? { PGPASSFILE: passfile } : {}),
      PGCONNECT_TIMEOUT: "3",
      PGOPTIONS: "-c log_statement=none -c log_min_error_statement=panic",
    },
  });
  privateWrite(
    path.join(directory, `${name}-${randomUUID()}.log`),
    `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  );
  if (result.status !== 0) fail(`tool-${name}`);
  return result.stdout;
}
function passFile(directory: string, config: ClientConfig, label: string) {
  const file = path.join(directory, `${label}.pgpass`);
  privateWrite(
    file,
    `127.0.0.1:${config.port}:${config.database}:${config.user}:${config.password}\n`,
  );
  return file;
}
const toolConnection = (config: ClientConfig) => [
  "--host=127.0.0.1",
  `--port=${config.port}`,
  `--username=${config.user}`,
  `--dbname=${config.database}`,
  "--no-password",
];
async function roles(client: Client) {
  return (
    await client.query(
      `SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls, rolconnlimit, rolconfig FROM pg_roles WHERE rolname IN ('learli_owner','learli_app') ORDER BY rolname`,
    )
  ).rows;
}
type CheckDefinition = { table: string; name: string; definition: string };
export async function canonicalSourceSchema(
  target: Client,
  schema: string,
  checks: CheckDefinition[],
) {
  // PostgreSQL flattens nested AND trees when reparsing pg_dump CHECK SQL.
  // Use its parser, retaining every operand/rule, rather than weakening comparison.
  const replacements = new Map<
    string,
    { original: string; canonical: string }
  >();
  await target.query("BEGIN");
  try {
    for (const check of checks) {
      await target.query(
        `ALTER TABLE public.${quote(check.table)} DROP CONSTRAINT ${quote(check.name)}`,
      );
      await target.query(
        `ALTER TABLE public.${quote(check.table)} ADD CONSTRAINT ${quote(check.name)} ${check.definition}`,
      );
      const canonical = (
        await target.query<{ definition: string }>(
          "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid=$1::regclass AND conname=$2",
          [`public.${quote(check.table)}`, check.name],
        )
      ).rows[0].definition;
      if (replacements.has(check.name)) fail("ambiguous-check-name");
      replacements.set(check.name, { original: check.definition, canonical });
    }
  } finally {
    await target.query("ROLLBACK");
  }
  const seen = new Set<string>();
  const result = schema
    .split("\n")
    .map((line) => {
      for (const [name, value] of replacements) {
        if (
          line.includes(`CONSTRAINT ${name} `) ||
          line.includes(`CONSTRAINT ${quote(name)} `)
        ) {
          if (!line.includes(value.original)) fail("check-schema-shape");
          seen.add(name);
          // Replacement strings interpret $' regex anchors as suffix insertion.
          return line.replace(value.original, () => value.canonical);
        }
      }
      return line;
    })
    .join("\n");
  if (seen.size !== checks.length) fail("check-schema-coverage");
  return result;
}
export async function snapshot(client: Client) {
  const tables = (
    await client.query<{ schema: string; name: string }>(
      `SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' AND c.relkind='r' ORDER BY n.nspname,c.relname`,
    )
  ).rows;
  const rows = [];
  for (const table of tables) {
    const values = (
      await client.query<{ value: string }>(
        `SELECT to_jsonb(t)::text AS value FROM ${quote(table.schema)}.${quote(table.name)} t ORDER BY to_jsonb(t)::text COLLATE "C" LIMIT 100001`,
      )
    ).rows;
    if (values.length > 100000) fail("bounded-data");
    rows.push({
      table: `${table.schema}.${table.name}`,
      count: values.length,
      sha256: hash(JSON.stringify(values.map(({ value }) => value))),
    });
  }
  const acl = (
    await client.query(
      `SELECT n.nspname, c.relname, c.relkind, pg_get_userbyid(c.relowner) AS owner,
        (SELECT jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(x.grantor),'grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY x.grantor,x.grantee,x.privilege_type,x.is_grantable)
         FROM aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,c.relowner))) x) AS privileges,
        c.relrowsecurity,c.relforcerowsecurity
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','drizzle') ORDER BY 1,2`,
    )
  ).rows;
  const columns = (
    await client.query(
      `SELECT n.nspname,c.relname,a.attname,a.attacl::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','drizzle') AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1,2,3`,
    )
  ).rows;
  const sequences = [];
  for (const sequence of (
    await client.query<{ schemaname: string; sequencename: string }>(
      `SELECT schemaname,sequencename FROM pg_sequences WHERE schemaname IN ('public','drizzle') ORDER BY 1,2`,
    )
  ).rows) {
    const value = (
      await client.query(
        `SELECT last_value::text,is_called FROM ${quote(sequence.schemaname)}.${quote(sequence.sequencename)}`,
      )
    ).rows[0];
    sequences.push({ ...sequence, ...value });
  }
  const migrations = (
    await client.query<{ hash: string; created_at: string }>(
      "SELECT hash,created_at::text FROM drizzle.__drizzle_migrations ORDER BY created_at,id",
    )
  ).rows;
  const database = (
    await client.query(
      `SELECT pg_get_userbyid(datdba) AS owner, datacl::text, pg_encoding_to_char(encoding) AS encoding, datcollate, datctype FROM pg_database WHERE datname=current_database()`,
    )
  ).rows[0];
  const constraints = (
    await client.query(
      `SELECT conname,contype,convalidated FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname`,
    )
  ).rows;
  return {
    rows,
    acl,
    columns,
    sequences,
    migrations,
    database,
    constraints,
    roles: await roles(client),
  };
}
function checkMigrations(
  root: string,
  migrations: { hash: string; created_at: string }[],
) {
  const journal = JSON.parse(
    readFileSync(path.join(root, "drizzle/meta/_journal.json"), "utf8"),
  ) as { entries: { tag: string; when: number }[] };
  const expected = journal.entries.map((entry) => ({
    hash: hash(readFileSync(path.join(root, `drizzle/${entry.tag}.sql`))),
    created_at: String(entry.when),
  }));
  if (JSON.stringify(migrations) !== JSON.stringify(expected))
    fail("migration-state");
}
async function denied(client: Client, sql: string, code: string) {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    fail("probe-unexpected-success");
  } catch (error) {
    if (!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === code
    ))
      fail("probe-wrong-failure");
  } finally {
    await client.query("ROLLBACK");
  }
}
async function probes(owner: Client, appConfig: ClientConfig) {
  const app = await connect(appConfig);
  try {
    for (const sql of [
      "SELECT * FROM audit_events",
      "UPDATE user_access SET status=status",
      "DELETE FROM bookings",
      "INSERT INTO user_roles (user_id,role) VALUES ('not-an-account','admin')",
      "CREATE TABLE public.restore_escape(id int)",
    ])
      await denied(app, sql, "42501");
    await denied(
      owner,
      `INSERT INTO subjects (id,slug,name,category) VALUES (gen_random_uuid(),'restore-invalid','Synthetic invalid','not-a-category')`,
      "23514",
    );
    await denied(
      owner,
      `INSERT INTO user_roles (user_id,role) VALUES ('restore-missing-user','tutor')`,
      "23503",
    );
    const duplicate = (
      await owner.query<{ sql: string }>(
        `SELECT 'INSERT INTO bookings SELECT (jsonb_populate_record(NULL::bookings, to_jsonb(b) || jsonb_build_object(''id'',gen_random_uuid(),''idempotency_key'',gen_random_uuid()))).* FROM bookings b WHERE id=' || quote_literal(id::text) AS sql FROM bookings WHERE state='demo_reserved' LIMIT 1`,
      )
    ).rows[0];
    if (!duplicate) fail("populated-booking-required");
    await denied(owner, duplicate.sql, "23P01");
    await denied(
      owner,
      "UPDATE bookings SET request_fingerprint=repeat('0',64)",
      "23514",
    );
    return {
      runtimeDenials: 5,
      checkConstraint: true,
      foreignKey: true,
      overlapConstraint: true,
      immutableBookingTrigger: true,
    };
  } finally {
    await app.end();
  }
}
export async function drill(
  options: { root?: string; runId?: string; restorePort?: number } = {},
) {
  const source = readSource(options.root ?? process.cwd());
  const runId = validateRunId(options.runId ?? `drill-${randomUUID()}`);
  const port = validateRestorePort(
    options.restorePort ?? 55512,
    source.config.port,
  );
  const base = path.join(source.local, "backup-restore");
  if (!existsSync(base)) mkdirSync(base, { mode: 0o700 });
  assertPrivatePath(source.root, base, true);
  const directory = path.join(base, runId);
  if (existsSync(directory)) fail("existing-target");
  await freePort(port);
  const owner = await connect(source.config);
  let target: Client | undefined;
  let startAttempted = false;
  const targetToken = `learli_restore_${randomBytes(16).toString("hex")}`;
  let targetSystem: string | undefined;
  let success: object | undefined;
  const data = path.join(directory, "data");
  try {
    const sourceSystem = await identity(
      owner,
      source.data,
      source.config.port,
      "learli_owner",
    );
    await owner.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const synthetic = (
      await owner.query<{ unsafe: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM "user" WHERE lower(email) NOT LIKE '%.test') OR EXISTS(SELECT 1 FROM learner_profiles WHERE source<>'local_fixture') OR EXISTS(SELECT 1 FROM bookings WHERE source<>'local_simulation') AS unsafe`,
      )
    ).rows[0];
    if (!synthetic || synthetic.unsafe) fail("synthetic-only");
    const before = await snapshot(owner);
    const checks = (
      await owner.query<CheckDefinition>(
        "SELECT conrelid::regclass::text AS table, conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='c' ORDER BY conname",
      )
    ).rows;
    checkMigrations(source.root, before.migrations);
    if (
      !before.rows.some(
        (row) => row.table === "public.bookings" && row.count > 0,
      )
    )
      fail("populated-booking-required");
    mkdirSync(directory, { mode: 0o700 });
    privateWrite(
      path.join(directory, "ownership.json"),
      JSON.stringify({
        version: 1,
        root: source.root,
        runId,
        data,
        port,
        sourceSystem,
        targetToken,
      }),
    );
    const sourcePass = passFile(directory, source.config, "source");
    const exported = (
      await owner.query<{ snapshot: string }>(
        "SELECT pg_export_snapshot() AS snapshot",
      )
    ).rows[0].snapshot;
    const archive = path.join(directory, "backup.dump");
    runTool(
      "pg_dump",
      [
        ...toolConnection(source.config),
        "--format=custom",
        `--snapshot=${exported}`,
        `--file=${archive}`,
      ],
      directory,
      sourcePass,
    );
    chmodSync(archive, 0o600);
    const originalSchema = normalizeSchema(
      runTool(
        "pg_dump",
        [
          ...toolConnection(source.config),
          "--schema-only",
          `--snapshot=${exported}`,
        ],
        directory,
        sourcePass,
      ),
    );
    await owner.query("ROLLBACK");
    privateWrite(
      path.join(directory, "source-evidence.json"),
      JSON.stringify(
        {
          ...before,
          schemaSha256: hash(originalSchema),
          archiveSha256: hash(readFileSync(archive)),
        },
        null,
        2,
      ),
    );
    const password = randomBytes(32).toString("hex");
    const appPassword = randomBytes(32).toString("hex");
    const initPass = path.join(directory, "init-password");
    privateWrite(initPass, password);
    runTool(
      "initdb",
      [
        "-D",
        data,
        "-U",
        "learli_owner",
        "--auth=scram-sha-256",
        "--encoding=UTF8",
        "--locale=C",
        "--pwfile",
        initPass,
      ],
      directory,
    );
    const log = path.join(directory, "server.log");
    privateWrite(log, "");
    // TCP-only avoids OS Unix-socket length limits in nested worktrees.
    startAttempted = true;
    runTool(
      "pg_ctl",
      [
        "-D",
        data,
        "-l",
        log,
        "-o",
        `-h 127.0.0.1 -p ${port} -k '' -c timezone=UTC -c log_statement=none -c log_min_error_statement=panic -c cluster_name=${targetToken}`,
        "-w",
        "start",
      ],
      directory,
    );
    const config = { ...source.config, port, password, database: "postgres" };
    target = await connect(config);
    targetSystem = await identity(target, data, port, "learli_owner");
    if (targetSystem === sourceSystem) fail("same-cluster");
    const databases = (
      await target.query<{ datname: string }>(
        "SELECT datname FROM pg_database ORDER BY datname",
      )
    ).rows.map((row) => row.datname);
    const extra = (
      await target.query<{ count: string }>(
        "SELECT count(*)::text FROM pg_class WHERE relnamespace='public'::regnamespace",
      )
    ).rows[0].count;
    if (
      JSON.stringify(databases) !==
        JSON.stringify(["postgres", "template0", "template1"]) ||
      extra !== "0"
    )
      fail("target-not-empty");
    await target.query(
      `CREATE ROLE learli_app LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
    );
    if (JSON.stringify(await roles(target)) !== JSON.stringify(before.roles))
      fail("role-attributes");
    await target.query("CREATE DATABASE learli_test OWNER learli_owner");
    await target.query(
      "REVOKE ALL ON DATABASE learli_test FROM PUBLIC; GRANT CONNECT ON DATABASE learli_test TO learli_app",
    );
    await target.end();
    target = undefined;
    config.database = "learli_test";
    privateWrite(
      path.join(directory, "target-state.json"),
      JSON.stringify({ config, appPassword, system: targetSystem }),
    );
    const targetPass = passFile(directory, config, "target");
    runTool(
      "pg_restore",
      [
        ...toolConnection(config),
        "--exit-on-error",
        "--single-transaction",
        archive,
      ],
      directory,
      targetPass,
    );
    target = await connect(config);
    await identity(target, data, port, "learli_owner");
    const after = await snapshot(target);
    const canonicalSchema = await canonicalSourceSchema(
      target,
      originalSchema,
      checks,
    );
    const restoredSchema = normalizeSchema(
      runTool(
        "pg_dump",
        [...toolConnection(config), "--schema-only"],
        directory,
        targetPass,
      ),
    );
    privateWrite(
      path.join(directory, "target-evidence.json"),
      JSON.stringify(after, null, 2),
    );
    privateWrite(path.join(directory, "canonical-source.sql"), canonicalSchema);
    privateWrite(path.join(directory, "restored-schema.sql"), restoredSchema);
    privateWrite(
      path.join(directory, "comparison.json"),
      JSON.stringify({
        catalogsEqual: JSON.stringify(before) === JSON.stringify(after),
        originalSchemaEqual: originalSchema === restoredSchema,
        canonicalSchemaEqual: canonicalSchema === restoredSchema,
      }),
    );
    if (
      JSON.stringify(before) !== JSON.stringify(after) ||
      canonicalSchema !== restoredSchema
    )
      fail("restored-comparison");
    checkMigrations(source.root, after.migrations);
    const materialCheck =
      checks.find((check) => check.name === "subjects_category_allowed") ??
      fail("negative-check-missing");
    const changedChecks = checks.map((check) =>
      check === materialCheck
        ? { ...check, definition: "CHECK (true)" }
        : check,
    );
    const changedSchema = await canonicalSourceSchema(
      target,
      originalSchema.replace(materialCheck.definition, "CHECK (true)"),
      changedChecks,
    );
    privateWrite(
      path.join(directory, "materially-changed-source.sql"),
      changedSchema,
    );
    if (changedSchema === restoredSchema) fail("material-check-drift-hidden");
    const proof = await probes(target, {
      ...config,
      user: "learli_app",
      password: appPassword,
    });
    if (JSON.stringify(after) !== JSON.stringify(await snapshot(target)))
      fail("probe-rollback");
    const result = {
      status: "PASS",
      runId,
      sourcePort: source.config.port,
      restorePort: port,
      tables: before.rows.length,
      populatedTables: before.rows.filter((row) => row.count > 0).length,
      migrations: before.migrations.length,
      schemaSha256: hash(restoredSchema),
      archiveSha256: hash(readFileSync(archive)),
      exactRowsSchemaGrantsSequencesRoles: true,
      proof: { ...proof, schemaRuleDriftRejected: true },
    };
    success = result;
    return result;
  } catch (error) {
    if (existsSync(directory))
      privateWrite(
        path.join(directory, "failure.json"),
        JSON.stringify({
          status: "FAIL",
          phase: targetSystem
            ? "restore-or-proof"
            : startAttempted
              ? "target-identity"
              : "backup-or-init",
          code:
            error instanceof Error &&
            /^Local restore drill refused/.test(error.message)
              ? error.message
              : "Operational failure; payload omitted.",
        }),
      );
    throw new Error(
      "Local restore drill failed; inspect private evidence and retry only with a new target.",
    );
  } finally {
    const closures = await Promise.allSettled([target?.end(), owner.end()]);
    try {
      if (startAttempted)
        stopOwnedTarget(source.root, directory, data, port, targetToken);
      if (closures.some((closure) => closure.status === "rejected"))
        fail("connection-cleanup");
      if (success)
        privateWrite(
          path.join(directory, "result.json"),
          JSON.stringify(success, null, 2),
        );
    } catch {
      if (!existsSync(path.join(directory, "failure.json")))
        privateWrite(
          path.join(directory, "failure.json"),
          JSON.stringify({
            status: "FAIL",
            phase: "cleanup",
            code: "Owned target cleanup did not complete; no PASS recorded.",
          }),
        );
      throw new Error(
        "Local restore drill cleanup failed; preserve private evidence and inspect owned target status.",
      );
    }
  }
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const [command, runId, restorePort, ...extra] = process.argv.slice(2);
  if (command !== "drill" || extra.length) {
    console.error(
      "Use: tsx scripts/local-backup-restore.ts drill [new-run-id] [restore-port]",
    );
    process.exitCode = 1;
  } else {
    drill({
      runId,
      restorePort: restorePort === undefined ? undefined : Number(restorePort),
    })
      .then((result) =>
        console.log(
          `Local restore drill PASS: ${result.tables} tables, ${result.migrations} migrations; private evidence under .local/backup-restore/${result.runId}. Target stopped; files preserved.`,
        ),
      )
      .catch(() => {
        console.error(
          "Local restore drill refused or failed; private evidence preserved. No existing database was overwritten.",
        );
        process.exitCode = 1;
      });
  }
}
