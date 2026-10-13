// Node-only. Read-only validation before every application pool checkout.
import type { ClientBase } from "pg";
import { StagingDatabaseError } from "./staging-config";
import {
  verifiedPoolConfig,
  type VerifiedDatabaseConfig,
} from "./verified-config";
import { verifyNativeTls } from "./native-tls";
import { stagingParameterPrivilegesSafe } from "./staging-runtime-guard";

export async function verifyRuntimeLease(
  client: ClientBase,
  config: VerifiedDatabaseConfig,
): Promise<void> {
  // Opaque registration and process TLS guards apply even to direct validation.
  const options = verifiedPoolConfig(config);
  if (config.purpose !== "runtime" || config.role !== "learli_app")
    throw new StagingDatabaseError("config_invalid");
  try {
    verifyNativeTls(client, options);
    const identity = await client.query<{
      database: string;
      current_role: string;
      session_role: string;
      ssl: boolean;
      replication_role: string;
    }>(`
      SELECT pg_catalog.current_database() AS database,
        current_user AS current_role, session_user AS session_role,
        COALESCE((SELECT ssl FROM pg_catalog.pg_stat_ssl
          WHERE pid = pg_catalog.pg_backend_pid()), false) AS ssl,
        pg_catalog.current_setting('session_replication_role') AS replication_role
    `);
    const row = identity.rows[0];
    if (
      identity.rows.length !== 1 ||
      row.database !== config.target.database ||
      row.current_role !== config.role ||
      row.session_role !== config.role ||
      row.replication_role !== "origin"
    )
      throw new StagingDatabaseError("identity_mismatch");
    if (!(await stagingParameterPrivilegesSafe(client)))
      throw new StagingDatabaseError("runtime_privilege");
    const privileges = await client.query<{ safe: boolean }>(`
      SELECT NOT (
        NOT r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole
        OR r.rolreplication OR r.rolbypassrls
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member = r.oid)
        OR pg_catalog.has_database_privilege(r.oid, pg_catalog.current_database(), 'CREATE')
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_database d
          WHERE d.datname = pg_catalog.current_database() AND d.datdba = r.oid)
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n
          WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
          AND (n.nspowner = r.oid OR pg_catalog.has_schema_privilege(r.oid, n.oid, 'CREATE')))
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND c.relowner = r.oid)
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p
          JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND p.proowner = r.oid)
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_db_role_setting s
          CROSS JOIN LATERAL pg_catalog.unnest(s.setconfig) setting(value)
          WHERE s.setrole IN (0, r.oid)
          AND s.setdatabase IN (0, (SELECT oid FROM pg_catalog.pg_database
            WHERE datname = pg_catalog.current_database()))
          AND setting.value LIKE 'session_replication_role=%'
          AND setting.value <> 'session_replication_role=origin')
      ) AS safe FROM pg_catalog.pg_roles r WHERE r.rolname = current_user
    `);
    if (privileges.rows.length !== 1 || privileges.rows[0].safe !== true)
      throw new StagingDatabaseError("runtime_privilege");
  } catch (error) {
    if (error instanceof StagingDatabaseError) throw error;
    throw new StagingDatabaseError("connection_failed");
  }
}
