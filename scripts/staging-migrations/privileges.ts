import type { PoolClient } from "pg";
import { runtimeGrantsSql } from "../runtime-grants";
import { MigrationFault } from "./journal";
import { stagingParameterPrivilegesSafe } from "../../src/lib/db/staging-runtime-guard";

/** No role/extension creation or privilege escalation occurs in preflight. */
export async function migrationPrerequisites(client: PoolClient) {
  const role = await client.query<{ safe: boolean }>(`
    SELECT NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
      AND rolcanlogin AND NOT EXISTS
        (SELECT 1 FROM pg_auth_members WHERE member=pg_roles.oid) AS safe
    FROM pg_roles WHERE rolname='learli_app'`);
  if (role.rows.length !== 1 || !role.rows[0].safe)
    throw new MigrationFault("runtime_role_invalid");
  if (!(await stagingParameterPrivilegesSafe(client)))
    throw new MigrationFault("runtime_role_invalid");
  const rights = await client.query<{ ready: boolean }>(`
    SELECT current_user <> 'learli_app'
      AND current_setting('session_replication_role') = 'origin'
      AND has_schema_privilege(current_user,'public','CREATE')
      AND has_database_privilege(current_user,current_database(),'CREATE')
      AND has_language_privilege(current_user,'plpgsql','USAGE')
      AND has_language_privilege(current_user,'sql','USAGE')
      AND to_regprocedure('pg_catalog.gen_random_uuid()') IS NOT NULL
      AND to_regprocedure('pg_catalog.pg_current_xact_id()') IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_available_extension_versions
        WHERE name='btree_gist' AND (trusted OR NOT superuser
          OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)))
      AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('public','drizzle') AND c.relkind IN ('r','p','S','v','m')
          AND c.relowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass
            AND d.objid=c.oid AND d.deptype='e'))
      AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass
            AND d.objid=p.oid AND d.deptype='e')) AS ready`);
  if (!rights.rows[0]?.ready)
    throw new MigrationFault("migration_prerequisite");
}

type Column = {
  table: string;
  column: string;
  privilege: string;
  allowed: boolean;
  grantable: boolean;
};
const unquote = (name: string) => name.trim().replace(/^"|"$/g, "");
/** Derive expected effective rights from the unchanged grant policy, not an
 * independently maintained broader staging policy. */
