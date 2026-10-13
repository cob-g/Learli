// Test-only owned loopback PostgreSQL. No staging/production exports consume this.
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { Pool, type PoolConfig } from "pg";

export function stagingTlsTestPort(value: string | undefined) {
  const text = value ?? "55701";
  const port = Number(text);
  if (
    !/^[0-9]+$/.test(text) ||
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535
  )
    throw new Error("Invalid assigned staging TLS test port.");
  return port;
}
function privateFile(file: string, value: string) {
  writeFileSync(file, value, { mode: 0o600, flag: "wx" });
}
async function assertFreePort(port: number) {
  await new Promise<void>((resolve, reject) => {
    const listener = createServer();
    listener.once("error", () =>
      reject(new Error("Assigned TLS port is unavailable.")),
    );
    listener.listen(port, "127.0.0.1", () =>
      listener.close((error) => (error ? reject(error) : resolve())),
    );
  });
}
export async function createStagingTlsHarness(
  options: { neonBootstrap?: boolean } = {},
) {
  if (process.env.APP_ENV !== "test")
    throw new Error(
      "TLS harness requires the isolated local test environment.",
    );
  const port = stagingTlsTestPort(process.env.LEARLI_STAGING_TEST_PORT);
  await assertFreePort(port);
  const parent = path.resolve(".local/staging-database-wave");
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const directory = mkdtempSync(path.join(parent, "tls-"));
  chmodSync(directory, 0o700);
  const data = path.join(directory, "data");
  const log = path.join(directory, "server.log");
  const binary = (name: string) =>
    process.env.PG_BIN ? path.join(process.env.PG_BIN, name) : name;
  function run(command: string, args: string[]) {
    const result = spawnSync(command, args, {
      cwd: directory,
      encoding: "utf8",
      timeout: 30_000,
    });
    if (result.status !== 0) {
      writeFileSync(
        path.join(directory, "command-failure.log"),
        `${result.stdout}\n${result.stderr}`,
        { mode: 0o600 },
      );
      throw new Error(
        "Owned TLS harness command failed; private evidence retained.",
      );
    }
  }
  function openssl(args: string[]) {
    run("openssl", args);
  }
  const adminPassword = randomBytes(32).toString("hex");
  const ownerPassword = randomBytes(32).toString("hex");
  const runtimePassword = randomBytes(32).toString("hex");
  privateFile(path.join(directory, "init-password"), adminPassword);
  run(binary("initdb"), [
    "-D",
    data,
    "-U",
    "tls_admin",
    "--auth=scram-sha-256",
    "--pwfile",
    path.join(directory, "init-password"),
    "--encoding=UTF8",
    "--locale=C",
  ]);
  privateFile(
    path.join(directory, "learli-owned"),
    `Builder A isolated synthetic TLS cluster; port${port}\n`,
  );
  for (const name of ["ca", "untrusted-ca"]) {
    openssl([
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      `${name}.key`,
      "-out",
      `${name}.crt`,
      "-days",
      "2",
      "-subj",
      `/CN=Learli private ${name}`,
    ]);
    chmodSync(path.join(directory, `${name}.key`), 0o600);
  }
  privateFile(path.join(directory, "index"), "");
  privateFile(path.join(directory, "serial"), "01\n");
  mkdirSync(path.join(directory, "certificates"), { mode: 0o700 });
  // Paths are supplied via cwd-relative OpenSSL config, never shell interpolation.
  privateFile(
    path.join(directory, "ca.conf"),
    `[ca]\ndefault_ca=issuer\n[issuer]\ndatabase=index\nserial=serial\nnew_certs_dir=certificates\ncertificate=ca.crt\nprivate_key=ca.key\ndefault_md=sha256\ndefault_days=2\npolicy=subject_policy\nunique_subject=no\n[subject_policy]\ncommonName=supplied\n`,
  );
  for (const name of ["trusted", "expired", "mismatch"] as const) {
    openssl([
      "req",
      "-new",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      `${name}.key`,
      "-out",
      `${name}.csr`,
      "-subj",
      `/CN=Learli ${name}`,
    ]);
    chmodSync(path.join(directory, `${name}.key`), 0o600);
    privateFile(
      path.join(directory, `${name}.ext`),
      `[server]\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=${name === "mismatch" ? "DNS:wrong.learli.test" : "IP:127.0.0.1"}\n`,
    );
    openssl([
      "ca",
      "-batch",
      "-config",
      "ca.conf",
      "-in",
      `${name}.csr`,
      "-out",
      `${name}.crt`,
      "-extfile",
      `${name}.ext`,
      "-extensions",
      "server",
      ...(name === "expired"
        ? ["-startdate", "20200101000000Z", "-enddate", "20210101000000Z"]
        : []),
    ]);
  }
  let running = false;
  function stop() {
    if (!running) return;
    run(binary("pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"]);
    running = false;
  }
  async function start(
    certificate: "trusted" | "expired" | "mismatch" = "trusted",
  ) {
    stop();
    await assertFreePort(port);
    writeFileSync(
      path.join(data, "postgresql.auto.conf"),
      `ssl=on\nssl_cert_file='${path.join(directory, `${certificate}.crt`)}'\nssl_key_file='${path.join(directory, `${certificate}.key`)}'\n`,
      { mode: 0o600 },
    );
    run(binary("pg_ctl"), [
      "-D",
      data,
      "-l",
      log,
      "-o",
      `-h 127.0.0.1 -p ${port} -c unix_socket_directories='' -c log_statement=none -c log_min_error_statement=${options.neonBootstrap ? "error" : "panic"}`,
      "-w",
      "start",
    ]);
    running = true;
    chmodSync(log, 0o600);
  }
  const ca = readFileSync(path.join(directory, "ca.crt"), "utf8");
  const untrustedCa = readFileSync(
    path.join(directory, "untrusted-ca.crt"),
    "utf8",
  );
  function settings(
    role: "learli_app" | "learli_migrator" | "tls_admin" | "neondb_owner",
    trustedCa = ca,
  ): PoolConfig {
    return {
      host: "127.0.0.1",
      port,
      database:
        role === "tls_admin"
          ? "postgres"
          : options.neonBootstrap
            ? "neondb"
            : "learli_staging",
      user: role,
      password:
        role === "learli_app"
          ? runtimePassword
          : ["learli_migrator", "neondb_owner"].includes(role)
            ? ownerPassword
            : adminPassword,
      ssl: { rejectUnauthorized: true, ca: trustedCa },
      max: 5,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
      query_timeout: 10000,
      statement_timeout: 10000,
      options: "-c search_path=pg_catalog,public",
      sslnegotiation: "postgres",
      application_name: "learli-staging-tls-test",
    };
  }
  async function asAdmin<T>(operation: (pool: Pool) => Promise<T>) {
    const pool = new Pool(settings("tls_admin"));
    try {
      return await operation(pool);
    } finally {
      await pool.end();
    }
  }
  try {
    await start();
    await asAdmin(async (pool) => {
      // Only generated hex credentials can reach this private synthetic SQL.
      if (options.neonBootstrap) {
        await pool.query(
          `CREATE ROLE neondb_owner LOGIN PASSWORD '${ownerPassword}' NOSUPERUSER CREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS`,
        );
        await pool.query("CREATE DATABASE neondb OWNER neondb_owner");
        return;
      }
      await pool.query(
        `CREATE ROLE learli_app LOGIN PASSWORD '${runtimePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
      );
      await pool.query(
        `CREATE ROLE learli_migrator LOGIN PASSWORD '${ownerPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
      );
      await pool.query("CREATE DATABASE learli_staging OWNER learli_migrator");
      await pool.query(
        "REVOKE ALL ON DATABASE learli_staging FROM PUBLIC; GRANT CONNECT ON DATABASE learli_staging TO learli_app",
      );
    });
    if (!options.neonBootstrap) {
      const owner = new Pool(settings("learli_migrator"));
      try {
        await owner.query(
          "REVOKE ALL ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO learli_app",
        );
      } finally {
        await owner.end();
      }
    }
    return {
      port,
      directory,
      settings,
      ca,
      untrustedCa,
      start,
      stop,
      asAdmin,
      async activeConnections() {
        return asAdmin(async (pool) =>
          Number(
            (
              await pool.query<{ count: string }>(
                "SELECT count(*) FROM pg_catalog.pg_stat_activity WHERE datname = 'learli_staging'",
              )
            ).rows[0].count,
          ),
        );
      },
    };
  } catch (error) {
    if (running || existsSync(path.join(data, "postmaster.pid"))) {
      running = true;
      stop();
    }
    throw error;
  }
}
export type StagingTlsHarness = Awaited<
  ReturnType<typeof createStagingTlsHarness>
>;
