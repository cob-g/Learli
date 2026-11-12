// Grants fixture placement only for this GitHub Actions workspace's owned cluster.
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

if (
  process.env.CI !== "true" ||
  process.env.GITHUB_ACTIONS !== "true" ||
  !process.env.GITHUB_RUN_ID ||
  !process.env.GITHUB_WORKSPACE ||
  realpathSync(process.env.GITHUB_WORKSPACE) !== realpathSync(".")
)
  throw new Error("GitHub Actions workspace setup only.");

let pool;
try {
  const root = realpathSync(".");
  if (
    readFileSync(".local/postgres/learli-owned", "utf8") !==
    "Learli local development cluster\n"
  )
    throw new Error("Invalid ownership marker.");
  const state = JSON.parse(readFileSync(".local/database.json", "utf8"));
  const port = state.ports?.database;
  if (
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535 ||
    !/^[a-f0-9]{64}$/.test(state.ownerPassword) ||
    !/^[a-f0-9]{64}$/.test(state.appPassword)
  )
    throw new Error("Invalid owned database state.");
  pool = new pg.Pool({
    host: "127.0.0.1",
    port,
    database: "learli_test",
    user: "learli_owner",
    password: state.ownerPassword,
    max: 1,
  });
  const {
    rows: [actual],
  } = await pool.query(
    `SELECT current_database() AS database, current_user AS owner,
      host(inet_server_addr()) AS host, inet_server_port() AS port,
      current_setting('data_directory') AS data_directory`,
  );
  if (
    actual?.database !== "learli_test" ||
    actual.owner !== "learli_owner" ||
    actual.host !== "127.0.0.1" ||
    actual.port !== port ||
    realpathSync(actual.data_directory) !==
      realpathSync(path.join(root, ".local/postgres/data"))
  )
    throw new Error("Unexpected owned database identity.");
  writeFileSync(
    ".local/ci-database.json",
    JSON.stringify({
      kind: "learli-disposable-ci-service",
      sourceRoot: root,
      ports: { database: port },
      ownerPassword: state.ownerPassword,
      appPassword: state.appPassword,
    }),
    { mode: 0o600, flag: "wx" },
  );
  console.log("Owned loopback CI database verified.");
} catch {
  console.error("CI database verification failed; credentials omitted.");
  process.exitCode = 1;
} finally {
  await pool?.end();
}
