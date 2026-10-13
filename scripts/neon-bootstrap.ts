// Deliberate operations only. No application import, env loading or role reset.
import { randomBytes } from "node:crypto";
import {
  constants,
  closeSync,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  openSync,
  readFileSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { readPrivateJson } from "./staging-database";
import type { NeonOperationConfig } from "../src/lib/db/neon-operation-config";
import {
  neonOperationConfig,
  neonOperationPoolConfig,
} from "../src/lib/db/neon-operation-config";
import { openVerifiedOperationConnection } from "../src/lib/db/staging-connection";
import { MigrationFault } from "./staging-migrations/journal";

export interface NeonRoleCredentials {
  runtimeUrl: string;
  migrationUrl: string;
}
/** The operation caller must retain generated credentials privately BEFORE
 * committing. An uncertain result never permits a role reset or blind retry. */
export async function bootstrapNeonRoles(
  config: NeonOperationConfig,
  retainCredentials: (value: NeonRoleCredentials) => Promise<void>,
) {
  neonOperationPoolConfig(config);
  if (config.purpose !== "bootstrap" || config.role !== "neondb_owner")
    throw new MigrationFault("config_invalid");
  const connection = await openVerifiedOperationConnection(config);
  let committed = false;
  try {
    return await connection.withClient(async (client) => {
      await client.query("BEGIN");
      try {
        // This namespace is separate from the migration runner's lock.
        const lock = await client.query<{ locked: boolean }>(
          "SELECT pg_catalog.pg_try_advisory_xact_lock(1835344,805) AS locked",
        );
        if (lock.rows[0]?.locked !== true)
          throw new MigrationFault("runner_busy");
        const initial = await client.query<{ safe: boolean }>(`
          SELECT current_user='neondb_owner' AND session_user=current_user
            AND current_setting('session_replication_role')='origin'
            AND EXISTS (SELECT 1 FROM pg_catalog.pg_database WHERE datname=current_database() AND datdba=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user))
            AND EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='public' AND pg_catalog.pg_get_userbyid(nspowner) IN ('pg_database_owner','neondb_owner'))
            AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('learli_app','learli_migrator'))
            AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname NOT LIKE 'pg_%')
            AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S'))
            AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'))
            AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e') AS safe
        `);
        if (initial.rows[0]?.safe !== true)
          throw new MigrationFault("schema_unrecognized");
        // Refuse statement/parameter tracing before generating or binding secrets.
        // Error statements are permitted: SQL below contains no password value,
        // binds cannot be error-logged and inner utility errors are scrubbed.
        const logging = await client.query<{ safe: boolean }>(`
          SELECT current_setting('log_statement')='none'
            AND current_setting('log_min_duration_statement')='-1'
            AND current_setting('log_min_duration_sample')='-1'
            AND current_setting('log_transaction_sample_rate')::numeric=0
            AND current_setting('log_parameter_max_length_on_error')='0'
            AND current_setting('debug_print_parse')='off'
            AND current_setting('debug_print_rewritten')='off'
            AND current_setting('debug_print_plan')='off'
            AND coalesce(current_setting('pg_stat_statements.track',true),'top') IN ('none','top')
            AND coalesce(current_setting('pgaudit.log',true),'none') IN ('','none')
            AND coalesce(current_setting('auto_explain.log_min_duration',true),'-1')='-1'
            AS safe
        `);
        if (logging.rows[0]?.safe !== true)
          throw new MigrationFault("migration_prerequisite");
        const runtimePassword = randomBytes(32).toString("hex"),
          migrationPassword = randomBytes(32).toString("hex");
        const url = (role: string, password: string) => {
          const value = new URL(
            `postgresql://${role}@${config.target.hostname}/${config.target.database}`,
          );
          value.password = password;
          value.search = "sslmode=verify-full&channel_binding=require";
          return value.toString();
        };
        await retainCredentials({
          runtimeUrl: url("learli_app", runtimePassword),
          migrationUrl: url("learli_migrator", migrationPassword),
        });
        // Bind secrets separately, with no statement/error parameter logging.
        // The DO text has no password; catch/re-raise discards inner utility SQL
        // and context if CREATE ROLE is refused, so server error logs stay safe.
        for (const [role, password] of [
          ["learli_app", runtimePassword],
          ["learli_migrator", migrationPassword],
        ] as const) {
          await client.query(
            "SELECT pg_catalog.set_config('learli.bootstrap_password',$1,true)",
            [password],
          );
          await client.query(`DO $learli_private$ BEGIN
            BEGIN
              EXECUTE pg_catalog.format('CREATE ROLE ${role} LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT',
                pg_catalog.current_setting('learli.bootstrap_password'));
            EXCEPTION WHEN query_canceled OR assert_failure OR OTHERS THEN
              RAISE EXCEPTION 'Private role bootstrap refused';
            END;
          END $learli_private$`);
          await client.query(
            "SELECT pg_catalog.set_config('learli.bootstrap_password','',true)",
          );
        }
        const database = `"${config.target.database}"`; // parser permits only SQL-safe names.
        await client.query(
          `GRANT CONNECT, CREATE ON DATABASE ${database} TO learli_migrator`,
        );
        // CREATEROLE grants creator ADMIN but not necessarily SET permission.
        // Temporarily allow only the operator to SET the new restricted owner;
        // neither new role becomes a member of the operator or provider roles.
        const operatorMembership = await client.query<{
          grantor: string;
          admin_option: boolean;
          inherit_option: boolean;
          set_option: boolean;
        }>(`
          SELECT pg_catalog.pg_get_userbyid(m.grantor) AS grantor,m.admin_option,m.inherit_option,m.set_option
          FROM pg_catalog.pg_auth_members m
          JOIN pg_catalog.pg_roles r ON r.oid=m.roleid
          JOIN pg_catalog.pg_roles u ON u.oid=m.member
          WHERE r.rolname='learli_migrator' AND u.rolname='neondb_owner'
        `);
        if (
          operatorMembership.rows.length !== 1 ||
          operatorMembership.rows[0].admin_option !== true
        )
          throw new MigrationFault("runtime_role_invalid");
        const prior = operatorMembership.rows[0];
        await client.query(
          "GRANT learli_migrator TO neondb_owner WITH SET TRUE GRANTED BY neondb_owner",
        );
        // Database ownership stays with the existing operator; only the initially
        // empty public schema becomes migration-owned for exact ACL enforcement.
        await client.query("ALTER SCHEMA public OWNER TO learli_migrator");
        await client.query("SET ROLE learli_migrator");
        await client.query(
          "REVOKE ALL ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO learli_app",
        );
        await client.query("RESET ROLE");
        if (prior.grantor === "neondb_owner") {
          await client.query(
            `GRANT learli_migrator TO neondb_owner WITH SET ${prior.set_option ? "TRUE" : "FALSE"} GRANTED BY neondb_owner`,
          );
        } else {
          // PG16+ tracks separate grants by grantor. Remove our temporary grant,
          // preserving the creator's bootstrap-superuser ADMIN-only grant.
          await client.query(
            "REVOKE learli_migrator FROM neondb_owner GRANTED BY neondb_owner",
          );
        }
        const restored = await client.query<{ safe: boolean }>(
          `
          SELECT pg_catalog.pg_get_userbyid(m.grantor)=$1 AND m.admin_option=$2 AND m.inherit_option=$3 AND m.set_option=$4 AS safe
          FROM pg_catalog.pg_auth_members m
          JOIN pg_catalog.pg_roles r ON r.oid=m.roleid
          JOIN pg_catalog.pg_roles u ON u.oid=m.member
          WHERE r.rolname='learli_migrator' AND u.rolname='neondb_owner'
        `,
          [
            prior.grantor,
            prior.admin_option,
            prior.inherit_option,
            prior.set_option,
          ],
        );
        if (restored.rows.length !== 1 || restored.rows[0].safe !== true)
          throw new MigrationFault("runtime_role_invalid");
        await client.query(
          `GRANT CONNECT ON DATABASE ${database} TO learli_app`,
        );
        const roles = await client.query<{ safe: boolean }>(`
          SELECT count(*)=2 AND bool_and(rolcanlogin AND NOT rolinherit AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
            AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid)) AS safe
          FROM pg_catalog.pg_roles r WHERE rolname IN ('learli_app','learli_migrator')
        `);
        const rights = await client.query<{ safe: boolean }>(`
          SELECT pg_catalog.pg_get_userbyid(nspowner)='learli_migrator'
            AND pg_catalog.has_schema_privilege('learli_app','public','USAGE')
            AND NOT pg_catalog.has_schema_privilege('learli_app','public','CREATE')
            AND NOT pg_catalog.has_database_privilege('learli_app',current_database(),'CREATE')
            AND pg_catalog.has_database_privilege('learli_migrator',current_database(),'CREATE') AS safe
          FROM pg_catalog.pg_namespace WHERE nspname='public'
        `);
        if (roles.rows[0]?.safe !== true || rights.rows[0]?.safe !== true)
          throw new MigrationFault("runtime_role_invalid");
        // If COMMIT itself is uncertain, retain both credentials and evidence.
        committed = true;
        await client.query("COMMIT");
        return {
          version: 1,
          status: "PASS",
          roles: 2,
          schemaOwner: "learli_migrator",
          databaseOwner: "preserved",
          memberships: "new-roles-none",
          operatorSetPermission: "restored",
          committed: true,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        if (committed) throw new MigrationFault("apply_failed");
        throw error instanceof MigrationFault
          ? error
          : new MigrationFault("apply_failed");
      }
    });
  } finally {
    await connection.close();
  }
}

// An explicit private-file CLI only; no startup provisioning or dotenv loading.
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let result: { status: string; [key: string]: unknown };
  let credentialFd: number | undefined;
  try {
    const args = process.argv.slice(2),
      flags = new Map<string, string>();
    if (args.length !== 6) throw new MigrationFault("arguments_invalid");
    for (let i = 0; i < args.length; i += 2) {
      if (
        !["--config", "--target", "--credentials-out"].includes(args[i]) ||
        flags.has(args[i])
      )
        throw new MigrationFault("arguments_invalid");
      flags.set(args[i], args[i + 1]);
    }
    const root = process.cwd(),
      raw = z
        .strictObject({
          APP_ENV: z.enum(["production", "development"]),
          NEON_BOOTSTRAP_URL: z.string().min(1),
        })
        .parse(readPrivateJson(root, flags.get("--config")!));
    // The caller creates a0600 empty credential file first. Validate its full
    // private ancestry using the existing reader, then never overwrite a retry.
    const credentialPath = flags.get("--credentials-out")!;
    const marker = z
      .strictObject({ version: z.literal(1), status: z.literal("reserved") })
      .parse(readPrivateJson(root, credentialPath));
    if (!marker) throw new MigrationFault("private_file_invalid");
    credentialFd = openSync(
      path.resolve(root, credentialPath),
      constants.O_RDWR | constants.O_NOFOLLOW,
    );
    const stat = fstatSync(credentialFd);
    if (
      !stat.isFile() ||
      stat.uid !== process.getuid?.() ||
      stat.mode & 0o077 ||
      stat.size > 256
    )
      throw new MigrationFault("private_file_invalid");
    z.strictObject({
      version: z.literal(1),
      status: z.literal("reserved"),
    }).parse(JSON.parse(readFileSync(credentialFd, "utf8")));
    const config = neonOperationConfig({
      appEnv: raw.APP_ENV,
      url: raw.NEON_BOOTSTRAP_URL,
      target: readPrivateJson(root, flags.get("--target")!),
      purpose: "bootstrap",
    });
    result = await bootstrapNeonRoles(config, async (credentials) => {
      const payload = Buffer.from(
        `${JSON.stringify({ version: 1, status: "credentials-retained", ...credentials })}\n`,
      );
      for (let offset = 0; offset < payload.length;) {
        offset += writeSync(
          credentialFd!,
          payload,
          offset,
          payload.length - offset,
          offset,
        );
      }
      ftruncateSync(credentialFd!, payload.length);
      fsyncSync(credentialFd!);
    });
  } catch (error) {
    result = {
      version: 1,
      status: "FAIL",
      category:
        error instanceof MigrationFault ? error.category : "operation_failed",
    };
  } finally {
    if (credentialFd !== undefined) closeSync(credentialFd);
  }
  console.log(JSON.stringify(result));
  process.exitCode = result.status === "PASS" ? 0 : 1;
}
