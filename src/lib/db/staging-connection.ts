// Node-only explicit operator lifecycle; ordinary application requests stay local.
import { Pool, type ClientBase, type PoolClient } from "pg";
import { stagingParameterPrivilegesSafe } from "./staging-runtime-guard";
import {
  assertStagingTlsEnvironment,
  stagingPoolConfig,
  StagingDatabaseError,
  type StagingDatabaseConfig,
} from "./staging-config";

export interface StagingConnection {
  /** Construct Drizzle on this exact client inside the callback when needed. */
  withClient<T>(operation: (client: PoolClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

type IdentityRow = {
  database: string;
  current_role: string;
  session_role: string;
  ssl: boolean;
  replication_role: string;
};
import {
  verifiedPoolConfig,
  type VerifiedDatabaseConfig,
} from "./verified-config";
import { verifyNativeTls } from "./native-tls";

type PrivilegeRow = { unsafe: boolean };
async function verifyClient(
  client: ClientBase,
  config: VerifiedDatabaseConfig,
) {
  try {
    verifyNativeTls(client, verifiedPoolConfig(config));
    const result = await client.query<IdentityRow>(`
      SELECT current_database() AS database, current_user AS current_role,
        session_user AS session_role,
        COALESCE((SELECT ssl FROM pg_catalog.pg_stat_ssl WHERE pid = pg_backend_pid()), false) AS ssl,
        current_setting('session_replication_role') AS replication_role
    `);
    const identity = result.rows[0];
    if (
      result.rows.length !== 1 ||
      identity.database !== config.target.database ||
      identity.current_role !== config.role ||
      identity.session_role !== config.role ||
      identity.replication_role !== "origin"
    )
      throw new StagingDatabaseError("identity_mismatch");
    if (config.purpose !== "runtime" && config.purpose !== "inspect-runtime")
      return;
    if (!(await stagingParameterPrivilegesSafe(client)))
      throw new StagingDatabaseError("runtime_privilege");
    // Reject every membership (including SET ROLE-only) rather than naming a
    // provider's current admin role. B verifies exact table/function grants.
    const privileges = await client.query<PrivilegeRow>(`
      SELECT (
        r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles other
          WHERE other.oid <> r.oid AND pg_catalog.pg_has_role(r.oid, other.oid, 'MEMBER'))
        OR pg_catalog.has_database_privilege(current_user, current_database(), 'CREATE')
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_database d WHERE d.datname = current_database() AND d.datdba = r.oid)
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n
          WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
          AND (n.nspowner = r.oid OR pg_catalog.has_schema_privilege(current_user, n.oid, 'CREATE')))
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND c.relowner = r.oid)
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND p.proowner = r.oid)
      ) AS unsafe FROM pg_catalog.pg_roles r WHERE r.rolname = current_user
    `);
    if (privileges.rows.length !== 1 || privileges.rows[0].unsafe !== false)
      throw new StagingDatabaseError("runtime_privilege");
  } catch (error) {
    if (error instanceof StagingDatabaseError) throw error;
    throw new StagingDatabaseError("connection_failed");
  }
}

export async function openVerifiedOperationConnection(
  config: VerifiedDatabaseConfig,
): Promise<StagingConnection> {
  // Resolve the opaque settings and TLS process guards BEFORE allocating a pool.
  const options = verifiedPoolConfig(config);
  let pool: Pool;
  try {
    pool = new Pool({
      ...options,
      onConnect: async (client) => verifyClient(client, config),
    });
  } catch {
    throw new StagingDatabaseError("connection_failed");
  }
  let poolFailed = false;
  pool.on("error", () => {
    poolFailed = true;
  }); // Never log raw driver errors.
  let closing: Promise<void> | undefined;
  const close = () => {
    closing ??= pool.end().catch(() => {
      throw new StagingDatabaseError("cleanup_failed");
    });
    return closing;
  };
  const withClient = async <T>(
    operation: (client: PoolClient) => Promise<T>,
  ) => {
    assertStagingTlsEnvironment();
    if (closing || poolFailed)
      throw new StagingDatabaseError("connection_failed");
    let client: PoolClient;
    try {
      client = await pool.connect();
    } catch (error) {
      if (error instanceof StagingDatabaseError) throw error;
      throw new StagingDatabaseError("connection_failed");
    }
    try {
      await verifyClient(client, config);
      // Callback errors belong to the caller's safe domain/CLI error boundary.
      return await operation(client);
    } finally {
      // End this session, including failed transactions/locks/SET-role state.
      client.release(true);
    }
  };
  try {
    await withClient(async () => undefined);
    return Object.freeze({ withClient, close });
  } catch (error) {
    await close();
    throw error;
  }
}

/** Original staging entry cannot admit a development/production packet. */
export async function openStagingConnection(config: StagingDatabaseConfig) {
  stagingPoolConfig(config);
  if (config.target.environment !== "staging")
    throw new StagingDatabaseError("config_invalid");
  return openVerifiedOperationConnection(config);
}