export function expectedGrant(
  table: string,
  column: string,
  privilege: string,
) {
  for (const statement of runtimeGrantsSql.split(";")) {
    const match = statement.trim().match(/^GRANT (.+) ON (.+) TO learli_app$/);
    if (
      !match ||
      match[2].startsWith("SCHEMA ") ||
      match[2].startsWith("FUNCTION ")
    )
      continue;
    if (!match[2].split(",").map(unquote).includes(table)) continue;
    const columnGrant = match[1].match(
      /^(SELECT|INSERT|UPDATE|REFERENCES) \((.+)\)$/,
    );
    if (
      columnGrant &&
      columnGrant[1] === privilege &&
      columnGrant[2].split(",").map(unquote).includes(column)
    )
      return true;
    if (
      !columnGrant &&
      match[1]
        .split(",")
        .map((p) => p.trim())
        .includes(privilege)
    )
      return true;
  }
  return false;
}
export async function verifyRuntimeGrants(client: PoolClient) {
  if (!(await stagingParameterPrivilegesSafe(client)))
    throw new MigrationFault("grant_mismatch");
  const columns = await client.query<Column>(`
    SELECT c.relname AS "table", a.attname AS "column", p.privilege,
      has_column_privilege('learli_app',c.oid,a.attnum,p.privilege) AS allowed,
      has_column_privilege('learli_app',c.oid,a.attnum,p.privilege || ' WITH GRANT OPTION') AS grantable
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(privilege)
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
    ORDER BY c.relname,a.attnum,p.privilege`);
  if (
    !columns.rows.length ||
    columns.rows.some(
      (row) =>
        row.grantable ||
        row.allowed !== expectedGrant(row.table, row.column, row.privilege),
    )
  )
    throw new MigrationFault("grant_mismatch");
  const tables = await client.query<{
    table: string;
    privilege: string;
    allowed: boolean;
    grantable: boolean;
  }>(`
    SELECT c.relname AS "table", p.privilege,
      has_table_privilege('learli_app',c.oid,p.privilege) AS allowed,
      has_table_privilege('learli_app',c.oid,p.privilege || ' WITH GRANT OPTION') AS grantable
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN (VALUES ('DELETE'),('TRUNCATE'),('TRIGGER'),('MAINTAIN')) p(privilege)
    WHERE n.nspname='public' AND c.relkind IN ('r','p')`);
  if (
    tables.rows.some(
      (row) =>
        row.grantable ||
        row.allowed !== expectedGrant(row.table, "", row.privilege),
    )
  )
    throw new MigrationFault("grant_mismatch");
  const functions = await client.query<{
    signature: string;
    allowed: boolean;
    safe: boolean;
    grantable: boolean;
  }>(`
    SELECT p.oid::regprocedure::text AS signature,
      has_function_privilege('learli_app',p.oid,'EXECUTE') AS allowed,
      has_function_privilege('learli_app',p.oid,'EXECUTE WITH GRANT OPTION') AS grantable,
      p.proowner <> (SELECT oid FROM pg_roles WHERE rolname='learli_app') AS safe
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_depend d
      WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')`);
  const permitted = new Set([
    "google_meet_metadata(text,text)",
    "google_meet_begin(text,text,text,text,text,text,text,boolean)",
    "google_meet_consume(text,text,text,text,text)",
    "google_meet_complete(text,text,text,text,text,text,text[],text)",
    "google_meet_disconnect(text,text)",
    "google_meet_job_status(text,text,uuid,text)",
    "create_parent_child(text,text,uuid,uuid,text,text,text,integer,text,text,boolean,boolean)",
    "claim_guardian_admission_exception(text,text,uuid,uuid,uuid)",
    "create_independent_learner(text,text,uuid,uuid,text,text,text,text,boolean)",
    "workflow_identity(text,text,text)",
    "has_local_workflow_staff(text,text,text)",
    "claim_local_workflow_task(text,text,text,text,uuid)",
    "local_workflow_claim_current(text,text,text,text)",
    "admission_reviewer_allowed(text,text,uuid)",
    "admission_policy_current(uuid)",
    "publication_policy_current(uuid)",
    "publication_completion_current(text,uuid,uuid,integer)",
    "publication_author_allowed(text,text,uuid,uuid,integer,uuid)",
    "publication_moderator_allowed(text,text,uuid,uuid)",
    "submit_publication_review(text,text,uuid,uuid,integer,uuid,uuid,integer,text)",
    "decide_publication_review(text,text,uuid,uuid,integer,uuid,text,boolean)",
    "assert_booking_workflow_receipt(text,text,uuid,uuid,text,uuid,boolean,text,timestamp with time zone,timestamp with time zone,timestamp with time zone)",
    "booking_workflow_policy_current(uuid)",
    "expire_policy_bookings(uuid)",
    "has_current_booking_beneficiary(text,uuid,uuid)",
    "has_booking_workflow_task(text,text,uuid,text)",
    "create_policy_booking(text,text,uuid,uuid,uuid,uuid,uuid,timestamp with time zone,timestamp with time zone,text,text)",
    "change_policy_booking(text,text,uuid,uuid,uuid,integer,text,text,timestamp with time zone,timestamp with time zone,text,text)",
    "booking_workflow_participant(text,text,uuid)",
    "create_booking_workflow_dispute(text,text,uuid,uuid,text,text,text,text)",
    "has_current_tutor_screening(uuid,text)",
    "has_tutor_screening_authority(text,text,uuid,text)",
    "request_tutor_screening(text,text,uuid,uuid,text)",
    "record_tutor_screening_check(text,text,uuid,integer,uuid,text,text,text,timestamp with time zone,timestamp with time zone)",
    "decide_tutor_screening(text,text,uuid,integer,uuid,text)",
    "review_local_tutor_application(text,text,uuid,text)",
    "resubmit_tutor_application(text,text,uuid)",
    "has_current_support_policy(text)",
    "has_safeguarding_case_authority(text,text,uuid,text)",
    "create_safeguarding_case(text,text,uuid,text,text,text,text)",
    "change_safeguarding_response(text,text,uuid,integer,uuid,text,text)",
    "change_safeguarding_access(text,text,text,integer,text,text,uuid)",

    "create_local_learner_with_grade(text,text,uuid,text,text,text,text,integer)",
    "create_learner_admission_with_grade(text,text,uuid,uuid,text,text,text,text,text,integer)",
    "update_admitted_learner_with_grade(text,text,uuid,uuid,text,text,integer)",
    "create_learner_admission(text,text,uuid,uuid,text,text,text,text,text)",
    "record_learner_admission_evidence(text,text,uuid,integer,uuid,text,text)",
    "decide_learner_admission(text,text,uuid,integer,uuid,text)",
    "revoke_learner_admission_evidence(text,text,uuid,integer,uuid,uuid)",
    "update_admitted_learner(text,text,uuid,uuid,text,text)",
    "has_current_learner_authority(text,text,uuid,uuid)",
    "grant_tutor_role(text)",
    "enroll_parent_workspace(text,text)",
    "submit_private_review(text,text,uuid,integer,uuid,integer,text)",
    "moderate_private_review(text,text,uuid,integer,uuid,text)",
    "has_admin_assurance(text,text,integer)",
    "change_local_account_access(text,text,text,integer,text,text,uuid)",
    "create_local_learner(text,text,uuid,text,text,text,text)",
    "change_local_support_assignment(text,text,uuid,integer,text,text,uuid)",
  ]);
  if (
    functions.rows.length !== 116 ||
    functions.rows.some(
      (row) =>
        !row.safe ||
        row.grantable ||
        row.allowed !== permitted.has(row.signature.replace(/^public\./, "")),
    )
  )
    throw new MigrationFault("grant_mismatch");
  const structural = await client.query<{ safe: boolean }>(`
    SELECT has_schema_privilege('learli_app','public','USAGE')
      AND current_setting('session_replication_role') = 'origin'
      AND NOT has_schema_privilege('learli_app','public','USAGE WITH GRANT OPTION')
      AND NOT has_database_privilege('learli_app',current_database(),'CONNECT WITH GRANT OPTION')
      AND NOT has_database_privilege('learli_app',current_database(),'TEMPORARY WITH GRANT OPTION')
      AND NOT has_schema_privilege('learli_app','public','CREATE')
      AND NOT has_schema_privilege('learli_app','drizzle','USAGE')
      AND NOT has_database_privilege('learli_app',current_database(),'CREATE')
      AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('public','drizzle') AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname='learli_app'))
      AND NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('public','drizzle')
        AND nspowner=(SELECT oid FROM pg_roles WHERE rolname='learli_app'))
      AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bookings_tutor_no_overlap'
        AND contype='x' AND convalidated)
      AND EXISTS (SELECT 1 FROM pg_extension WHERE extname='btree_gist') AS safe`);
  if (!structural.rows[0]?.safe) throw new MigrationFault("grant_mismatch");
  return {
    columnChecks: columns.rows.length,
    tableChecks: tables.rows.length,
    functionChecks: functions.rows.length,
  };
}

