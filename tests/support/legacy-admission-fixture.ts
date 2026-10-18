/** Historical pre0034 migration setup only. Exercise the retained SQL entry
 * points under real verified synthetic sessions, without calling current DTO
 * projections against a schema that deliberately lacks grade. */
import { randomUUID } from "node:crypto";
import type { PrivateLearner } from "@/features/learners/service";
import type { AdmissionContext } from "@/features/learner-admission/service";
import {
  createAccount,
  type TestAccount,
  type World,
} from "../integration/support";
import {
  provisionAdmissionPolicy,
  assignAdmissionReviewer,
} from "./learner-admission-fixtures";

export async function legacyAdmittedFixture(
  world: World,
  reviewer: TestAccount,
  management: "guardian" | "self",
) {
  const admission = await provisionAdmissionPolicy(world.owner.pool),
    context: AdmissionContext = { runtime: world.runtime, admission },
    requester = await createAccount(world);
  const current = await world.runtime.auth.api.getSession({
      headers: requester.headers,
    }),
    reviewSession = await world.runtime.auth.api.getSession({
      headers: reviewer.headers,
    });
  if (!current || !reviewSession)
    throw new Error("Historical fixture sessions unavailable.");
  const created = (
    await world.runtime.pool.query(
      "SELECT * FROM public.create_learner_admission($1,$2,$3,$4,$5,$6,$7,$8,NULL)",
      [
        requester.id,
        current.session.id,
        randomUUID(),
        admission.policyId,
        management,
        "Fictional readiness learner",
        management === "self" ? "college_support" : "high_school",
        "Asia/Manila",
      ],
    )
  ).rows[0];
  if (created?.outcome !== "created")
    throw new Error("Historical fixture admission failed.");
  const id = String(created.admission_id);
  await assignAdmissionReviewer(world.owner.pool, id, reviewer.id);
  const revision = async () =>
    (
      await world.runtime.pool.query(
        "SELECT revision FROM learner_admissions WHERE id=$1",
        [id],
      )
    ).rows[0].revision as number;
  for (const check of management === "self"
    ? ["independent_eligibility"]
    : ["guardian_authority", "guardian_notice"]) {
    const saved = (
      await world.runtime.pool.query(
        "SELECT * FROM public.record_learner_admission_evidence($1,$2,$3,$4,$5,$6,$7)",
        [
          reviewer.id,
          reviewSession.session.id,
          id,
          await revision(),
          randomUUID(),
          check,
          `synthetic:${randomUUID()}`,
        ],
      )
    ).rows[0];
    if (saved?.outcome !== "recorded")
      throw new Error("Historical fixture evidence failed.");
  }
  const decided = (
    await world.runtime.pool.query(
      "SELECT * FROM public.decide_learner_admission($1,$2,$3,$4,$5,'authorize')",
      [
        reviewer.id,
        reviewSession.session.id,
        id,
        await revision(),
        randomUUID(),
      ],
    )
  ).rows[0];
  if (decided?.outcome !== "decided")
    throw new Error("Historical fixture review failed.");
  const learner = (
    await world.runtime.pool.query<PrivateLearner>(
      `SELECT id,display_name AS "displayName",level,NULL::integer AS grade,timezone,management FROM learner_profiles
    WHERE id=$1 AND public.has_current_learner_authority($2,$3,id,$4)`,
      [
        created.learner_id,
        requester.id,
        current.session.id,
        admission.policyId,
      ],
    )
  ).rows[0];
  if (!learner) throw new Error("Historical fixture authority unavailable.");
  return {
    requester,
    learner,
    admission,
    admissionId: id,
    admissionContext: context,
  };
}
