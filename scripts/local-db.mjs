import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import pg from "pg";

const root = process.cwd();
const local = path.join(root, ".local");
const data = path.join(local, "postgres", "data");
const marker = path.join(local, "postgres", "learli-owned");
const statePath = path.join(local, "database.json");
function localPort(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1024 || value > 65535)
    throw new Error(
      `Invalid ${name}; use a local port between 1024 and 65535.`,
    );
  return value;
}
const savedPorts = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8")).ports
  : undefined;
const port = localPort("LEARLI_DB_PORT", savedPorts?.database ?? 55432);
const devPort = localPort("LEARLI_DEV_PORT", savedPorts?.development ?? 3000);
const testPort = localPort("LEARLI_TEST_PORT", savedPorts?.test ?? 3100);
const action = process.argv[2] ?? "start";
const binaries = process.env.PG_BIN;
const binary = (name) => (binaries ? path.join(binaries, name) : name);
function run(name, args, allowFailure = false) {
  const result = spawnSync(binary(name), args, { encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      `Local ${name} failed. Check PostgreSQL tools and the private .local/postgres/server.log; no database was reset.`,
    );
  }
  return result.status;
}
function writePrivate(file, value) {
  writeFileSync(file, value, { mode: 0o600, flag: "wx" });
}
async function main() {
  if (!["start", "stop", "status"].includes(action))
    throw new Error("Use db:start, db:stop or db:status.");
  if (action !== "start") {
    if (!existsSync(marker)) throw new Error("No owned local cluster exists.");
    if (action === "status") {
      console.log(
        run("pg_ctl", ["-D", data, "status"], true) === 0
          ? "Local PostgreSQL is running."
          : "Local PostgreSQL is stopped.",
      );
      return;
    }
    if (run("pg_ctl", ["-D", data, "status"], true) === 0)
      run("pg_ctl", ["-D", data, "stop", "-m", "fast"]);
    console.log("Local PostgreSQL stopped; data preserved.");
    return;
  }
  if (
    savedPorts &&
    (savedPorts.database !== port ||
      savedPorts.development !== devPort ||
      savedPorts.test !== testPort)
  )
    throw new Error("Existing local ports cannot be changed by setup.");
  mkdirSync(path.join(local, "postgres", "socket"), {
    recursive: true,
    mode: 0o700,
  });
  if (existsSync(data) && !existsSync(marker))
    throw new Error("Refusing to adopt an unrecognized PostgreSQL directory.");
  if (!existsSync(statePath)) {
    if (existsSync(data))
      throw new Error(
        "Local credentials are missing; refusing to change existing data.",
      );
    writePrivate(
      statePath,
      JSON.stringify({
        ports: { database: port, development: devPort, test: testPort },
        ownerPassword: randomBytes(32).toString("hex"),
        appPassword: randomBytes(32).toString("hex"),
      }),
    );
  }
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  if (!existsSync(path.join(data, "PG_VERSION"))) {
    const passFile = path.join(local, "postgres", "init-password");
    if (!existsSync(passFile)) writePrivate(passFile, state.ownerPassword);
    run("initdb", [
      "-D",
      data,
      "-U",
      "learli_owner",
      "--auth=scram-sha-256",
      "--pwfile",
      passFile,
      "--encoding=UTF8",
      "--locale=C",
    ]);
    writePrivate(marker, "Learli local development cluster\n");
  }
  if (run("pg_ctl", ["-D", data, "status"], true) !== 0) {
    // All socket/listener paths belong to this repo. No system service is changed.
    run("pg_ctl", [
      "-D",
      data,
      "-l",
      path.join(local, "postgres", "server.log"),
      "-o",
      `-c timezone=UTC -c log_timezone=UTC -h 127.0.0.1 -p ${port} -k '${path.join(local, "postgres", "socket")}'`,
      "-w",
      "start",
    ]);
  }
  const pool = new pg.Pool({
    host: "127.0.0.1",
    port,
    user: "learli_owner",
    password: state.ownerPassword,
    database: "postgres",
    max: 1,
  });
  try {
    const role = await pool.query(
      "SELECT 1 FROM pg_roles WHERE rolname = 'learli_app'",
    );
    if (!role.rowCount) {
      // Password is a generated hex value, never user input or printed SQL.
      if (!/^[a-f0-9]{64}$/.test(state.appPassword))
        throw new Error("Invalid local credential state.");
      await pool.query(
        `CREATE ROLE learli_app LOGIN PASSWORD '${state.appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
      );
    }
    for (const name of ["learli_dev", "learli_test"]) {
      const found = await pool.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [name],
      );
      if (!found.rowCount)
        await pool.query(`CREATE DATABASE ${name} OWNER learli_owner`);
      await pool.query(`REVOKE ALL ON DATABASE ${name} FROM PUBLIC`);
      await pool.query(`GRANT CONNECT ON DATABASE ${name} TO learli_app`);
    }
  } finally {
    await pool.end();
  }
  // A cluster set up before the ports were saved has none on record, and the
  // tools that confirm this checkout owns its test database read the port from
  // here. The owner connection above has just proved the one in use.
  if (!state.ports) {
    const next = `${statePath}.next`;
    writePrivate(
      next,
      JSON.stringify({
        ports: { database: port, development: devPort, test: testPort },
        ...state,
      }),
    );
    renameSync(next, statePath);
  }
  for (const [file, db, env, appPort] of [
    [".env.local", "learli_dev", "development", devPort],
    [".env.test.local", "learli_test", "test", testPort],
  ]) {
    if (existsSync(file)) continue; // Never overwrite existing user configuration.
    writePrivate(
      file,
      `# Generated by Learli local setup. Private; never commit.\nAPP_ENV=${env}\nAPP_URL=http://127.0.0.1:${appPort}\nAUTH_MODE=local\nDATABASE_URL=postgresql://learli_app:${state.appPassword}@127.0.0.1:${port}/${db}\nDATABASE_URL_DIRECT=postgresql://learli_owner:${state.ownerPassword}@127.0.0.1:${port}/${db}\nBETTER_AUTH_URL=http://127.0.0.1:${appPort}\nBETTER_AUTH_SECRET=${randomBytes(48).toString("hex")}\n`,
    );
  }
  console.log(
    `Local PostgreSQL ready on 127.0.0.1:${port}. Development/test databases are separate. Existing environment files preserved.`,
  );
}
main().catch(() => {
  console.error(
    "Local database setup could not complete. Check PostgreSQL 17 tools, the configured local port, and private .local/postgres/server.log. Existing data was not reset.",
  );
  process.exitCode = 1;
});
