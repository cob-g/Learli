import { Pool } from "pg";
import { localDatabaseConfig } from "@/lib/db/local-config";

export function assertGoogleMeetDatabasePair(
  applicationUrl: string | undefined,
  workerUrl: string | undefined,
) {
  const app = localDatabaseConfig(applicationUrl),
    worker = localDatabaseConfig(workerUrl);
  if (
    app.user !== "learli_app" ||
    worker.user !== "learli_meet_worker" ||
    app.database !== "learli_dev" ||
    worker.database !== app.database ||
    worker.host !== app.host ||
    worker.port !== app.port
  )
    throw new Error(
      "Meeting worker and application must use the same isolated local target.",
    );
}

export async function createGoogleMeetWorkerDatabase(
  value: string | undefined,
) {
  const config = localDatabaseConfig(value);
  if (config.user !== "learli_meet_worker" || config.database !== "learli_dev")
    throw new Error("Dedicated local meeting worker identity required.");
  const pool = new Pool({ ...config, max: 1, statement_timeout: 15_000 });
  pool.on("error", () => {
    /* Caller health checks report only safe failures. */
  });
  try {
    const result = await pool.query<{
      safe: boolean;
    }>(`SELECT current_user='learli_meet_worker' AND session_user='learli_meet_worker'
      AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolreplication AND NOT r.rolbypassrls
      AND NOT EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid)
      AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p','v','m')
        AND (has_table_privilege(current_user,c.oid,'SELECT') OR has_table_privilege(current_user,c.oid,'INSERT') OR has_table_privilege(current_user,c.oid,'UPDATE') OR has_table_privilege(current_user,c.oid,'DELETE')))
      AS safe FROM pg_roles r WHERE r.rolname=current_user`);
    if (!result.rows[0]?.safe) throw new Error();
    return pool;
  } catch {
    await pool.end();
    throw new Error("Meeting worker database access refused. Details omitted.");
  }
}