/** Actual restricted credential; every mutation rolls back, including allowed
 * no-op updates. Errors are reduced to codes, never forwarded or logged. */
export async function probeRuntime(client: PoolClient) {
  const identity = await client.query<{ safe: boolean }>(
    "SELECT current_user='learli_app' AND session_user='learli_app' AND current_setting('session_replication_role')='origin' AS safe",
  );
  if (!identity.rows[0]?.safe) throw new MigrationFault("runtime_probe_failed");
  if (!(await stagingParameterPrivilegesSafe(client)))
    throw new MigrationFault("runtime_probe_failed");
  await client.query("BEGIN");
  try {
    await client.query("SELECT id FROM public.subjects LIMIT 0");
    await client.query(
      "UPDATE public.subjects SET is_active=is_active WHERE false",
    );
    for (const query of [
      "CREATE TABLE public.learli_staging_probe(id integer)",
      "GRANT learli_app TO learli_app",
      "UPDATE public.user_roles SET role=role WHERE false",
      "UPDATE public.bookings SET request_fingerprint=request_fingerprint WHERE false",
      "DELETE FROM public.booking_events WHERE false",
      "UPDATE public.account_restriction_events SET reason=reason WHERE false",
    ]) {
      await client.query("SAVEPOINT permission_probe");
      let code: string | undefined;
      try {
        await client.query(query);
      } catch (error) {
        code =
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : undefined;
      }
      await client.query("ROLLBACK TO SAVEPOINT permission_probe");
      if (code !== "42501") throw new MigrationFault("runtime_probe_failed");
    }
    for (const [source, state, ends] of [
      [
        "invalid_probe_source",
        "demo_reserved",
        "now()+interval '1 day 1 hour'",
      ],
      [
        "local_simulation",
        "invalid_probe_state",
        "now()+interval '1 day 1 hour'",
      ],
      ["local_simulation", "demo_reserved", "now()"],
    ]) {
      await client.query("SAVEPOINT integrity_probe");
      let code: string | undefined;
      try {
        // Deliberately invalid synthetic insert: CHECK runs before nonexistent
        // FK references. No application fixture or actual record is needed.
        await client.query(
          `INSERT INTO public.bookings(source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,expires_at)
          VALUES($1,gen_random_uuid(),gen_random_uuid(),'synthetic-staging-probe',gen_random_uuid(),now()+interval '1 day',${ends},'UTC',gen_random_uuid(),repeat('a',64),$2,now()+interval '1 minute')`,
          [source, state],
        );
      } catch (error) {
        code =
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : undefined;
      }
      await client.query("ROLLBACK TO SAVEPOINT integrity_probe");
      if (code !== "23514") throw new MigrationFault("runtime_probe_failed");
    }
    return { denials: 6, integrityChecks: 3, rollbackOnly: true };
  } finally {
    await client.query("ROLLBACK");
  }
}

/** Production acceptance inspects only; negative write probes belong to dev. */
export async function probeRuntimeReadOnly(client: PoolClient) {
  await client.query("BEGIN READ ONLY");
  try {
    const result = await client.query<{ safe: boolean }>(
      "SELECT current_user='learli_app' AND session_user='learli_app' AND current_setting('session_replication_role')='origin' AND current_setting('transaction_read_only')='on' AS safe",
    );
    if (
      result.rows.length !== 1 ||
      result.rows[0].safe !== true ||
      !(await stagingParameterPrivilegesSafe(client))
    )
      throw new MigrationFault("runtime_probe_failed");
    await client.query("SELECT id FROM public.subjects LIMIT 0");
    return { readOnly: true };
  } finally {
    await client.query("ROLLBACK");
  }
}
