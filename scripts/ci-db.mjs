// Prepares only an ephemeral loopback PostgreSQL service inside a CI job.
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import pg from "pg";
if (process.env.CI !== "true" || !process.env.LOCAL_CI_OWNER_PASSWORD)
  throw new Error("CI-local setup only.");
const ownerPassword = process.env.LOCAL_CI_OWNER_PASSWORD;
const appPassword = randomBytes(32).toString("hex");
const pool = new pg.Pool({
  host: "127.0.0.1",
  port: 55432,
  database: "postgres",
  user: "learli_owner",
  password: ownerPassword,
  max: 1,
});
try {
  await pool.query(
    `CREATE ROLE learli_app LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
  );
  await pool.query("CREATE DATABASE learli_test OWNER learli_owner");
  await pool.query("REVOKE ALL ON DATABASE learli_test FROM PUBLIC");
  await pool.query("GRANT CONNECT ON DATABASE learli_test TO learli_app");
  writeFileSync(
    ".env.test.local",
    `APP_ENV=test\nAUTH_MODE=local\nAPP_URL=http://127.0.0.1:3100\nBETTER_AUTH_URL=http://127.0.0.1:3100\nBETTER_AUTH_SECRET=${randomBytes(48).toString("hex")}\nDATABASE_URL=postgresql://learli_app:${appPassword}@127.0.0.1:55432/learli_test\nDATABASE_URL_DIRECT=postgresql://learli_owner:${encodeURIComponent(ownerPassword)}@127.0.0.1:55432/learli_test\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log("Ephemeral loopback CI database prepared.");
} catch {
  console.error("CI database setup failed; credentials omitted.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
