import { randomUUID } from "node:crypto";
import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { handleAuthRequest } from "@/lib/auth-handler";
import { createLocalAuth } from "@/lib/auth-factory";
import type { LocalMessage } from "@/lib/email/local-mail";
import { admissionContext } from "@/features/learner-admission/context";
import {
  createAdmission,
  listAdmittedLearners,
  listAssignedAdmissions,
  mutateAdmissionReview,
  readAssignedAdmission,
} from "@/features/learner-admission/service";
import { getScreeningContext } from "@/features/tutor-screening/composition";
import {
  decideScreening,
  readScreening,
  recordScreeningCheck,
  requestScreening,
} from "@/features/tutor-screening/service";
import { localScreeningPolicy } from "@/features/tutor-screening/policy";
import {
  startTutorApplication,
  saveOwnTutorProfile,
  readOwnTutorProfile,
} from "@/features/tutors/service";
import { listEligibleTutors } from "@/features/tutors/eligibility";
import {
  readOwnAvailability,
  saveOwnAvailability,
} from "@/features/availability/service";
import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import {
  changePolicyBooking,
  createPolicyReservation,
  loadWorkflowOptions,
  readWorkflowCandidates,
  readWorkflowTask,
  readWorkflowMoveCandidates,
} from "@/features/booking-workflows/service";
import { readCurrentBookingNoticeRecipients } from "@/features/booking-workflows/provider";
import { readParticipantBooking } from "@/features/bookings/read-service";
import { createDemoReservation } from "@/features/bookings/service";
import {
  readPrivateMeetingLink,
  savePrivateMeetingLink,
} from "@/features/booking-meeting-links/service";
import {
  createCase,
  readCase,
  changeCaseStatus,
} from "@/features/support/service";
import {
  changeAccess,
  readTarget,
} from "@/features/account-restrictions/service";
import { enrollParentWorkspace } from "@/features/parent-onboarding/service";
import {
  prepareLocalPolicies,
  prepareLocalStaff,
} from "../../scripts/local-workflow";
import { enrollTestAdmin } from "../support/admin-mfa";
import { openOperationFixture } from "./support";

