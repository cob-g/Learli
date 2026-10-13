import { randomUUID } from "node:crypto";
import type { World, TestAccount } from "../integration/support";
import { createAccount } from "../integration/support";
import {
  provisionAdmissionPolicy,
  assignAdmissionReviewer,
} from "./learner-admission-fixtures";
import {
  createAdmission,
  mutateAdmissionReview,
  readAssignedAdmission,
  type AdmissionContext,
} from "@/features/learner-admission/service";
import { screeningFixture } from "../integration/screening-fixtures";
import {
  recordScreeningCheck,
  decideScreening,
} from "@/features/tutor-screening/service";
import { saveOwnAvailability } from "@/features/availability/service";
import {
  bookingPolicyDigest,
  validateBookingCapability,
  type EnabledBookingPolicy,
} from "@/features/booking-workflows/policy";
import type { BookingWorkflowContext } from "@/features/booking-workflows/service";
export async function provisionBookingPolicy(
  w: World,
  admissionPolicyId: string,
): Promise<EnabledBookingPolicy> {
  const fields = {
    authority: "synthetic_test",
    source: "synthetic_readiness",
    version: "synthetic-booking-v1",
    reference: "synthetic:booking:v1",
    admissionPolicyId,
    durationMinutes: 60,
    stepMinutes: 30,
    noticeMinutes: 60,
    horizonDays: 14,
    provisionalMinutes: 10,
    cancelCutoffMinutes: 60,
    moveCutoffMinutes: 60,
    confirmationPrerequisite: "synthetic_prerequisite_review",
    confirmationActor: "assigned_mfa_admin",
    outcomeActor: "assigned_mfa_admin",
    disputePath: "/support",
    meetingAccess: "confirmed_until_end",
  } as const;
  const cap = validateBookingCapability(
    {
      ...fields,
      policyId: randomUUID(),
      contentDigest: bookingPolicyDigest(fields),
    },
    "test",
  );
  if (cap.authority === "disabled") throw new Error();
  await w.owner.pool.query(
    "INSERT INTO booking_workflow_policies(id,version,reference,content_digest,terms) VALUES($1,$2,$3,$4,$5)",
    [cap.policyId, cap.version, cap.reference, cap.contentDigest, cap],
  );
  await w.owner.pool.query(
    "INSERT INTO booking_workflow_policy_head(source,policy_id,enabled) VALUES('synthetic_readiness',$1,true) ON CONFLICT(source) DO UPDATE SET policy_id=excluded.policy_id,enabled=true",
    [cap.policyId],
  );
  return cap;
}
export async function admittedFixture(
  w: World,
  reviewer: TestAccount,
  management: "guardian" | "self" = "guardian",
) {
  const admission = await provisionAdmissionPolicy(w.owner.pool),
    context: AdmissionContext = { runtime: w.runtime, admission },
    requester = await createAccount(w);
  const a = await createAdmission(context, requester.headers, {
    requestId: randomUUID(),
    policyVersion: admission.version,
    policyDigest: admission.contentDigest,
    management,
    displayName: "Fictional readiness learner",
    level: management === "self" ? "college_support" : "high_school",
    timezone: "Asia/Manila",
  });
  await assignAdmissionReviewer(w.owner.pool, a.id, reviewer.id);
  let revision = (await readAssignedAdmission(context, reviewer.headers, a.id))
    .revision;
  for (const checkCode of management === "self"
    ? ["independent_eligibility"]
    : ["guardian_authority", "guardian_notice"]) {
    const saved = await mutateAdmissionReview(
      context,
      reviewer.headers,
      a.id,
      "evidence",
      {
        requestId: randomUUID(),
        revision,
        checkCode,
        reference: `synthetic:${randomUUID()}`,
      },
    );
    revision = saved.revision;
  }
  const approved = await mutateAdmissionReview(
    context,
    reviewer.headers,
    a.id,
    "decision",
    { requestId: randomUUID(), revision, action: "authorize" },
  );
  return {
    requester,
    learner: approved.learner,
    admission,
    admissionId: a.id,
    admissionContext: context,
  };
}
export async function workflowFixture(
  w: World,
  reviewer: TestAccount,
  management: "guardian" | "self" = "guardian",
) {
  const family = await admittedFixture(w, reviewer, management),
    screen = await screeningFixture(w, reviewer),
    now = Date.now();
  for (const [revision, code] of [
    "synthetic_check_a",
    "synthetic_check_b",
  ].entries())
    await recordScreeningCheck(
      screen.context,
      reviewer.headers,
      screen.profile.id,
      {
        revision,
        code,
        requestKey: randomUUID(),
        outcome: "passed",
        reference: `screening:${randomUUID()}`,
        checkedAt: new Date(now - 60000).toISOString(),
        expiresAt: new Date(now + 7200000).toISOString(),
      },
    );
  await decideScreening(screen.context, reviewer.headers, screen.profile.id, {
    revision: 2,
    action: "approve",
    requestKey: randomUUID(),
  });
  await saveOwnAvailability(w.runtime, screen.tutor.headers, {
    version: 0,
    timezone: "Asia/Manila",
    windows: Array.from({ length: 7 }, (_, i) => ({
      isoWeekday: i + 1,
      startMinute: 0,
      endMinute: 1440,
    })),
  });
  const booking = await provisionBookingPolicy(w, family.admission.policyId),
    context: BookingWorkflowContext = { runtime: w.runtime, booking };
  return {
    ...family,
    ...screen,
    context,
    booking,
    choice: {
      learnerId: family.learner.id,
      tutorSlug: screen.profile.slug,
      subjectSlug: "math",
      displayTimezone: "Asia/Manila",
    },
  };
}
export async function grantWorkflowTask(
  w: World,
  logicalId: string,
  reviewer: TestAccount,
  actions = ["confirm", "complete", "no_show"],
) {
  for (const action of actions)
    await w.owner.pool.query(
      "INSERT INTO booking_workflow_grants(logical_booking_id,actor_user_id,action,active,valid_until,reference) VALUES($1,$2,$3,true,clock_timestamp()+interval '2 hours',$4) ON CONFLICT(logical_booking_id,actor_user_id,action) DO UPDATE SET active=true",
      [logicalId, reviewer.id, action, `synthetic:${randomUUID()}`],
    );
}
/** Test-owned historical records are inserted once with all guards/history enabled.
 * They are explicit synthetic fixtures, not runtime confirmation/attendance proof. */
