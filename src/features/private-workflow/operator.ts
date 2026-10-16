// Trusted operator metadata only. No runtime page, account creation or domain approval.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { syntheticEmail } from "@/lib/local-mode";
import { targetIdInput } from "@/features/account-restrictions/input";
import {
  parsePrivateWorkflow,
  type PrivateWorkflowBinding,
  type PrivateWorkflowPacket,
} from "./config";

export interface PrivateWorkflowOperatorConnection {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}
export class PrivateWorkflowOperatorError extends Error {
  constructor() {
    super("Private workflow operator refused. Details omitted.");
  }
}
const reviewerEmail = z
  .email()
  .max(254)
  .refine((email) => email === email.toLowerCase() && syntheticEmail(email));
const until = z.iso
  .datetime({ offset: true })
  .refine((value) => Number.isFinite(Date.parse(value)));
const common = { apply: z.literal(true), reviewerEmail };
export const privateWorkflowOperatorInput = z.discriminatedUnion("action", [
  z.strictObject({ ...common, action: z.literal("prepare") }),
  z.strictObject({
    ...common,
    action: z.literal("assign-admission"),
    admissionId: z.uuid(),
  }),
  z.strictObject({
    ...common,
    action: z.literal("assign-screening"),
    tutorId: z.uuid(),
    validUntil: until,
  }),
  z.strictObject({
    ...common,
    action: z.literal("grant-account"),
    targetId: targetIdInput,
  }),
  z.strictObject({
    ...common,
    action: z.literal("grant-confirmation"),
    bookingId: z.uuid(),
    validUntil: until,
  }),
]);
export type PrivateWorkflowOperatorCommand = z.infer<
  typeof privateWorkflowOperatorInput
>;
type Connection = PrivateWorkflowOperatorConnection;

