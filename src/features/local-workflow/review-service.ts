import { sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { AccessError } from "@/lib/permissions/access";
import { requireAdminAssurance } from "@/features/admin-security/assurance";
import { RuleError } from "@/lib/rule-error";
import { getLocalWorkflow } from "./runtime";
import { localReviewClaimInput, localReviewKinds } from "./review-input";

const queuedReview = z.object({
  kind: z.enum(localReviewKinds),
  targetId: z.uuid(),
  submittedAt: z.coerce.date(),
});

/** Unassigned metadata only; private profiles/records still need an exact claim. */
export async function listLocalReviews(runtime: AuthRuntime, headers: Headers) {
  if (!getLocalWorkflow(runtime)) throw new AccessError(404);
  const actor = await requireAdminAssurance(runtime, headers);
  const result = await runtime.db.execute<{
    allowed: boolean;
    accountAllowed: boolean;
    items: unknown;
  }>(sql`
    WITH capabilities AS (
      SELECT public.has_local_workflow_staff(${actor.userId},${actor.sessionId},'admission') AS admission,
        public.has_local_workflow_staff(${actor.userId},${actor.sessionId},'screening') AS screening,
        public.has_local_workflow_staff(${actor.userId},${actor.sessionId},'booking') AS booking,
        public.has_local_workflow_staff(${actor.userId},${actor.sessionId},'support') AS support,
        public.has_local_workflow_staff(${actor.userId},${actor.sessionId},'account') AS account
    ), requests AS (
      SELECT 'admission'::text AS kind,a.id::text AS "targetId",a.created_at AS "submittedAt"
      FROM public.learner_admissions a,capabilities c
      WHERE c.admission AND a.source='local_operation' AND a.state='pending'
        AND a.requester_user_id<>${actor.userId}
        AND NOT EXISTS(SELECT 1 FROM public.learner_admission_assignments x WHERE x.admission_id=a.id)
      UNION ALL
      SELECT 'screening',s.tutor_id::text,s.created_at
      FROM public.tutor_screening_cases s JOIN public.tutor_profiles t ON t.id=s.tutor_id,capabilities c
      WHERE c.screening AND s.provenance='local_operation' AND s.state='pending' AND t.user_id<>${actor.userId}
        AND NOT EXISTS(SELECT 1 FROM public.tutor_screening_assignments x WHERE x.tutor_id=s.tutor_id)
      UNION ALL
      SELECT 'booking',b.id::text,b.created_at
      FROM public.bookings b JOIN public.tutor_profiles t ON t.id=b.tutor_id
        JOIN public.learner_profiles l ON l.id=b.learner_id,capabilities c
      WHERE c.booking AND b.source='local_operation' AND b.state='provisional'
        AND b.expires_at>statement_timestamp() AND b.booked_by_user_id<>${actor.userId}
        AND t.user_id<>${actor.userId} AND l.user_id IS DISTINCT FROM ${actor.userId}
        AND NOT EXISTS(SELECT 1 FROM public.booking_workflow_grants x WHERE x.logical_booking_id=b.logical_booking_id AND x.action='confirm')
      UNION ALL
      SELECT 'support',s.id::text,s.created_at
      FROM public.support_cases s,capabilities c
      WHERE c.support AND s.source='local_operation' AND s.status='open' AND s.requester_user_id<>${actor.userId}
        AND NOT EXISTS(SELECT 1 FROM public.support_case_assignments x WHERE x.case_id=s.id)
    )
    SELECT (c.admission OR c.screening OR c.booking OR c.support OR c.account) AS allowed,c.account AS "accountAllowed",
      coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r."submittedAt",r.kind,r."targetId") FROM
        (SELECT * FROM requests ORDER BY "submittedAt",kind,"targetId" LIMIT 51) r),'[]'::jsonb) AS items
    FROM capabilities c`);
  const row = result.rows[0];
  if (!row?.allowed) throw new AccessError(403);
  const items = z.array(queuedReview).parse(row.items);
  getLocalWorkflow(runtime);
  return {
    items: items.slice(0, 50),
    hasMore: items.length > 50,
    accountAllowed: row.accountAllowed,
  };
}

export async function claimLocalReview(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
) {
  if (!getLocalWorkflow(runtime)) throw new AccessError(404);
  const values = localReviewClaimInput.parse(input);
  const actor = await requireAdminAssurance(runtime, headers);
  return runtime.db.transaction(
    async (tx) => {
      const result = await tx.execute<{
        outcome: string;
        target_id: string | null;
      }>(sql`
      SELECT * FROM public.claim_local_workflow_task(${actor.userId},${actor.sessionId},${values.kind},${values.targetId},${values.requestId}::uuid)`);
      const row = result.rows[0];
      if (row?.outcome === "forbidden") throw new AccessError(403);
      if (row?.outcome === "not_found") throw new AccessError(404);
      if (row?.outcome === "conflict")
        throw new RuleError(
          409,
          "This request is already assigned or has changed. Refresh the queue to see current requests.",
        );
      if (
        !row ||
        !["saved", "replayed"].includes(row.outcome) ||
        row.target_id !== values.targetId
      )
        throw new Error("Review assignment unavailable.");
      const current = await tx.execute<{ allowed: boolean }>(
        sql`SELECT public.local_workflow_claim_current(${actor.userId},${actor.sessionId},${values.kind},${values.targetId}) AS allowed`,
      );
      if (!current.rows[0]?.allowed) throw new AccessError(403);
      getLocalWorkflow(runtime);
      return { id: row.target_id, replayed: row.outcome === "replayed" };
    },
    { isolationLevel: "read committed" },
  );
}