export async function historicalWorkflowBooking(
  w: World,
  f: Awaited<ReturnType<typeof workflowFixture>>,
  reviewer: TestAccount,
  options: {
    state: "provisional" | "confirmed";
    start: Date;
    end: Date;
    expires: Date;
    created: Date;
  },
) {
  const id = randomUUID(),
    key = randomUUID(),
    eventId = randomUUID(),
    subject = (
      await w.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
    ).rows[0].id;
  const client = await w.owner.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at,workflow_policy_id,admission_policy_id) VALUES($1,'synthetic_readiness',$2,$3,$4,$5,$6,$7,'Asia/Manila',$8,$9,$10,$11,$12,$13,$14)",
      [
        id,
        f.profile.id,
        f.learner.id,
        f.requester.id,
        subject,
        options.start,
        options.end,
        key,
        "a".repeat(64),
        options.state,
        options.created,
        options.expires,
        f.booking.policyId,
        f.admission.policyId,
      ],
    );
    await client.query(
      "INSERT INTO booking_lifecycle_events(id,logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code) VALUES($1,$2,$2,$3,$4,$5,$6,$7,$8,0,$9)",
      [
        eventId,
        id,
        options.state === "confirmed" ? reviewer.id : f.requester.id,
        `workflow_${options.state}`,
        key,
        "a".repeat(64),
        options.created,
        f.booking.policyId,
        options.state === "confirmed"
          ? "synthetic_prerequisite_review"
          : "synthetic_request",
      ],
    );
    await client.query("COMMIT");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  return {
    id,
    logicalBookingId: id,
    revision: 0,
    workflowRevision: 0,
    eventId,
    state: options.state,
    policyVersion: f.booking.version,
  };
}