function requireResult(value: unknown): asserts value {
  if (!value) throw new PrivateWorkflowOperatorError();
}
async function reviewer(
  connection: Connection,
  email: string,
  packet: PrivateWorkflowPacket,
  lock = false,
) {
  requireResult(packet.accountEmails.includes(email));
  const found = await connection.query(
    `SELECT u.id FROM public."user" u
     JOIN public.user_access a ON a.user_id=u.id AND a.status='active'
     JOIN public.user_roles r ON r.user_id=u.id AND r.role='admin'
     WHERE u.email=$1 AND u.email_verified
     ${lock ? "FOR NO KEY UPDATE OF u FOR SHARE OF a,r" : ""}`,
    [email],
  );
  requireResult(
    found.rows.length === 1 && typeof found.rows[0].id === "string",
  );
  return found.rows[0].id as string;
}
async function requireWindow(
  connection: Connection,
  packet: PrivateWorkflowPacket,
  validUntil = packet.screening.validUntil,
) {
  const result = await connection.query(
    `SELECT $1::timestamptz<=clock_timestamp()
      AND $2::timestamptz>clock_timestamp()
      AND $3::timestamptz>clock_timestamp()
      AND $3::timestamptz<=$2::timestamptz AS valid`,
    [packet.screening.validFrom, packet.screening.validUntil, validUntil],
  );
  requireResult(result.rows[0]?.valid === true);
}
async function requireHeads(
  connection: Connection,
  packet: PrivateWorkflowPacket,
) {
  await connection.query(
    "SELECT source FROM public.learner_admission_policy_state WHERE source='synthetic_readiness' AND market_code='synthetic_test' FOR SHARE",
  );
  await connection.query(
    "SELECT provenance FROM public.tutor_screening_policy_heads WHERE provenance='synthetic_readiness' FOR SHARE",
  );
  await connection.query(
    "SELECT source FROM public.booking_workflow_policy_head WHERE source='synthetic_readiness' FOR SHARE",
  );
  const result = await connection.query(
    `SELECT public.admission_policy_current($1::uuid)
      AND public.booking_workflow_policy_current($2::uuid)
      AND EXISTS(SELECT 1 FROM public.tutor_screening_policy_heads
        WHERE provenance='synthetic_readiness' AND version=$3 AND status='enabled') AS valid`,
    [
      packet.admission.policyId,
      packet.booking.policyId,
      packet.screening.version,
    ],
  );
  requireResult(result.rows[0]?.valid === true);
  await requirePolicies(connection, packet);
}
async function requirePolicies(
  connection: Connection,
  packet: PrivateWorkflowPacket,
) {
  const a = packet.admission,
    s = packet.screening,
    b = packet.booking;
  const admission = await connection.query(
    `SELECT id FROM public.learner_admission_policies
     WHERE id=$1 AND source=$2 AND authority=$3 AND version=$4 AND reference=$5
       AND market_code=$6 AND content_digest=$7 AND notice_version=$8
       AND guardian_proof_method=$9 AND independent_eligibility_rule=$10
       AND reviewer_capability_code=$11 AND revocation_effect=$12`,
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
  requireResult(admission.rows.length === 1);
  const screening = await connection.query(
    `SELECT version FROM public.tutor_screening_policies
     WHERE provenance=$1 AND version=$2 AND reference=$3 AND authority_reference=$4
       AND required_check_codes=$5::text[] AND allowed_actions=$6::text[]
       AND expiry_rule=$7 AND valid_from=$8::timestamptz AND valid_until=$9::timestamptz`,
    [
      s.provenance,
      s.version,
      s.reference,
      s.authorityReference,
      s.requiredCheckCodes,
      s.allowedActions,
      s.expiryRule,
      s.validFrom,
      s.validUntil,
    ],
  );
  requireResult(screening.rows.length === 1);
  const booking = await connection.query(
    "SELECT id FROM public.booking_workflow_policies WHERE id=$1 AND version=$2 AND reference=$3 AND content_digest=$4 AND terms=$5::jsonb",
    [b.policyId, b.version, b.reference, b.contentDigest, JSON.stringify(b)],
  );
  requireResult(booking.rows.length === 1);
}
async function preparePolicies(
  connection: Connection,
  packet: PrivateWorkflowPacket,
) {
  const a = packet.admission,
    s = packet.screening,
    b = packet.booking;
  await connection.query(
    `INSERT INTO public.learner_admission_policies
      (id,source,authority,version,reference,market_code,content_digest,notice_version,guardian_proof_method,independent_eligibility_rule,reviewer_capability_code,revocation_effect)
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
  await connection.query(
    `INSERT INTO public.tutor_screening_policies
      (provenance,version,reference,authority_reference,required_check_codes,allowed_actions,expiry_rule,valid_from,valid_until)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
    [
      s.provenance,
      s.version,
      s.reference,
      s.authorityReference,
      s.requiredCheckCodes,
      s.allowedActions,
      s.expiryRule,
      s.validFrom,
      s.validUntil,
    ],
  );
  await connection.query(
    `INSERT INTO public.booking_workflow_policies(id,version,reference,content_digest,terms)
     VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING`,
    [b.policyId, b.version, b.reference, b.contentDigest, JSON.stringify(b)],
  );
  // ON CONFLICT never replaces a receipt, including a different canonical admission id.
  await requirePolicies(connection, packet);
  await connection.query(
    `INSERT INTO public.learner_admission_policy_state(source,market_code,current_policy_id,enabled)
     VALUES('synthetic_readiness','synthetic_test',$1,true)
     ON CONFLICT(source,market_code) DO UPDATE SET current_policy_id=excluded.current_policy_id,
       enabled=true,revision=learner_admission_policy_state.revision+1,updated_at=clock_timestamp()
     WHERE learner_admission_policy_state.current_policy_id IS DISTINCT FROM excluded.current_policy_id
       OR NOT learner_admission_policy_state.enabled`,
    [a.policyId],
  );
  await connection.query(
    `INSERT INTO public.tutor_screening_policy_heads(provenance,version,status)
     VALUES('synthetic_readiness',$1,'enabled') ON CONFLICT(provenance)
     DO UPDATE SET version=excluded.version,status=excluded.status`,
    [s.version],
  );
  await connection.query(
    `INSERT INTO public.booking_workflow_policy_head(source,policy_id,enabled)
     VALUES('synthetic_readiness',$1,true) ON CONFLICT(source)
     DO UPDATE SET policy_id=excluded.policy_id,enabled=true`,
    [b.policyId],
  );
}
async function registerReviewer(
  connection: Connection,
  id: string,
  packet: PrivateWorkflowPacket,
) {
  await connection.query(
    `INSERT INTO public.learner_admission_reviewers(user_id,source,capability_code,active)
     VALUES($1,'synthetic_readiness','learner_admission_review',true)
     ON CONFLICT(user_id,source,capability_code) DO UPDATE SET active=true,updated_at=clock_timestamp()`,
    [id],
  );
  await screeningStaff(connection, id, packet.screening.validUntil);
}
async function screeningStaff(
  connection: Connection,
  id: string,
  validUntil: string,
) {
  await connection.query(
    `INSERT INTO public.tutor_screening_staff(user_id,provenance,status,valid_until)
     VALUES($1,'synthetic_readiness','authorized',$2::timestamptz)
     ON CONFLICT(user_id,provenance) DO UPDATE
       SET status='authorized',valid_until=excluded.valid_until`,
    [id, validUntil],
  );
}

/** A dedicated connected owner client is required; this function owns its transaction.
 * Hosted CLI/connection admission is intentionally unsupported in this slice. */
export async function runPrivateWorkflowOperation(
  connection: Connection,
  packetInput: unknown,
  expected: PrivateWorkflowBinding,
  input: unknown,
) {
  let transaction = false;
  try {
    const command = privateWorkflowOperatorInput.parse(input);
    const packet = parsePrivateWorkflow(packetInput, expected);
    requireResult(packet.database.mode === "local-test");
    requireResult(packet.accountEmails.includes(command.reviewerEmail));
    await connection.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    transaction = true;
    await connection.query("SET LOCAL lock_timeout='5s'");
    const identity = await connection.query(
      `SELECT current_user AS role,current_database() AS database,
        host(inet_server_addr()) AS host,inet_server_port() AS port`,
    );
    const actual = identity.rows[0];
    requireResult(
      actual?.role === "learli_owner" &&
        actual.database === "learli_test" &&
        actual.port === packet.database.port &&
        (packet.database.host === "localhost"
          ? ["127.0.0.1", "::1"].includes(String(actual.host))
          : actual.host === packet.database.host),
    );
    await requireWindow(
      connection,
      packet,
      "validUntil" in command ? command.validUntil : undefined,
    );
    let id = await reviewer(connection, command.reviewerEmail, packet);
    if (command.action === "prepare") {
      // Admission runtime mutations lock the actor before the policy head too.
      id = await reviewer(connection, command.reviewerEmail, packet, true);
      await preparePolicies(connection, packet);
      await registerReviewer(connection, id, packet);
    } else if (command.action === "grant-account") {
      requireResult(command.targetId !== id);
      await connection.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [`restriction-target:${command.targetId}`],
      );
      // This is explicit owner metadata, never a role or access-status update.
      // Keep the same target lock order as the existing local restriction tools.
      await connection.query(
        "SELECT user_id FROM public.account_restriction_targets WHERE user_id=$1 FOR UPDATE",
        [command.targetId],
      );
      const target = await connection.query(
        `SELECT u.id,u.email FROM public."user" u
         JOIN public.user_access a ON a.user_id=u.id
         WHERE u.id=$1 AND NOT EXISTS(
           SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin'
         ) FOR NO KEY UPDATE OF u FOR SHARE OF a`,
        [command.targetId],
      );
      requireResult(
        target.rows.length === 1 &&
          packet.accountEmails.includes(String(target.rows[0].email)),
      );
      await connection.query(
        "INSERT INTO public.account_restriction_targets(user_id,source) VALUES($1,'local_fixture') ON CONFLICT(user_id) DO NOTHING",
        [command.targetId],
      );
      const source = await connection.query(
        "SELECT source FROM public.account_restriction_targets WHERE user_id=$1 FOR UPDATE",
        [command.targetId],
      );
      requireResult(
        source.rows.length === 1 && source.rows[0].source === "local_fixture",
      );
      const prior = await connection.query(
        "SELECT source,status FROM public.account_restriction_grants WHERE staff_user_id=$1 AND target_user_id=$2 FOR UPDATE",
        [id, command.targetId],
      );
      // An ordinary preparation retry must never revive a revoked grant.
      requireResult(
        !prior.rows.length ||
          (prior.rows[0].source === "local_fixture" &&
            prior.rows[0].status === "authorized"),
      );
      if (!prior.rows.length) {
        await connection.query(
          "INSERT INTO public.account_restriction_grants(staff_user_id,target_user_id,status,source) VALUES($1,$2,'authorized','local_fixture')",
          [id, command.targetId],
        );
        await connection.query(
          "INSERT INTO public.account_restriction_grant_events(staff_user_id,target_user_id,action) VALUES($1,$2,'authorized')",
          [id, command.targetId],
        );
      }
    } else if (command.action === "assign-admission") {
      await connection.query(
        "SELECT public.lock_learner_admission($1,NULL,$2::uuid)",
        [id, command.admissionId],
      );
      await requireHeads(connection, packet);
      id = await reviewer(connection, command.reviewerEmail, packet, true);
      const admission = await connection.query(
        `SELECT a.requester_user_id,u.email FROM public.learner_admissions a
         JOIN public."user" u ON u.id=a.requester_user_id
         JOIN public.user_access ua ON ua.user_id=u.id AND ua.status='active'
         JOIN public.learner_profiles l ON l.id=a.learner_id AND l.source=a.source
         WHERE a.id=$1 AND a.source='synthetic_readiness' AND a.state='pending'
           AND a.policy_id=$2 AND u.email_verified AND a.requester_user_id<>$3`,
        [command.admissionId, packet.admission.policyId, id],
      );
      requireResult(
        admission.rows.length === 1 &&
          packet.accountEmails.includes(String(admission.rows[0].email)),
      );
      const allowed = await connection.query(
        "SELECT user_id FROM public.learner_admission_reviewers WHERE user_id=$1 AND source='synthetic_readiness' AND capability_code='learner_admission_review' AND active FOR SHARE",
        [id],
      );
      requireResult(allowed.rows.length === 1);
      const assigned = await connection.query(
        "SELECT reviewer_user_id FROM public.learner_admission_assignments WHERE admission_id=$1 FOR UPDATE",
        [command.admissionId],
      );
      if (assigned.rows[0]?.reviewer_user_id !== id) {
        // The locked admission serializes assignment writers. Avoid INSERT ...
        // ON CONFLICT here: its BEFORE INSERT audit would run before UPDATE too.
        await connection.query(
          assigned.rows.length
            ? "UPDATE public.learner_admission_assignments SET reviewer_user_id=$2 WHERE admission_id=$1"
            : `INSERT INTO public.learner_admission_assignments(admission_id,reviewer_user_id,source,capability_code)
               VALUES($1,$2,'synthetic_readiness','learner_admission_review')`,
          [command.admissionId, id],
        );
      }
    } else {
      const target = await connection.query(
        command.action === "assign-screening"
          ? "SELECT id,user_id FROM public.tutor_profiles WHERE id=$1 FOR UPDATE"
          : "SELECT t.id,t.user_id FROM public.tutor_profiles t JOIN public.bookings b ON b.tutor_id=t.id WHERE b.id=$1 FOR UPDATE OF t",
        [
          command.action === "assign-screening"
            ? command.tutorId
            : command.bookingId,
        ],
      );
      requireResult(target.rows.length === 1 && target.rows[0].user_id !== id);
      await requireHeads(connection, packet);
      id = await reviewer(connection, command.reviewerEmail, packet, true);
      const tutor = await connection.query(
        `SELECT u.email FROM public."user" u JOIN public.user_access a ON a.user_id=u.id AND a.status='active'
         JOIN public.user_roles r ON r.user_id=u.id AND r.role='tutor'
         WHERE u.id=$1 AND u.email_verified FOR SHARE OF u,a,r`,
        [target.rows[0].user_id],
      );
      requireResult(
        tutor.rows.length === 1 &&
          packet.accountEmails.includes(String(tutor.rows[0].email)),
      );
      await requireWindow(connection, packet, command.validUntil);
      if (command.action === "assign-screening") {
        const current = await connection.query(
          `SELECT c.tutor_id FROM public.tutor_screening_cases c JOIN public.tutor_profiles t ON t.id=c.tutor_id
           WHERE c.tutor_id=$1 AND c.provenance='synthetic_readiness' AND c.policy_version=$2
             AND c.state='pending' AND t.review_status='pending' FOR NO KEY UPDATE OF c`,
          [command.tutorId, packet.screening.version],
        );
        requireResult(current.rows.length === 1);
        const prior = await connection.query(
          "SELECT reviewer_user_id,provenance,status,assignment_revision FROM public.tutor_screening_assignments WHERE tutor_id=$1 FOR UPDATE",
          [command.tutorId],
        );
        requireResult(
          !prior.rows.length ||
            prior.rows[0].provenance === "synthetic_readiness",
        );
        await screeningStaff(connection, id, command.validUntil);
        if (
          prior.rows[0]?.reviewer_user_id !== id ||
          prior.rows[0]?.status !== "authorized"
        ) {
          const revision = prior.rows.length
            ? Number(prior.rows[0].assignment_revision) + 1
            : 0;
          await connection.query(
            `INSERT INTO public.tutor_screening_assignments(tutor_id,reviewer_user_id,provenance,status,assignment_revision)
             VALUES($1,$2,'synthetic_readiness','authorized',$3) ON CONFLICT(tutor_id)
             DO UPDATE SET reviewer_user_id=excluded.reviewer_user_id,status=excluded.status,
               assignment_revision=excluded.assignment_revision,updated_at=clock_timestamp()`,
            [command.tutorId, id, revision],
          );
          await connection.query(
            "INSERT INTO public.tutor_screening_events(tutor_id,kind,actor_user_id,assignment_revision) VALUES($1,'assignment',$2,$3)",
            [command.tutorId, id, revision],
          );
        }
      } else {
        const booking = await connection.query(
          `SELECT b.logical_booking_id,u.email FROM public.bookings b
           JOIN public."user" u ON u.id=b.booked_by_user_id
           JOIN public.user_access a ON a.user_id=u.id AND a.status='active'
           WHERE b.id=$1 AND b.source='synthetic_readiness' AND b.workflow_policy_id=$2
             AND b.admission_policy_id=$3 AND b.state='provisional' AND b.expires_at>clock_timestamp()
             AND b.booked_by_user_id<>$4 AND u.email_verified
             AND NOT EXISTS(SELECT 1 FROM public.bookings newer WHERE newer.logical_booking_id=b.logical_booking_id AND newer.revision>b.revision)
             AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id)
             AND public.has_current_tutor_screening(b.tutor_id,'synthetic_readiness') FOR NO KEY UPDATE OF b`,
          [
            command.bookingId,
            packet.booking.policyId,
            packet.admission.policyId,
            id,
          ],
        );
        requireResult(
          booking.rows.length === 1 &&
            packet.accountEmails.includes(String(booking.rows[0].email)),
        );
        await connection.query(
          `INSERT INTO public.booking_workflow_grants(logical_booking_id,actor_user_id,action,active,valid_until,reference)
           VALUES($1,$2,'confirm',true,$3::timestamptz,$4)
           ON CONFLICT(logical_booking_id,actor_user_id,action) DO UPDATE SET active=true,valid_until=excluded.valid_until`,
          [
            booking.rows[0].logical_booking_id,
            id,
            command.validUntil,
            `synthetic:${randomUUID()}`,
          ],
        );
      }
    }
    await requireWindow(
      connection,
      packet,
      "validUntil" in command ? command.validUntil : undefined,
    );
    await requireHeads(connection, packet);
    await reviewer(connection, command.reviewerEmail, packet, true);
    await connection.query("COMMIT");
    transaction = false;
    return {
      action: command.action,
      status: "applied" as const,
      policies: command.action === "prepare" ? 3 : 0,
      reviewers: command.action === "prepare" ? 1 : 0,
      assignments: command.action.startsWith("assign-") ? 1 : 0,
      confirmationGrants: command.action === "grant-confirmation" ? 1 : 0,
      ...(command.action === "grant-account" ? { accountGrants: 1 } : {}),
    };
  } catch {
    if (transaction) await connection.query("ROLLBACK").catch(() => undefined);
    throw new PrivateWorkflowOperatorError();
  }
}