let world: ReturnType<typeof openOperationFixture>;
const password = `Ordinary-fixture-${randomUUID()}`;
function request(route: string, body: unknown) {
  return new Request(`${world.runtime.origin}/api/auth/${route}`, {
    method: "POST",
    headers: {
      origin: world.runtime.origin,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
async function providerCall(route: string, body: unknown) {
  let response = await handleAuthRequest(world.runtime, request(route, body));
  if (response.status === 429) {
    // The fixture shares the real provider limiter with other opt-in suites.
    // Honor its actual time window rather than changing counters or the guard.
    const seconds = Math.max(
      1,
      Math.min(60, Number(response.headers.get("retry-after")) || 60),
    );
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    response = await handleAuthRequest(world.runtime, request(route, body));
  }
  return response;
}
async function registeredAccount(name: string, domain = "example.invalid") {
  const email = `workflow-${randomUUID()}@${domain}`;
  const response = await providerCall("sign-up/email", {
    name,
    email,
    password,
    callbackURL: "/account",
  });
  expect(response.status).toBe(200);
  const id = (await response.json()).user.id as string;
  let verification: LocalMessage | undefined;
  const directory = path.join(world.fixture, ".local/mail/development");
  for (const file of await readdir(directory)) {
    if (!file.endsWith(".json")) continue;
    const value = JSON.parse(
      await readFile(path.join(directory, file), "utf8"),
    ) as LocalMessage;
    if (value.kind === "verification" && value.to === email)
      verification = value;
  }
  if (!verification || verification.kind !== "verification")
    throw new Error("Actual local proof missing.");
  expect(
    (await handleAuthRequest(world.runtime, new Request(verification.url)))
      .status,
  ).toBe(302);
  const signed = await providerCall("sign-in/email", { email, password });
  expect(signed.status).toBe(200);
  const cookie = signed.headers
    .getSetCookie()
    .map((part) => part.split(";")[0])
    .join("; ");
  return { id, email, cookie, headers: new Headers({ cookie }) };
}
async function claim(
  actor: Awaited<ReturnType<typeof registeredAccount>>,
  kind: string,
  target: string,
) {
  const identity = await world.runtime.auth.api.getSession({
    headers: actor.headers,
    query: { disableCookieCache: true },
  });
  if (!identity) throw new Error("Actual session missing.");
  const result = await world.runtime.db.execute<{ outcome: string }>(
    sql`SELECT * FROM public.claim_local_workflow_task(${actor.id},${identity.session.id},${kind},${target},${randomUUID()}::uuid)`,
  );
  expect(["claimed", "replayed", "saved", "existing"]).toContain(
    result.rows[0]?.outcome,
  );
}
/** New privileged fixture records only. No operating records or dates are rewritten. */
async function historicalConfirmed(input: {
  tutorId: string;
  learnerId: string;
  requesterId: string;
  reviewerId: string;
  subjectId: string;
  bookingPolicyId: string;
  admissionPolicyId: string;
  start: string;
  end: string;
}) {
  const id = randomUUID(),
    key = randomUUID();
  const client = await world.owner.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at,workflow_policy_id,admission_policy_id) VALUES($1,'local_operation',$2,$3,$4,$5,$6,$7,'Asia/Manila',$8,$9,'confirmed',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '110 minutes',$10,$11)",
      [
        id,
        input.tutorId,
        input.learnerId,
        input.requesterId,
        input.subjectId,
        input.start,
        input.end,
        key,
        "a".repeat(64),
        input.bookingPolicyId,
        input.admissionPolicyId,
      ],
    );
    await client.query(
      "INSERT INTO booking_lifecycle_events(logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code) VALUES($1,$1,$2,'workflow_confirmed',$3,$4,clock_timestamp()-interval '2 hours',$5,0,'local_prerequisite_review')",
      [id, input.reviewerId, key, "a".repeat(64), input.bookingPolicyId],
    );
    await client.query("COMMIT");
    return id;
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}
async function blockedSupportReadRevocation(
  admin: Awaited<ReturnType<typeof registeredAccount>>,
  caseId: string,
  change: "status" | "capability",
) {
  const before = await world.owner.pool.query(
    "SELECT count(*)::int n FROM support_booking_access_events WHERE case_id=$1",
    [caseId],
  );
  const blocker = await world.owner.pool.connect();
  let pending: Promise<{ value?: unknown; error?: unknown }> | undefined;
  try {
    await blocker.query("BEGIN");
    const blockerId = (await blocker.query("SELECT pg_backend_pid() pid"))
      .rows[0].pid as number;
    await blocker.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
      admin.id,
    ]);
    pending = readCase(world.runtime, admin.headers, caseId, "reviewer").then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    let observed = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      const wait = await world.owner.pool.query(
        "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND usename='learli_app' AND wait_event_type='Lock' AND $1=ANY(pg_blocking_pids(pid)) AND query LIKE '%permitted_case%') waiting",
        [blockerId],
      );
      if (wait.rows[0].waiting) {
        observed = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    expect(observed).toBe(true);
    await world.owner.pool.query(
      change === "status"
        ? "UPDATE local_workflow_staff SET status='revoked' WHERE user_id=$1"
        : "UPDATE local_workflow_staff SET capabilities=array_remove(capabilities,'support') WHERE user_id=$1",
      [admin.id],
    );
    await blocker.query("COMMIT");
    expect((await pending).error).toMatchObject({ status: 404 });
    const after = await world.owner.pool.query(
      "SELECT count(*)::int n FROM support_booking_access_events WHERE case_id=$1",
      [caseId],
    );
    expect(after.rows[0].n).toBe(before.rows[0].n);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
    await pending;
    await world.owner.pool.query(
      "UPDATE local_workflow_staff SET status='active',capabilities=ARRAY['admission','screening','booking','support','account'] WHERE user_id=$1",
      [admin.id],
    );
  }
}
beforeAll(() => {
  world = openOperationFixture();
  vi.spyOn(process, "cwd").mockReturnValue(world.fixture);
});
afterAll(async () => {
  vi.restoreAllMocks();
  await world?.close();
});

describe("ordinary persisted feature services on the explicit separate local fixture", () => {
  it("uses actual normal accounts, claimed reviews, the same confirmed booking and minimum scoped support", async () => {
    const admin = await registeredAccount("Operational fixture administrator");
    const parent = await registeredAccount("Operational fixture parent");
    const tutor = await registeredAccount("Operational fixture tutor");
    const unrelated = await registeredAccount(
      "Operational fixture unrelated account",
    );
    const ownerClient = await world.owner.pool.connect();
    try {
      await ownerClient.query("BEGIN");
      await prepareLocalPolicies(ownerClient);
      await prepareLocalStaff(ownerClient, admin.id);
      await ownerClient.query("COMMIT");
    } finally {
      await ownerClient.query("ROLLBACK");
      ownerClient.release();
    }
    admin.cookie = await enrollTestAdmin(world.runtime, admin.cookie, password);
    admin.headers = new Headers({ cookie: admin.cookie });
    await enrollParentWorkspace(world.runtime, parent.headers, {});
    const admission = admissionContext(world.runtime);
    if (admission.admission.authority === "disabled") throw new Error();
    const pending = await createAdmission(admission, parent.headers, {
      requestId: randomUUID(),
      policyVersion: admission.admission.version,
      policyDigest: admission.admission.contentDigest,
      management: "guardian",
      displayName: "Private fixture learner",
      level: "middle_school",
      grade: 8,
      timezone: "Asia/Manila",
    });
    expect(pending.currentAccess).toBe(false);
    expect(await listAdmittedLearners(admission, parent.headers)).toEqual([]);
    await expect(
      readAssignedAdmission(admission, admin.headers, pending.id),
    ).rejects.toMatchObject({ status: 404 });
    await claim(admin, "admission", pending.id);
    for (const checkCode of ["guardian_authority", "guardian_notice"]) {
      const current = await readAssignedAdmission(
        admission,
        admin.headers,
        pending.id,
      );
      await mutateAdmissionReview(
        admission,
        admin.headers,
        pending.id,
        "evidence",
        {
          requestId: randomUUID(),
          revision: current.revision,
          checkCode,
          reference: `local:${randomUUID()}`,
        },
      );
    }
    for (const change of ["status", "capability"] as const) {
      await world.owner.pool.query(
        change === "status"
          ? "UPDATE local_workflow_staff SET status='revoked' WHERE user_id=$1"
          : "UPDATE local_workflow_staff SET capabilities=array_remove(capabilities,'admission') WHERE user_id=$1",
        [admin.id],
      );
      try {
        expect(
          (await listAssignedAdmissions(admission, admin.headers)).items.some(
            (item) => item.id === pending.id,
          ),
        ).toBe(false);
        await expect(
          readAssignedAdmission(admission, admin.headers, pending.id),
        ).rejects.toMatchObject({ status: 404 });
        const retained = await world.owner.pool.query(
          "SELECT reviewer_user_id,(SELECT count(*)::int FROM learner_admission_evidence WHERE admission_id=$1) AS evidence FROM learner_admission_assignments WHERE admission_id=$1",
          [pending.id],
        );
        expect(retained.rows[0]).toMatchObject({
          reviewer_user_id: admin.id,
          evidence: 2,
        });
      } finally {
        await world.owner.pool.query(
          "UPDATE local_workflow_staff SET status='active',capabilities=ARRAY['admission','screening','booking','support','account'] WHERE user_id=$1",
          [admin.id],
        );
      }
    }
    await world.owner.pool.query(
      "UPDATE learner_admission_policy_state SET enabled=false WHERE source='local_operation'",
    );
    try {
      expect(
        (await listAssignedAdmissions(admission, admin.headers)).items.some(
          (item) => item.id === pending.id,
        ),
      ).toBe(false);
      await expect(
        readAssignedAdmission(admission, admin.headers, pending.id),
      ).rejects.toMatchObject({ status: 404 });
    } finally {
      await world.owner.pool.query(
        "UPDATE learner_admission_policy_state SET enabled=true WHERE source='local_operation'",
      );
    }
    const reviewed = await readAssignedAdmission(
      admission,
      admin.headers,
      pending.id,
    );
    await mutateAdmissionReview(
      admission,
      admin.headers,
      pending.id,
      "decision",
      {
        requestId: randomUUID(),
        revision: reviewed.revision,
        action: "authorize",
      },
    );
    const [learner] = await listAdmittedLearners(admission, parent.headers);
    expect(learner).toMatchObject({ id: pending.learner.id, grade: 8 });
    await startTutorApplication(world.runtime, tutor.headers, {});
    await world.owner.pool.query(
      "INSERT INTO subjects(slug,name,category,is_active) VALUES('math','Math','academic_core',true) ON CONFLICT(slug) DO NOTHING",
    );
    const subject = (
      await world.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
    ).rows[0].id as string;
    await saveOwnTutorProfile(world.runtime, tutor.headers, {
      headline: "Operational fixture tutor",
      bio: "Isolated software verification profile.",
      teachingBackground: "Isolated fixture review.",
      timezone: "Asia/Manila",
      offerings: [
        { subjectId: subject, levels: ["middle_school", "college_support"] },
      ],
    });
    const profile = await readOwnTutorProfile(world.runtime, tutor.headers);
    if (!profile) throw new Error();
    const screening = getScreeningContext(world.runtime);
    await requestScreening(screening, tutor.headers, profile.id, {
      requestKey: randomUUID(),
    });
    expect(
      (await listEligibleTutors(world.runtime.db, {}, "local_operation")).some(
        (t) => t.slug === profile.slug,
      ),
    ).toBe(false);
    await claim(admin, "screening", profile.id);
    for (const code of localScreeningPolicy.requiredCheckCodes) {
      const current = await readScreening(screening, admin.headers, profile.id);
      if (!current) throw new Error();
      await recordScreeningCheck(screening, admin.headers, profile.id, {
        revision: current.revision,
        requestKey: randomUUID(),
        code,
        outcome: "passed",
        reference: `screening:${randomUUID()}`,
        checkedAt: new Date(Date.now() - 60000).toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
    }
    const screened = await readScreening(screening, admin.headers, profile.id);
    if (!screened) throw new Error();
    await decideScreening(screening, admin.headers, profile.id, {
      revision: screened.revision,
      requestKey: randomUUID(),
      action: "approve",
    });
    const availability = await readOwnAvailability(
      world.runtime,
      tutor.headers,
    );
    if (!availability) throw new Error();
    await saveOwnAvailability(world.runtime, tutor.headers, {
      version: availability.version,
      timezone: "Asia/Manila",
      windows: [1, 2, 3, 4, 5, 6, 7].map((isoWeekday) => ({
        isoWeekday,
        startMinute: 480,
        endMinute: 1080,
      })),
    });
    const context = bookingWorkflowContext(world.runtime);
    expect(
      (await loadWorkflowOptions(context, parent.headers)).tutors.some(
        (t) => t.slug === profile.slug,
      ),
    ).toBe(true);
    const choice = {
      learnerId: learner.id,
      tutorSlug: profile.slug,
      subjectSlug: "math",
      displayTimezone: "Asia/Manila",
    };
    const [slot] = await readWorkflowCandidates(
      context,
      parent.headers,
      choice,
    );
    if (!slot) throw new Error("Actual available future slot required.");
    const input = {
      ...choice,
      startAtUtc: slot.startAtUtc,
      endAtUtc: slot.endAtUtc,
      idempotencyKey: randomUUID(),
    };
    const competing = [input, { ...input, idempotencyKey: randomUUID() }];
    const attempts = await Promise.allSettled(
      competing.map((value) =>
        createPolicyReservation(context, parent.headers, value),
      ),
    );
    expect(
      attempts.filter((value) => value.status === "fulfilled"),
    ).toHaveLength(1);
    const winnerIndex = attempts.findIndex(
      (value) => value.status === "fulfilled",
    );
    const winner = attempts[winnerIndex];
    if (winner.status !== "fulfilled") throw new Error();
    const booking = winner.value;
    const loser = attempts.find((value) => value.status === "rejected");
    expect(
      loser && loser.status === "rejected" ? loser.reason : null,
    ).toMatchObject({ status: 409 });
    expect(
      (
        await createPolicyReservation(
          context,
          parent.headers,
          competing[winnerIndex],
        )
      ).id,
    ).toBe(booking.id);
    await expect(
      readPrivateMeetingLink(world.runtime, unrelated.headers, booking.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      createDemoReservation(world.runtime, parent.headers, input),
    ).rejects.toMatchObject({ status: 503 });
    await claim(admin, "booking", booking.id);
    const task = await readWorkflowTask(context, admin.headers, booking.id);
    expect(task.actions).toContain("confirm");
    const confirmed = await changePolicyBooking(
      context,
      admin.headers,
      booking.id,
      "confirm",
      {
        requestId: randomUUID(),
        expectedRevision: booking.workflowRevision,
        reasonCode: "local_prerequisite_review",
      },
    );
    expect(confirmed.state).toBe("confirmed");
    for (const [actor, scope] of [
      [parent, "guardian"],
      [tutor, "tutor"],
    ] as const)
      expect(
        await readParticipantBooking(
          world.runtime,
          actor.headers,
          booking.id,
          scope,
        ),
      ).toMatchObject({
        id: booking.id,
        source: "local_operation",
        state: "confirmed",
      });
    await expect(
      readParticipantBooking(
        world.runtime,
        unrelated.headers,
        booking.id,
        "guardian",
      ),
    ).rejects.toMatchObject({ status: 404 });
    await savePrivateMeetingLink(world.runtime, tutor.headers, booking.id, {
      requestId: randomUUID(),
      expectedRevision: 0,
      url: "https://meet.google.com/abc-defg-hij",
    });
    expect(
      await readPrivateMeetingLink(world.runtime, parent.headers, booking.id),
    ).toMatchObject({ state: "present", canEdit: false });
    await expect(
      readPrivateMeetingLink(world.runtime, admin.headers, booking.id),
    ).rejects.toMatchObject({ status: 404 });
    const recipients = await readCurrentBookingNoticeRecipients(
      world.runtime.db,
      confirmed.eventId,
    );
    expect(recipients).toHaveLength(2);
    expect(recipients.every((r) => r.source === "local_operation")).toBe(true);
    await expect(
      changePolicyBooking(context, tutor.headers, booking.id, "complete", {
        requestId: randomUUID(),
        expectedRevision: confirmed.workflowRevision,
        reasonCode: "local_completed",
      }),
    ).rejects.toMatchObject({ status: 409 });
    const alternate = (
      await readWorkflowMoveCandidates(context, parent.headers, booking.id)
    ).find((value) => value.startAtUtc !== slot.startAtUtc);
    if (!alternate) throw new Error("Actual alternate slot required.");
    const moved = await changePolicyBooking(
      context,
      parent.headers,
      booking.id,
      "reschedule",
      {
        requestId: randomUUID(),
        expectedRevision: confirmed.workflowRevision,
        reasonCode: "local_participant_change",
        startAtUtc: alternate.startAtUtc,
        endAtUtc: alternate.endAtUtc,
        displayTimezone: "Asia/Manila",
      },
    );
    expect(moved.id).not.toBe(booking.id);
    expect(
      await readPrivateMeetingLink(world.runtime, parent.headers, booking.id),
    ).toMatchObject({ state: "expired" });
    expect(
      await readPrivateMeetingLink(world.runtime, parent.headers, moved.id),
    ).toMatchObject({ state: "missing" });
    expect(
      (
        await changePolicyBooking(context, parent.headers, moved.id, "cancel", {
          requestId: randomUUID(),
          expectedRevision: moved.workflowRevision,
          reasonCode: "local_participant_change",
        })
      ).state,
    ).toBe("cancelled");
    const report = await createCase(world.runtime, parent.headers, {
      requestKey: randomUUID(),
      category: "account",
      subject: "Fixture booking coordination",
      body: "Separate isolated service acceptance.",
      bookingId: booking.id,
    });
    await claim(admin, "support", report.id);
    expect(
      (await readCase(world.runtime, admin.headers, report.id, "reviewer"))
        .booking,
    ).toMatchObject({ available: true, source: "local_operation" });
    const reportState = await readCase(
      world.runtime,
      admin.headers,
      report.id,
      "reviewer",
    );
    expect(
      (
        await changeCaseStatus(world.runtime, admin.headers, report.id, {
          revision: reportState.revision,
          status: "in_review",
        })
      ).status,
    ).toBe("in_review");
    await blockedSupportReadRevocation(admin, report.id, "status");
    await blockedSupportReadRevocation(admin, report.id, "capability");
    if (context.booking.authority !== "local_operation") throw new Error();
    const historicalFields = {
      tutorId: profile.id,
      learnerId: learner.id,
      requesterId: parent.id,
      reviewerId: admin.id,
      subjectId: subject,
      bookingPolicyId: context.booking.policyId,
      admissionPolicyId: context.booking.admissionPolicyId,
    };
    const oldHold = await historicalConfirmed({
      ...historicalFields,
      start: slot.startAtUtc,
      end: slot.endAtUtc,
    });
    expect(
      await readParticipantBooking(
        world.runtime,
        parent.headers,
        oldHold,
        "guardian",
      ),
    ).toMatchObject({ state: "confirmed", source: "local_operation" });
    expect(
      (await readWorkflowCandidates(context, parent.headers, choice)).some(
        (value) => value.startAtUtc === slot.startAtUtc,
      ),
    ).toBe(false);
    const ended = await historicalConfirmed({
      ...historicalFields,
      start: new Date(Date.now() - 90 * 60000).toISOString(),
      end: new Date(Date.now() - 30 * 60000).toISOString(),
    });
    expect(
      (
        await changePolicyBooking(context, tutor.headers, ended, "complete", {
          requestId: randomUUID(),
          expectedRevision: 0,
          reasonCode: "local_completed",
        })
      ).state,
    ).toBe("completed");
    const student = await registeredAccount(
      "Independent fixture college learner",
    );
    const college = await createAdmission(admission, student.headers, {
      requestId: randomUUID(),
      policyVersion: admission.admission.version,
      policyDigest: admission.admission.contentDigest,
      management: "self",
      displayName: "Independent fixture learner",
      level: "college_support",
      timezone: "Asia/Manila",
    });
    expect(college.currentAccess).toBe(false);
    await claim(admin, "admission", college.id);
    let collegeReview = await readAssignedAdmission(
      admission,
      admin.headers,
      college.id,
    );
    await mutateAdmissionReview(
      admission,
      admin.headers,
      college.id,
      "evidence",
      {
        requestId: randomUUID(),
        revision: collegeReview.revision,
        checkCode: "independent_eligibility",
        reference: `local:${randomUUID()}`,
      },
    );
    collegeReview = await readAssignedAdmission(
      admission,
      admin.headers,
      college.id,
    );
    await mutateAdmissionReview(
      admission,
      admin.headers,
      college.id,
      "decision",
      {
        requestId: randomUUID(),
        revision: collegeReview.revision,
        action: "authorize",
      },
    );
    const [collegeLearner] = await listAdmittedLearners(
      admission,
      student.headers,
    );
    expect(collegeLearner.management).toBe("self");
    const collegeChoice = { ...choice, learnerId: collegeLearner.id };
    const [collegeSlot] = await readWorkflowCandidates(
      context,
      student.headers,
      collegeChoice,
    );
    if (!collegeSlot) throw new Error();
    const collegeBooking = await createPolicyReservation(
      context,
      student.headers,
      {
        ...collegeChoice,
        startAtUtc: collegeSlot.startAtUtc,
        endAtUtc: collegeSlot.endAtUtc,
        idempotencyKey: randomUUID(),
      },
    );
    await claim(admin, "booking", collegeBooking.id);
    await changePolicyBooking(
      context,
      admin.headers,
      collegeBooking.id,
      "confirm",
      {
        requestId: randomUUID(),
        expectedRevision: collegeBooking.workflowRevision,
        reasonCode: "local_prerequisite_review",
      },
    );
    expect(
      await readParticipantBooking(
        world.runtime,
        student.headers,
        collegeBooking.id,
        "student",
      ),
    ).toMatchObject({ state: "confirmed", source: "local_operation" });
    await expect(
      readParticipantBooking(
        world.runtime,
        parent.headers,
        collegeBooking.id,
        "guardian",
      ),
    ).rejects.toMatchObject({ status: 404 });
    // An owner-created legacy fixture remains retained and readable in its original
    // mode, while the ordinary application excludes even this owned .test record.
    const legacyAccount = await registeredAccount(
      "Historical fixture owner",
      "learli.test",
    );
    await enrollParentWorkspace(world.runtime, legacyAccount.headers, {});
    const oldLearner = randomUUID(),
      oldBooking = randomUUID();
    const legacyClient = await world.owner.pool.connect();
    try {
      await legacyClient.query("BEGIN");
      await legacyClient.query(
        "INSERT INTO learner_profiles(id,fixture_key,source,management,display_name,level,timezone,status) VALUES($1,$2,'local_fixture','guardian','Historical fixture learner','high_school','Asia/Manila','active')",
        [oldLearner, `legacy:${randomUUID()}`],
      );
      await legacyClient.query(
        "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
        [legacyAccount.id, oldLearner],
      );
      await legacyClient.query(
        "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) VALUES($1,'local_simulation',$2,$3,$4,$5,clock_timestamp()+interval '40 days',clock_timestamp()+interval '40 days 1 hour','Asia/Manila',$6,$7,'demo_reserved',clock_timestamp(),clock_timestamp()+interval '10 minutes')",
        [
          oldBooking,
          profile.id,
          oldLearner,
          legacyAccount.id,
          subject,
          randomUUID(),
          "b".repeat(64),
        ],
      );
      await legacyClient.query("COMMIT");
    } finally {
      await legacyClient.query("ROLLBACK");
      legacyClient.release();
    }
    await expect(
      readParticipantBooking(
        world.runtime,
        legacyAccount.headers,
        oldBooking,
        "guardian",
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      readPrivateMeetingLink(world.runtime, legacyAccount.headers, oldBooking),
    ).rejects.toMatchObject({ status: 404 });
    vi.stubEnv("LOCAL_WORKFLOW_MODE", "disabled");
    let legacyRuntime: ReturnType<typeof createLocalAuth> | undefined;
    try {
      legacyRuntime = createLocalAuth(process.env);
      expect(
        await readParticipantBooking(
          legacyRuntime,
          legacyAccount.headers,
          oldBooking,
          "guardian",
        ),
      ).toMatchObject({ source: "local_simulation", state: "demo_reserved" });
    } finally {
      await legacyRuntime?.pool.end();
      vi.stubEnv("LOCAL_WORKFLOW_MODE", "enabled");
    }
    await claim(admin, "account", unrelated.id);
    const account = await readTarget(
      world.runtime,
      admin.headers,
      unrelated.id,
      {},
    );
    expect(
      await changeAccess(world.runtime, admin.headers, unrelated.id, {
        revision: account.revision,
        status: "suspended",
        reason: "local_restrict",
        requestKey: randomUUID(),
      }),
    ).toMatchObject({ status: "suspended" });
    // Retain actual successful provider sessions only in the private, ignored
    // fixture, so the browser can inspect the same ordinary records and MFA.
    const accountHandoff = (
      actor: Awaited<ReturnType<typeof registeredAccount>>,
    ) => ({ id: actor.id, email: actor.email, password, cookie: actor.cookie });
    const handoff = {
      origin: world.runtime.origin,
      source: "local_operation",
      accounts: {
        admin: accountHandoff(admin),
        parent: accountHandoff(parent),
        tutor: accountHandoff(tutor),
        college: accountHandoff(student),
        unrelated: accountHandoff(unrelated),
      },
      records: {
        parentAdmissionId: pending.id,
        parentLearnerId: learner.id,
        tutorId: profile.id,
        tutorSlug: profile.slug,
        tutorSubjectId: subject,
        originalBookingId: booking.id,
        originalBookingState: "replaced",
        movedBookingId: moved.id,
        movedBookingState: "cancelled",
        expiredOriginalHoldBookingId: oldHold,
        expiredOriginalHoldBookingState: "confirmed",
        completedBookingId: ended,
        completedBookingState: "completed",
        collegeAdmissionId: college.id,
        collegeLearnerId: collegeLearner.id,
        collegeBookingId: collegeBooking.id,
        collegeBookingState: "confirmed",
        supportCaseId: report.id,
        supportCaseState: "in_review",
        unrelatedAccountState: "suspended",
      },
    };
    const temporaryHandoff = path.join(
      world.fixture,
      `.browser-accounts-${randomUUID()}.json`,
    );
    await writeFile(temporaryHandoff, JSON.stringify(handoff), {
      mode: 0o600,
      flag: "wx",
    });
    await rename(
      temporaryHandoff,
      path.join(world.fixture, "browser-accounts.json"),
    );
  }, 120000);
});
