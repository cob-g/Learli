import { googleMeetWorkerGrantsSql } from "./google-meet-worker-grants";
import { prepareGoogleMeetPrivateDirectory } from "./google-meet-local-files";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Pool } from "pg";
import { z } from "zod";

/** Deliberate owned-local operator action. No migration, Google call or app start. */
async function main() {
  if (
    process.argv.slice(2).join(" ") !== "--prepare-local" ||
    !existsSync(".local/postgres/learli-owned")
  )
    throw new Error();
  const target = ".local/google-meet/worker.env";
  if (existsSync(target)) throw new Error();
  prepareGoogleMeetPrivateDirectory(".local/google-meet");
  const state = z
    .object({
      ownerPassword: z.string().min(1),
      ports: z.object({ database: z.number().int().min(1024).max(65535) }),
    })
    .parse(JSON.parse(readFileSync(".local/database.json", "utf8")));
  const pool = new Pool({
    host: "127.0.0.1",
    port: state.ports.database,
    database: "learli_dev",
    user: "learli_owner",
    password: state.ownerPassword,
    max: 1,
  });
  try {
    const role = await pool.query(
      "SELECT 1 FROM pg_roles WHERE rolname='learli_meet_worker'",
    );
    if (!role.rowCount)
      await pool.query(
        "CREATE ROLE learli_meet_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS",
      );
    const check = await pool.query(
      `SELECT NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND NOT rolcanlogin AS safe FROM pg_roles WHERE rolname='learli_meet_worker'`,
    );
    if (!check.rows[0]?.safe) throw new Error();
    if (
      !(
        await pool.query(
          "SELECT to_regprocedure('public.google_meet_claim(text,uuid)') IS NOT NULL AS migrated",
        )
      ).rows[0]?.migrated
    )
      throw new Error();
    await pool.query(googleMeetWorkerGrantsSql);
    const password = randomBytes(32).toString("hex");
    // Only generated hex enters this identifier-specific DDL; never logged.
    await pool.query(
      `ALTER ROLE learli_meet_worker LOGIN PASSWORD '${password}'`,
    );
    await pool.query(
      "GRANT CONNECT ON DATABASE learli_dev TO learli_meet_worker",
    );
    const url = `postgresql://learli_meet_worker:${password}@127.0.0.1:${state.ports.database}/learli_dev`;
    writeFileSync(target, `GOOGLE_MEET_WORKER_DATABASE_URL=${url}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    console.log(
      "Restricted local worker credential prepared in the ignored owner-only worker.env. Values omitted.",
    );
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Worker preparation refused or incomplete. Preserve local state and inspect ownership/configuration; no credentials printed.",
  );
  process.exitCode = 1;
});
