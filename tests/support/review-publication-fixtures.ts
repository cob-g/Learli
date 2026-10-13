import { randomUUID } from "node:crypto";
import type { World, TestAccount } from "../integration/support";
import {
  publicationPolicyDigest,
  validatePublicationCapability,
  type EnabledPublicationPolicy,
} from "@/features/review-publication/policy";
import {
  historicalWorkflowBooking,
  grantWorkflowTask,
  type workflowFixture,
} from "./booking-workflows-fixtures";
import { changePolicyBooking } from "@/features/booking-workflows/service";
export async function provisionPublicationPolicy(
  w: World,
): Promise<EnabledPublicationPolicy> {
  const fields = {
    authority: "synthetic_test",
    source: "synthetic_readiness",
    version: "synthetic-publication-v1",
    reference: "synthetic:publication:v1",
    eligibleOutcome: "administrative_completed",
    authorRelation: "current_booking_beneficiary",
    submissionRule: "one_immutable_per_logical_booking",
    moderation: "manual_exact_assigned_mfa",
    privacyReview: "explicit_before_approval_and_publication",
    publicFields: "anonymous_label_rating_plain_text_date",
    disputePath: "/support",
  } as const;
  const p = validatePublicationCapability(
    {
      ...fields,
      policyId: randomUUID(),
      contentDigest: publicationPolicyDigest(fields),
    },
    "test",
  );
  if (p.authority === "disabled")
    throw new Error("Synthetic publication policy required");
  await w.owner.pool.query(
    "INSERT INTO review_publication_policies(id,version,reference,content_digest,terms) VALUES($1,$2,$3,$4,$5)",
    [p.policyId, p.version, p.reference, p.contentDigest, p],
  );
  await w.owner.pool.query(
    "INSERT INTO review_publication_policy_head(source,policy_id,enabled) VALUES('synthetic_readiness',$1,true) ON CONFLICT(source) DO UPDATE SET policy_id=excluded.policy_id,enabled=true",
    [p.policyId],
  );
  return p;
}
export async function grantPublication(
  w: World,
  reviewId: string,
  reviewer: TestAccount,
  policyId: string,
) {
  await w.owner.pool.query(
    "INSERT INTO publication_moderator_grants(review_id,moderator_user_id,policy_id,active,valid_until,reference) VALUES($1,$2,$3,true,clock_timestamp()+interval '2 hours',$4) ON CONFLICT(review_id,moderator_user_id) DO UPDATE SET active=true",
    [reviewId, reviewer.id, policyId, `synthetic:${randomUUID()}`],
  );
}
export async function completedPublicationBooking(
  w: World,
  f: Awaited<ReturnType<typeof workflowFixture>>,
  reviewer: TestAccount,
) {
  const now = Date.now();
  const initial = await historicalWorkflowBooking(w, f, reviewer, {
    state: "confirmed",
    start: new Date(now - 7200000),
    end: new Date(now - 3600000),
    created: new Date(now - 10800000),
    expires: new Date(now - 10200000),
  });
  await grantWorkflowTask(w, initial.logicalBookingId, reviewer);
  return changePolicyBooking(
    f.context,
    reviewer.headers,
    initial.id,
    "complete",
    {
      requestId: randomUUID(),
      expectedRevision: 0,
      reasonCode: "synthetic_completed",
    },
  );
}
