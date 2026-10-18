// Explicit owner-only local preparation. Never imported by application startup.
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { z } from "zod";
import { readPrivateJson } from "./staging-database";
import { assertPrivateDirectory } from "./private-workflow-local";
import { localAdmissionPolicy } from "../src/features/learner-admission/policy";
import { localBookingPolicy } from "../src/features/booking-workflows/policy";
import { localScreeningPolicy } from "../src/features/tutor-screening/policy";
import { runtimeGrantsSql } from "./runtime-grants";

const capabilities = [
  "admission",
  "screening",
  "booking",
  "support",
  "account",
];
const stateSchema = z.object({
  ports: z.object({ database: z.number().int().min(1024).max(65535) }),
  ownerPassword: z.string().min(1),
});

/** Check original policy bytes and current heads; never revive a revoked head. */
export async function prepareLocalPolicies(client: PoolClient) {
  const a = localAdmissionPolicy,
    b = localBookingPolicy,
    s = localScreeningPolicy;
  await client.query(
    `INSERT INTO public.learner_admission_policies(id,source,authority,version,reference,market_code,content_digest,notice_version,guardian_proof_method,independent_eligibility_rule,reviewer_capability_code,revocation_effect)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`,
    [
      a.policyId,
      a.source,
      a.authority,
      a.version,
      a.reference,
      a.marketCode,
      a.contentDigest,
      a.noticeVersion,
      a.guardianProofMethod,
      a.independentEligibilityRule,
      a.reviewerCapabilityCode,
      a.revocationEffect,
    ],
  );
  const admission = await client.query(
    `SELECT 1 FROM public.learner_admission_policies WHERE id=$1 AND source=$2 AND authority=$3 AND version=$4 AND reference=$5 AND market_code=$6 AND content_digest=$7 AND notice_version=$8 AND guardian_proof_method=$9 AND independent_eligibility_rule=$10 AND reviewer_capability_code=$11 AND revocation_effect=$12`,
    [
      a.policyId,
      a.source,
      a.authority,
      a.version,
      a.reference,
      a.marketCode,
      a.contentDigest,
      a.noticeVersion,
      a.guardianProofMethod,
      a.independentEligibilityRule,
      a.reviewerCapabilityCode,
      a.revocationEffect,
    ],
  );
  if (admission.rowCount !== 1)
    throw new Error("Existing local admission policy differs.");
  await client.query(
    `INSERT INTO public.booking_workflow_policies(id,version,reference,content_digest,terms) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING`,
    [b.policyId, b.version, b.reference, b.contentDigest, JSON.stringify(b)],
  );
  const booking = await client.query(
    `SELECT 1 FROM public.booking_workflow_policies WHERE id=$1 AND version=$2 AND reference=$3 AND content_digest=$4 AND terms=$5::jsonb`,
    [b.policyId, b.version, b.reference, b.contentDigest, JSON.stringify(b)],
  );
  if (booking.rowCount !== 1)
    throw new Error("Existing local booking policy differs.");
  await client.query(
    `INSERT INTO public.tutor_screening_policies(provenance,version,reference,authority_reference,required_check_codes,allowed_actions,expiry_rule,valid_from,valid_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NULL) ON CONFLICT DO NOTHING`,
    [
      s.provenance,
      s.version,
      s.reference,
      s.authorityReference,
      s.requiredCheckCodes,
      s.allowedActions,
      s.expiryRule,
      s.validFrom,
    ],
  );
  const screening = await client.query(
    `SELECT 1 FROM public.tutor_screening_policies WHERE provenance=$1 AND version=$2 AND reference=$3 AND authority_reference=$4 AND required_check_codes=$5 AND allowed_actions=$6 AND expiry_rule=$7 AND valid_from=$8::timestamptz AND valid_until IS NULL`,
    [
      s.provenance,
      s.version,
      s.reference,
      s.authorityReference,
      s.requiredCheckCodes,
      s.allowedActions,
      s.expiryRule,
      s.validFrom,
    ],
  );
  if (screening.rowCount !== 1)
    throw new Error("Existing local screening policy differs.");
  await client.query(
    `INSERT INTO public.learner_admission_policy_state(source,market_code,current_policy_id,enabled) VALUES('local_operation','local_operation',$1,true) ON CONFLICT DO NOTHING`,
    [a.policyId],
  );
  await client.query(
    `INSERT INTO public.booking_workflow_policy_head(source,policy_id,enabled) VALUES('local_operation',$1,true) ON CONFLICT DO NOTHING`,
    [b.policyId],
  );
  await client.query(
    `INSERT INTO public.tutor_screening_policy_heads(provenance,version,status) VALUES('local_operation',$1,'enabled') ON CONFLICT DO NOTHING`,
    [s.version],
  );
  const heads = await client.query(
    `SELECT EXISTS(SELECT 1 FROM public.learner_admission_policy_state WHERE source='local_operation' AND market_code='local_operation' AND current_policy_id=$1 AND enabled) AND EXISTS(SELECT 1 FROM public.booking_workflow_policy_head WHERE source='local_operation' AND policy_id=$2 AND enabled) AND EXISTS(SELECT 1 FROM public.tutor_screening_policy_heads WHERE provenance='local_operation' AND version=$3 AND status='enabled') AS valid`,
    [a.policyId, b.policyId, s.version],
  );
  if (heads.rows[0]?.valid !== true)
    throw new Error("Current local policy head is revoked or differs.");
}

/** Owner names an exact already-registered account; no signup can self-grant staff. */
export async function prepareLocalStaff(client: PoolClient, userId: string) {
  if (!userId || userId.length > 128)
    throw new Error("Exact account identity required.");
  const account = await client.query(
    `SELECT u.id FROM public."user" u JOIN public.user_access a ON a.user_id=u.id WHERE u.id=$1 AND u.email_verified AND a.status='active' FOR NO KEY UPDATE OF u,a`,
    [userId],
  );
  if (account.rowCount !== 1)
    throw new Error("Verified active account required.");
  const collision = await client.query(
    `SELECT EXISTS(SELECT 1 FROM public.support_reviewers WHERE user_id=$1 AND (source<>'local_operation' OR status<>'authorized')) OR EXISTS(SELECT 1 FROM public.local_workflow_staff WHERE user_id=$1 AND (status<>'active' OR capabilities<>$2::text[])) OR EXISTS(SELECT 1 FROM public.learner_admission_reviewers WHERE user_id=$1 AND source='local_operation' AND NOT active) OR EXISTS(SELECT 1 FROM public.tutor_screening_staff WHERE user_id=$1 AND provenance='local_operation' AND status<>'authorized') AS blocked`,
    [userId, capabilities],
  );
  if (collision.rows[0]?.blocked)
    throw new Error("Existing incompatible or revoked staff is preserved.");
  const added = await client.query(
    `INSERT INTO public.local_workflow_staff(user_id,capabilities,status) VALUES($1,$2,'active') ON CONFLICT DO NOTHING RETURNING user_id`,
    [userId, capabilities],
  );
  await client.query(
    `INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin') ON CONFLICT DO NOTHING`,
    [userId],
  );
  await client.query(
    `INSERT INTO public.learner_admission_reviewers(user_id,source,capability_code,active) VALUES($1,'local_operation','learner_admission_review',true) ON CONFLICT DO NOTHING`,
    [userId],
  );
  await client.query(
    `INSERT INTO public.tutor_screening_staff(user_id,provenance,status,valid_until) VALUES($1,'local_operation','authorized',NULL) ON CONFLICT DO NOTHING`,
    [userId],
  );
  await client.query(
    `INSERT INTO public.support_reviewers(user_id,source,status) VALUES($1,'local_operation','authorized') ON CONFLICT DO NOTHING`,
    [userId],
  );
  if (added.rowCount)
    await client.query(
      `INSERT INTO public.audit_events(actor_user_id,target_user_id,action) VALUES(NULL,$1,'local_workflow.staff_authorized')`,
      [userId],
    );
}

export async function localWorkflowMain(argv: string[], root = process.cwd()) {
  let pool: Pool | undefined;
  try {
    const { values } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        apply: { type: "boolean" },
        admin: { type: "string" },
        migrate: { type: "boolean" },
      },
    });
    if (!values.apply) throw new Error("Explicit apply required.");
    root = realpathSync(root);
    assertPrivateDirectory(root, path.join(root, ".local/postgres"));
    const marker = path.join(root, ".local/postgres/learli-owned"),
      stat = lstatSync(marker);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.uid !== process.getuid?.() ||
      readFileSync(marker, "utf8") !== "Learli local development cluster\n"
    )
      throw new Error();
    const state = stateSchema.parse(
      readPrivateJson(root, ".local/database.json"),
    );
    pool = new Pool({
      host: "127.0.0.1",
      port: state.ports.database,
      user: "learli_owner",
      password: state.ownerPassword,
      database: "learli_dev",
      max: 1,
      connectionTimeoutMillis: 3000,
      statement_timeout: 10000,
    });
    const client = await pool.connect();
    try {
      const target = await client.query(
        `SELECT current_database()='learli_dev' AND current_user='learli_owner' AND session_user='learli_owner' AND inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=$1 AND current_setting('session_replication_role')='origin' AS valid`,
        [state.ports.database],
      );
      if (target.rows[0]?.valid !== true) throw new Error();
      if (values.migrate) {
        await migrate(drizzle(client), {
          migrationsFolder: path.join(root, "drizzle"),
        });
        await client.query(runtimeGrantsSql);
      }
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('local-operation-prepare',0))",
      );
      await prepareLocalPolicies(client);
      if (values.admin) await prepareLocalStaff(client, values.admin);
      await client.query("COMMIT");
      return {
        status: "applied" as const,
        policies: 3,
        staff: values.admin ? 1 : 0,
      };
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  } catch {
    return {
      status: "refused" as const,
      message:
        "Exact owned local development preparation required; existing records were preserved. Details omitted.",
    };
  } finally {
    await pool?.end().catch(() => undefined);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await localWorkflowMain(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "applied" ? 0 : 1;
}
