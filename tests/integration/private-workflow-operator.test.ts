// Explicit owner metadata preparation only; domain fixtures below are separate setup.
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  parsePrivateWorkflow,
  type PrivateWorkflowBinding,
  type PrivateWorkflowPacket,
} from "@/features/private-workflow/config";
import {
  PrivateWorkflowOperatorError,
  runPrivateWorkflowOperation,
} from "@/features/private-workflow/operator";
import { localDatabaseConfig } from "@/lib/db/local-config";
import { bookingPolicyDigest } from "@/features/booking-workflows/policy";
import { screeningActions } from "@/features/tutor-screening/policy";
import {
  createAdmission,
  readAssignedAdmission,
} from "@/features/learner-admission/service";
import { requestScreening } from "@/features/tutor-screening/service";
import {
  readOwnTutorProfile,
  saveOwnTutorProfile,
} from "@/features/tutors/service";
import {
  createPolicyReservation,
  readWorkflowCandidates,
  readWorkflowTask,
} from "@/features/booking-workflows/service";
import { syntheticAdmissionPolicy } from "../support/learner-admission-fixtures";
import {
  historicalWorkflowBooking,
  workflowFixture,
} from "../support/booking-workflows-fixtures";
import {
  closeWorld,
  createAccount,
  openWorld,
  type TestAccount,
  type World,
} from "./support";
import { privateWorkflowMain } from "../../scripts/private-workflow";
import { dispatchManualPreview } from "../../scripts/manual-preview-dispatch";

let world: World,
  expected: PrivateWorkflowBinding,
  reviewer: TestAccount,
  requester: TestAccount,
  tutor: TestAccount,
  nonadmin: TestAccount,
  unassured: TestAccount,
  unlisted: TestAccount;
let tutorProfile: NonNullable<Awaited<ReturnType<typeof readOwnTutorProfile>>>,
  reviewerProfile: NonNullable<Awaited<ReturnType<typeof readOwnTutorProfile>>>;

async function profile(actor: TestAccount) {
  const subject = (
    await world.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
  ).rows[0].id;
  await saveOwnTutorProfile(world.runtime, actor.headers, {
    headline: "Fictional operator math tutor",
    bio: "Fictional operator acceptance introduction.",
    teachingBackground: "Fictional operator acceptance background.",
    timezone: "Asia/Manila",
    offerings: [
      { subjectId: subject, levels: ["high_school", "college_support"] },
    ],
  });
  const result = await readOwnTutorProfile(world.runtime, actor.headers);
  if (!result) throw new Error("Required synthetic profile unavailable.");
  return result;
}

beforeAll(async () => {
  // This suite tests the explicit core, independent of any browser-selected packet.
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
  world = openWorld();
  const database = localDatabaseConfig(process.env.DATABASE_URL, true);
  expected = {
    origin: world.runtime.origin,
    database: {
      mode: "local-test",
      host: database.host as "127.0.0.1" | "localhost" | "::1",
      port: database.port,
      database: "learli_test",
      runtimeRole: "learli_app",
    },
  };
  reviewer = await createAccount(world, ["admin", "tutor"]);
  requester = await createAccount(world);
  tutor = await createAccount(world, ["tutor"]);
  nonadmin = await createAccount(world);
  unassured = await createAccount(world);
  // Trusted setup grants the role, but deliberately enrolls no factor or MFA receipt.
  await world.owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
    [unassured.id],
  );
  unlisted = await createAccount(world, ["admin"]);
  tutorProfile = await profile(tutor);
  reviewerProfile = await profile(reviewer);
}, 60000);
afterAll(async () => {
  if (world) {
    await world.owner.pool.query(
      "UPDATE booking_workflow_policy_head SET enabled=false WHERE source='synthetic_readiness'",
    );
    await world.owner.pool.query(
      "UPDATE tutor_screening_policy_heads SET status='revoked' WHERE provenance='synthetic_readiness'",
    );
  }
  await closeWorld(world);
  vi.unstubAllEnvs();
});

async function packet(overrides: Record<string, unknown> = {}) {
  const found = await world.owner.pool.query(
    "SELECT id FROM learner_admission_policies WHERE source='synthetic_readiness' AND market_code='synthetic_test' AND version='synthetic-admission-v1'",
  );
  const admission = syntheticAdmissionPolicy(found.rows[0]?.id ?? randomUUID());
  const terms = {
    authority: "synthetic_test",
    source: "synthetic_readiness",
    version: "synthetic-booking-v2",
    reference: "synthetic:booking:v2",
    admissionPolicyId: admission.policyId,
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
    completionActor: "assigned_tutor",
  } as const;
  const now = Date.now();
  return parsePrivateWorkflow(
    {
      version: 1,
      purpose: "private_fictional_workflow",
      audience: "fictional_only",
      realIntake: "disabled",
      payments: "disabled",
      origin: expected.origin,
      database: expected.database,
      accountEmails: [reviewer, requester, tutor, nonadmin, unassured].map(
        (account) => account.email,
      ),
      admission,
      screening: {
        mode: "synthetic_test",
        provenance: "synthetic_readiness",
        version: `operator-${randomUUID()}`,
        reference: `policy:${randomUUID()}`,
        authorityReference: `synthetic:${randomUUID()}`,
        validFrom: new Date(now - 60000).toISOString(),
        validUntil: new Date(now + 7200000).toISOString(),
        requiredCheckCodes: ["synthetic_check_a", "synthetic_check_b"],
        allowedActions: [...screeningActions],
        expiryRule: "all_checks_current",
      },
      booking: {
        ...terms,
        policyId: randomUUID(),
        contentDigest: bookingPolicyDigest(terms),
      },
      ...overrides,
    },
    expected,
  );
}
async function run(
  value: PrivateWorkflowPacket,
  command: Record<string, unknown>,
  pool: Pool = world.owner.pool,
  binding = expected,
) {
  const connection = await pool.connect();
  try {
    return await runPrivateWorkflowOperation(connection, value, binding, {
      apply: true,
      reviewerEmail: reviewer.email,
      ...command,
    });
  } finally {
    connection.release();
  }
}
const prepare = (value: PrivateWorkflowPacket, actor = reviewer) =>
  run(value, { action: "prepare", reviewerEmail: actor.email });
const deadline = () => new Date(Date.now() + 3600000).toISOString();
async function pending(value: PrivateWorkflowPacket, actor = requester) {
  return createAdmission(
    { runtime: world.runtime, admission: value.admission },
    actor.headers,
    {
      requestId: randomUUID(),
      policyVersion: value.admission.version,
      policyDigest: value.admission.contentDigest,
      management: "guardian",
      displayName: "Fictional operator learner",
      level: "high_school",
      timezone: "Asia/Manila",
    },
  );
}
async function domainCounts() {
  return (
    await world.owner.pool.query(`SELECT
      (SELECT count(*)::int FROM public."user") AS accounts,
      (SELECT count(*)::int FROM public."user" WHERE email_verified) AS verified,
      (SELECT count(*)::int FROM public."user" WHERE two_factor_enabled) AS enabled_factors,
      (SELECT count(*)::int FROM two_factor) AS factors,
      (SELECT count(*)::int FROM admin_assurance_receipts) AS mfa_receipts,
      (SELECT count(*)::int FROM user_roles) AS roles,
      (SELECT count(*)::int FROM guardian_learner_links) AS links,
      (SELECT count(*)::int FROM learner_admission_evidence) AS admission_evidence,
      (SELECT count(*)::int FROM tutor_screening_checks) AS screening_checks,
      (SELECT count(*)::int FROM tutor_screening_decisions) AS screening_decisions,
      (SELECT count(*)::int FROM tutor_profiles WHERE review_status='approved') AS approved_tutors,
      (SELECT count(*)::int FROM bookings) AS bookings,
      (SELECT count(*)::int FROM booking_lifecycle_events) AS booking_events`)
  ).rows[0];
}

describe("explicit private workflow operator on isolated PostgreSQL", () => {
  it("prepares exact immutable receipts idempotently without creating identity, MFA or domain authority", async () => {
    const value = await packet(),
      before = await domainCounts();
    const result = await prepare(value, unassured);
    expect(result).toEqual({
      action: "prepare",
      status: "applied",
      policies: 3,
      reviewers: 1,
      assignments: 0,
      confirmationGrants: 0,
    });
    expect(await prepare(value, unassured)).toEqual(result);
    expect(await domainCounts()).toEqual(before);
    const metadata = await world.owner.pool.query(
      `SELECT
       (SELECT count(*)::int FROM learner_admission_reviewers WHERE user_id=$1 AND active) AS admission,
       (SELECT count(*)::int FROM tutor_screening_staff WHERE user_id=$1 AND provenance='synthetic_readiness' AND status='authorized' AND valid_until=$2::timestamptz) AS screening,
       (SELECT count(*)::int FROM two_factor WHERE user_id=$1) AS factors`,
      [unassured.id, value.screening.validUntil],
    );
    expect(metadata.rows[0]).toEqual({
      admission: 1,
      screening: 1,
      factors: 0,
    });
    const summary = JSON.stringify(result);
    for (const privateValue of [
      unassured.email,
      unassured.id,
      value.booking.policyId,
    ])
      expect(summary).not.toContain(privateValue);
  });

  it("requires explicit apply and refuses hosted/production CLI requests before any target connection", async () => {
    const value = await packet();
    await expect(
      run(value, { action: "prepare", apply: false }),
    ).rejects.toBeInstanceOf(PrivateWorkflowOperatorError);
    const before = await domainCounts();
    for (const argv of [
      ["--test", "--action", "prepare", "--config", ".local/no-packet.json"],
      ["--apply", "--action", "prepare", "--config", ".local/no-packet.json"],
      ["--hosted", "--apply"],
    ])
      expect((await privateWorkflowMain(argv)).status).toBe("refused");
    vi.stubEnv("APP_ENV", "production");
    try {
      expect(
        (
          await privateWorkflowMain([
            "--test",
            "--apply",
            "--config",
            ".local/no-packet.json",
          ])
        ).status,
      ).toBe("refused");
    } finally {
      vi.stubEnv("APP_ENV", "test");
    }
    expect(await domainCounts()).toEqual(before);
  });

  it("rejects runtime-role connections and mismatched actual target binding", async () => {
    const value = await packet();
    await expect(
      run(value, { action: "prepare" }, world.runtime.pool),
    ).rejects.toBeInstanceOf(PrivateWorkflowOperatorError);
    if (expected.database.mode !== "local-test") throw new Error();
    const binding = {
      origin: expected.origin,
      database: {
        ...expected.database,
        port:
          expected.database.port === 65535 ? 65534 : expected.database.port + 1,
      },
    };
    const wrong = parsePrivateWorkflow(
      { ...value, database: binding.database },
      binding,
    );
    await expect(
      run(wrong, { action: "prepare" }, world.owner.pool, binding),
    ).rejects.toBeInstanceOf(PrivateWorkflowOperatorError);
    expect(
      (
        await world.owner.pool.query(
          "SELECT id FROM booking_workflow_policies WHERE id=$1",
          [value.booking.policyId],
        )
      ).rows,
    ).toEqual([]);
  });

  it("rejects unlisted, missing, non-admin, inactive and unverified reviewer identities without provisioning them", async () => {
    const value = await packet({
      accountEmails: [reviewer, nonadmin, unassured]
        .map((a) => a.email)
        .concat("missing@learli.test"),
    });
    for (const email of [unlisted.email, "missing@learli.test", nonadmin.email])
      await expect(
        run(value, { action: "prepare", reviewerEmail: email }),
      ).rejects.toBeInstanceOf(PrivateWorkflowOperatorError);
    await world.owner.pool.query(
      "UPDATE user_access SET status='suspended' WHERE user_id=$1",
      [unassured.id],
    );
    try {
      await expect(prepare(value, unassured)).rejects.toBeInstanceOf(
        PrivateWorkflowOperatorError,
      );
    } finally {
      await world.owner.pool.query(
        "UPDATE user_access SET status='active' WHERE user_id=$1",
        [unassured.id],
      );
    }
    await world.owner.pool.query(
      'UPDATE "user" SET email_verified=false WHERE id=$1',
      [unassured.id],
    );
    try {
      await expect(prepare(value, unassured)).rejects.toBeInstanceOf(
        PrivateWorkflowOperatorError,
      );
    } finally {
      await world.owner.pool.query(
        'UPDATE "user" SET email_verified=true WHERE id=$1',
        [unassured.id],
      );
    }
    expect(
      (
        await world.owner.pool.query(
          "SELECT id FROM booking_workflow_policies WHERE id=$1",
          [value.booking.policyId],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await world.owner.pool.query('SELECT id FROM "user" WHERE email=$1', [
          "missing@learli.test",
        ])
      ).rows,
    ).toEqual([]);
  });

  it("rolls back all metadata on conflicting immutable content or a different canonical admission identity", async () => {
    const original = await packet();
    await prepare(original);
    const conflicting = await packet({
      screening: {
        ...original.screening,
        authorityReference: `synthetic:${randomUUID()}`,
      },
    });
    await expect(prepare(conflicting)).rejects.toBeInstanceOf(
      PrivateWorkflowOperatorError,
    );
    expect(
      (
        await world.owner.pool.query(
          "SELECT id FROM booking_workflow_policies WHERE id=$1",
          [conflicting.booking.policyId],
        )
      ).rows,
    ).toEqual([]);
    const admission = syntheticAdmissionPolicy(randomUUID()),
      foreignBooking = {
        ...original.booking,
        policyId: randomUUID(),
        admissionPolicyId: admission.policyId,
      };
    foreignBooking.contentDigest = bookingPolicyDigest(foreignBooking);
    const foreign = await packet({ admission, booking: foreignBooking });
    await expect(prepare(foreign)).rejects.toBeInstanceOf(
      PrivateWorkflowOperatorError,
    );
    expect(
      (
        await world.owner.pool.query(
          "SELECT id FROM learner_admission_policies WHERE id=$1",
          [admission.policyId],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await world.owner.pool.query(
          "SELECT version FROM tutor_screening_policies WHERE version=$1",
          [foreign.screening.version],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await world.owner.pool.query(
          "SELECT policy_id FROM booking_workflow_policy_head WHERE source='synthetic_readiness'",
        )
      ).rows[0].policy_id,
    ).toBe(original.booking.policyId);
  });

  it("assigns only explicit pending admissions, retries without duplicate assignment events, and creates no guardian authority", async () => {
    const value = await packet();
    await prepare(value);
    await prepare(value, unassured);
    const admission = await pending(value),
      command = {
        action: "assign-admission",
        admissionId: admission.id,
        reviewerEmail: unassured.email,
      };
    await run(value, command);
    await run(value, command);
    const state = await world.owner.pool.query(
      `SELECT a.state,l.status,x.revision,
        (SELECT count(*)::int FROM learner_admission_events WHERE admission_id=a.id AND event='assigned') AS events,
        (SELECT count(*)::int FROM guardian_learner_links WHERE learner_id=l.id) AS links,
        (SELECT count(*)::int FROM learner_admission_evidence WHERE admission_id=a.id) AS evidence
       FROM learner_admissions a JOIN learner_profiles l ON l.id=a.learner_id
       JOIN learner_admission_assignments x ON x.admission_id=a.id WHERE a.id=$1`,
      [admission.id],
    );
    expect(state.rows[0]).toEqual({
      state: "pending",
      status: "inactive",
      revision: 0,
      events: 1,
      links: 0,
      evidence: 0,
    });
    await expect(
      readAssignedAdmission(
        { runtime: world.runtime, admission: value.admission },
        unassured.headers,
        admission.id,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await run(value, {
      action: "assign-admission",
      admissionId: admission.id,
    });
    const reassigned = await world.owner.pool.query(
      `SELECT x.revision,
        (SELECT count(*)::int FROM learner_admission_events WHERE admission_id=x.admission_id AND event='assigned') AS events
       FROM learner_admission_assignments x WHERE x.admission_id=$1`,
      [admission.id],
    );
    expect(reassigned.rows[0]).toEqual({ revision: 1, events: 2 });
    const self = await pending(value, reviewer);
    await expect(
      run(value, { action: "assign-admission", admissionId: self.id }),
    ).rejects.toBeInstanceOf(PrivateWorkflowOperatorError);
    const changed = parsePrivateWorkflow(
      {
        ...value,
        screening: {
          ...value.screening,
          requiredCheckCodes: ["changed_receipt"],
        },
      },
      expected,
    );
    await expect(run(changed, command)).rejects.toBeInstanceOf(
      PrivateWorkflowOperatorError,
    );
  });

  it("assigns a pending Tutor with staff and one assignment event, rejects self-review and out-of-packet expiry, and leaves screening unapproved", async () => {
    const value = await packet();
    await prepare(value);
    const context = { runtime: world.runtime, screening: value.screening };
    await requestScreening(context, tutor.headers, tutorProfile.id, {
      requestKey: randomUUID(),
    });
    await requestScreening(context, reviewer.headers, reviewerProfile.id, {
      requestKey: randomUUID(),
    });
    const command = {
      action: "assign-screening",
      tutorId: tutorProfile.id,
      validUntil: deadline(),
    };
    for (const validUntil of [
      new Date(Date.now() - 1000).toISOString(),
      new Date(Date.parse(value.screening.validUntil) + 1).toISOString(),
    ])
      await expect(
        run(value, { ...command, validUntil }),
      ).rejects.toBeInstanceOf(PrivateWorkflowOperatorError);
    await expect(
      run(value, { ...command, tutorId: reviewerProfile.id }),
    ).rejects.toBeInstanceOf(PrivateWorkflowOperatorError);
    await run(value, command);
    await run(value, command);
    const state = await world.owner.pool.query(
      `SELECT c.state,t.review_status,a.assignment_revision,
       (SELECT count(*)::int FROM tutor_screening_events WHERE tutor_id=t.id AND kind='assignment') AS events,
       (SELECT count(*)::int FROM tutor_screening_checks WHERE tutor_id=t.id) AS checks,
       (SELECT count(*)::int FROM tutor_screening_decisions WHERE tutor_id=t.id) AS decisions,
       s.valid_until=$2::timestamptz AS bounded
       FROM tutor_profiles t JOIN tutor_screening_cases c ON c.tutor_id=t.id
       JOIN tutor_screening_assignments a ON a.tutor_id=t.id
       JOIN tutor_screening_staff s ON s.user_id=a.reviewer_user_id AND s.provenance=a.provenance WHERE t.id=$1`,
      [tutorProfile.id, command.validUntil],
    );
    expect(state.rows[0]).toEqual({
      state: "pending",
      review_status: "pending",
      assignment_revision: 0,
      events: 1,
      checks: 0,
      decisions: 0,
      bounded: true,
    });
    await world.owner.pool.query(
      "UPDATE tutor_screening_policy_heads SET status='revoked' WHERE provenance='synthetic_readiness'",
    );
    await expect(run(value, command)).rejects.toBeInstanceOf(
      PrivateWorkflowOperatorError,
    );
  });

  it("grants only exact expiring confirmation metadata for a real provisional reservation without confirming it or creating outcomes", async () => {
    // Evidence and approvals here are explicit existing domain-fixture setup, never operator behavior.
    const fixture = await workflowFixture(world, reviewer, "guardian", "tutor");
    const value = await packet({
      admission: fixture.admission,
      screening: fixture.policy,
      booking: fixture.booking,
      accountEmails: [reviewer, fixture.requester, fixture.tutor].map(
        (a) => a.email,
      ),
    });
    await prepare(value);
    const slots = await readWorkflowCandidates(
        fixture.context,
        fixture.requester.headers,
        fixture.choice,
      ),
      slot = slots[6];
    if (!slot) throw new Error("Required actual candidate unavailable.");
    const booking = await createPolicyReservation(
      fixture.context,
      fixture.requester.headers,
      {
        ...fixture.choice,
        startAtUtc: slot.startAtUtc,
        endAtUtc: slot.endAtUtc,
        idempotencyKey: randomUUID(),
      },
    );
    const command = {
      action: "grant-confirmation",
      bookingId: booking.id,
      validUntil: deadline(),
    };
    await expect(
      run(value, {
        ...command,
        validUntil: new Date(
          Date.parse(value.screening.validUntil) + 1,
        ).toISOString(),
      }),
    ).rejects.toBeInstanceOf(PrivateWorkflowOperatorError);
    for (const actor of [fixture.requester, fixture.tutor]) {
      await world.owner.pool.query(
        "INSERT INTO user_roles(user_id,role) VALUES($1,'admin') ON CONFLICT DO NOTHING",
        [actor.id],
      );
      await expect(
        run(value, { ...command, reviewerEmail: actor.email }),
      ).rejects.toBeInstanceOf(PrivateWorkflowOperatorError);
    }
    const omittedTutor = parsePrivateWorkflow(
      {
        ...value,
        accountEmails: value.accountEmails.filter(
          (email) => email !== fixture.tutor.email,
        ),
      },
      expected,
    );
    const differentScreening = parsePrivateWorkflow(
      {
        ...value,
        screening: {
          ...value.screening,
          version: `${value.screening.version}-other`,
        },
      },
      expected,
    );
    for (const denied of [omittedTutor, differentScreening])
      await expect(run(denied, command)).rejects.toBeInstanceOf(
        PrivateWorkflowOperatorError,
      );
    expect(
      (
        await world.owner.pool.query(
          "SELECT count(*)::int n FROM booking_workflow_grants WHERE logical_booking_id=$1",
          [booking.logicalBookingId],
        )
      ).rows[0].n,
    ).toBe(0);
    const before = await domainCounts();
    await run(value, command);
    await run(value, command);
    expect(await domainCounts()).toEqual(before);
    const rows = await world.owner.pool.query(
      "SELECT actor_user_id,action,active,valid_until=$2::timestamptz AS bounded FROM booking_workflow_grants WHERE logical_booking_id=$1",
      [booking.logicalBookingId, command.validUntil],
    );
    expect(rows.rows).toEqual([
      {
        actor_user_id: reviewer.id,
        action: "confirm",
        active: true,
        bounded: true,
      },
    ]);
    expect(
      (
        await world.owner.pool.query(
          "SELECT state,workflow_revision FROM bookings WHERE id=$1",
          [booking.id],
        )
      ).rows[0],
    ).toEqual({ state: "provisional", workflow_revision: 0 });
    expect(
      (await readWorkflowTask(fixture.context, reviewer.headers, booking.id))
        .actions,
    ).toEqual(["confirm"]);
    await world.owner.pool.query(
      "UPDATE booking_workflow_policy_head SET enabled=false WHERE source='synthetic_readiness'",
    );
    await expect(run(value, command)).rejects.toBeInstanceOf(
      PrivateWorkflowOperatorError,
    );
  }, 60000);
});

async function whileOperatorWaits(
  value: PrivateWorkflowPacket,
  command: Record<string, unknown>,
  lock: (client: PoolClient) => Promise<unknown>,
  change: (client: PoolClient) => Promise<unknown>,
) {
  const blocker = await world.owner.pool.connect();
  const waiting = await world.owner.pool.connect();
  let outcome: Promise<{ result?: unknown; error?: unknown }> | undefined;
  try {
    const pid = (
      await waiting.query<{ pid: number }>("SELECT pg_backend_pid() pid")
    ).rows[0].pid;
    await blocker.query("BEGIN");
    await lock(blocker);
    outcome = runPrivateWorkflowOperation(waiting, value, expected, {
      apply: true,
      reviewerEmail: reviewer.email,
      newOnly: true,
      ...command,
    }).then(
      (result) => ({ result }),
      (error: unknown) => ({ error }),
    );
    await expect
      .poll(
        async () =>
          (
            await world.owner.pool.query<{ waiting: boolean }>(
              "SELECT wait_event_type='Lock' AS waiting FROM pg_stat_activity WHERE pid=$1",
              [pid],
            )
          ).rows[0]?.waiting,
        { timeout: 3000 },
      )
      .toBe(true);
    await change(blocker);
    await blocker.query("COMMIT");
    expect((await outcome).error).toBeInstanceOf(PrivateWorkflowOperatorError);
  } finally {
    await blocker.query("ROLLBACK").catch(() => undefined);
    await outcome;
    waiting.release();
    blocker.release();
  }
}

async function dispatchFixture() {
  const actor = await createAccount(world);
  const teacher = await createAccount(world, ["tutor"]);
  const teacherProfile = await profile(teacher);
  const value = await packet({
    accountEmails: [reviewer.email, actor.email, teacher.email],
  });
  await prepare(value);
  const admission = await pending(value, actor);
  await requestScreening(
    { runtime: world.runtime, screening: value.screening },
    teacher.headers,
    teacherProfile.id,
    { requestKey: randomUUID() },
  );
  return { value, admission, teacherProfile };
}

async function confirmationFixture(remainingHoldMilliseconds?: number) {
  const fixture = await workflowFixture(world, reviewer, "guardian", "tutor");
  const value = await packet({
    admission: fixture.admission,
    screening: fixture.policy,
    booking: fixture.booking,
    accountEmails: [reviewer, unassured, fixture.requester, fixture.tutor].map(
      (actor) => actor.email,
    ),
  });
  await prepare(value);
  const slots = await readWorkflowCandidates(
    fixture.context,
    fixture.requester.headers,
    fixture.choice,
  );
  const slot = slots[8];
  if (!slot) throw new Error("Required actual candidate unavailable.");
  // Owner test fixtures may start near the end of their original approved
  // ten-minute hold. Insert that history once; immutable booking timestamps
  // must never be rewritten just to accelerate a lock/expiry regression.
  const expires = new Date(Date.now() + (remainingHoldMilliseconds ?? 0));
  const booking =
    remainingHoldMilliseconds === undefined
      ? await createPolicyReservation(
          fixture.context,
          fixture.requester.headers,
          {
            ...fixture.choice,
            startAtUtc: slot.startAtUtc,
            endAtUtc: slot.endAtUtc,
            idempotencyKey: randomUUID(),
          },
        )
      : await historicalWorkflowBooking(world, fixture, reviewer, {
          state: "provisional",
          start: new Date(slot.startAtUtc),
          end: new Date(slot.endAtUtc),
          expires,
          created: new Date(
            expires.getTime() - value.booking.provisionalMinutes * 60000,
          ),
        });
  return { fixture, value, booking };
}

describe("bounded manual dispatch and locked new-only metadata", () => {
  it("discovers finite actual pending admission/screening metadata once, prepares it and repeats without authority/outcome changes", async () => {
    const { value, admission, teacherProfile } = await dispatchFixture();
    const before = await domainCounts();
    const client = await world.owner.pool.connect();
    const record = vi.fn();
    try {
      expect(
        await dispatchManualPreview(client, value, expected, reviewer.email, {
          assertCurrent: () => {},
          record,
        }),
      ).toMatchObject({
        status: "applied",
        discovered: 2,
        applied: 2,
        admissions: 1,
        screenings: 1,
        confirmations: 0,
      });
      expect(await domainCounts()).toEqual(before);
      const metadata = await world.owner.pool.query(
        `SELECT
          (SELECT reviewer_user_id FROM learner_admission_assignments WHERE admission_id=$1) AS admission,
          (SELECT reviewer_user_id FROM tutor_screening_assignments WHERE tutor_id=$2) AS screening`,
        [admission.id, teacherProfile.id],
      );
      expect(metadata.rows[0]).toEqual({
        admission: reviewer.id,
        screening: reviewer.id,
      });
      expect(
        await dispatchManualPreview(client, value, expected, reviewer.email, {
          assertCurrent: () => {},
          record,
        }),
      ).toMatchObject({ status: "applied", discovered: 0, applied: 0 });
      expect(await domainCounts()).toEqual(before);
      await world.owner.pool.query(
        "UPDATE booking_workflow_policy_head SET enabled=false WHERE source='synthetic_readiness'",
      );
      expect(
        await dispatchManualPreview(client, value, expected, reviewer.email, {
          assertCurrent: () => {},
          record,
        }),
      ).toMatchObject({ status: "refused", applied: 0 });
    } finally {
      client.release();
    }
  }, 60000);

  it("refuses the complete snapshot when one pending task belongs to another reviewer", async () => {
    const { value, admission, teacherProfile } = await dispatchFixture();
    const expanded = parsePrivateWorkflow(
      { ...value, accountEmails: [...value.accountEmails, unassured.email] },
      expected,
    );
    await prepare(expanded, unassured);
    await run(expanded, {
      action: "assign-admission",
      admissionId: admission.id,
      reviewerEmail: unassured.email,
    });
    const before = await domainCounts();
    const client = await world.owner.pool.connect();
    try {
      expect(
        await dispatchManualPreview(
          client,
          expanded,
          expected,
          reviewer.email,
          { assertCurrent: () => {}, record: vi.fn() },
        ),
      ).toMatchObject({ status: "refused", applied: 0 });
      expect(
        (
          await client.query(
            "SELECT tutor_id FROM tutor_screening_assignments WHERE tutor_id=$1",
            [teacherProfile.id],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await client.query(
            "SELECT reviewer_user_id FROM learner_admission_assignments WHERE admission_id=$1",
            [admission.id],
          )
        ).rows[0].reviewer_user_id,
      ).toBe(unassured.id);
      expect(await domainCounts()).toEqual(before);
    } finally {
      client.release();
    }
  }, 60000);

  it.each(["inactive", "missing"])(
    "refuses pending admission work with %s reviewer capability without reviving it",
    async (mode) => {
      const actor = await createAccount(world);
      const admin = await createAccount(world, ["admin"]);
      const value = await packet({ accountEmails: [admin.email, actor.email] });
      await prepare(value, admin);
      const admission = await pending(value, actor);
      if (mode === "inactive") {
        await run(value, {
          action: "assign-admission",
          admissionId: admission.id,
          reviewerEmail: admin.email,
        });
        await world.owner.pool.query(
          "UPDATE learner_admission_reviewers SET active=false WHERE user_id=$1 AND source='synthetic_readiness' AND capability_code='learner_admission_review'",
          [admin.id],
        );
      } else
        await world.owner.pool.query(
          "DELETE FROM learner_admission_reviewers WHERE user_id=$1 AND source='synthetic_readiness' AND capability_code='learner_admission_review'",
          [admin.id],
        );
      await expect(
        readAssignedAdmission(
          { runtime: world.runtime, admission: value.admission },
          admin.headers,
          admission.id,
        ),
      ).rejects.toMatchObject({ status: 404 });
      const before = await domainCounts();
      const client = await world.owner.pool.connect();
      const record = vi.fn();
      try {
        expect(
          await dispatchManualPreview(client, value, expected, admin.email, {
            assertCurrent: () => {},
            record,
          }),
        ).toMatchObject({
          status: "refused",
          attempted: 0,
          applied: 0,
        });
        expect(record).not.toHaveBeenCalled();
        expect(await domainCounts()).toEqual(before);
        expect(
          (
            await client.query(
              "SELECT active FROM learner_admission_reviewers WHERE user_id=$1 AND source='synthetic_readiness' AND capability_code='learner_admission_review'",
              [admin.id],
            )
          ).rows,
        ).toEqual(mode === "inactive" ? [{ active: false }] : []);
        expect(
          (
            await client.query(
              "SELECT reviewer_user_id FROM learner_admission_assignments WHERE admission_id=$1",
              [admission.id],
            )
          ).rows,
        ).toEqual(mode === "inactive" ? [{ reviewer_user_id: admin.id }] : []);
      } finally {
        client.release();
      }
    },
    60000,
  );

  it("rechecks a foreign admission assignment after a real lock wait, while retaining deliberate exact-ID reassignment", async () => {
    const actor = await createAccount(world);
    const value = await packet({
      accountEmails: [reviewer.email, unassured.email, actor.email],
    });
    await prepare(value);
    await prepare(value, unassured);
    const admission = await pending(value, actor);
    await run(value, { action: "assign-admission", admissionId: admission.id });
    await whileOperatorWaits(
      value,
      { action: "assign-admission", admissionId: admission.id },
      (client) =>
        client.query("SELECT public.lock_learner_admission($1,NULL,$2::uuid)", [
          reviewer.id,
          admission.id,
        ]),
      (client) =>
        client.query(
          "UPDATE learner_admission_assignments SET reviewer_user_id=$2 WHERE admission_id=$1",
          [admission.id, unassured.id],
        ),
    );
    expect(
      (
        await world.owner.pool.query(
          "SELECT reviewer_user_id FROM learner_admission_assignments WHERE admission_id=$1",
          [admission.id],
        )
      ).rows[0].reviewer_user_id,
    ).toBe(unassured.id);
    await run(value, { action: "assign-admission", admissionId: admission.id });
    expect(
      (
        await world.owner.pool.query(
          "SELECT reviewer_user_id FROM learner_admission_assignments WHERE admission_id=$1",
          [admission.id],
        )
      ).rows[0].reviewer_user_id,
    ).toBe(reviewer.id);
  }, 60000);

  it.each(["revoked", "foreign", "expired-staff"])(
    "does not revive %s screening authority after a real Tutor lock wait",
    async (mode) => {
      const { value, teacherProfile } = await dispatchFixture();
      const expanded = parsePrivateWorkflow(
        { ...value, accountEmails: [...value.accountEmails, unassured.email] },
        expected,
      );
      await prepare(expanded, unassured);
      const command = {
        action: "assign-screening",
        tutorId: teacherProfile.id,
        validUntil: deadline(),
      };
      await run(expanded, command);
      await whileOperatorWaits(
        expanded,
        command,
        (client) =>
          client.query("SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE", [
            teacherProfile.id,
          ]),
        (client) =>
          mode === "revoked"
            ? client.query(
                "UPDATE tutor_screening_assignments SET status='revoked' WHERE tutor_id=$1",
                [teacherProfile.id],
              )
            : mode === "foreign"
              ? client.query(
                  "UPDATE tutor_screening_assignments SET reviewer_user_id=$2 WHERE tutor_id=$1",
                  [teacherProfile.id, unassured.id],
                )
              : client.query(
                  "UPDATE tutor_screening_staff SET valid_until=clock_timestamp()-interval '1 second' WHERE user_id=$1 AND provenance='synthetic_readiness'",
                  [reviewer.id],
                ),
      );
      const saved = (
        await world.owner.pool.query(
          `SELECT a.status,a.reviewer_user_id,st.valid_until>clock_timestamp() AS current
       FROM tutor_screening_assignments a JOIN tutor_screening_staff st
         ON st.user_id=$2 AND st.provenance=a.provenance WHERE a.tutor_id=$1`,
          [teacherProfile.id, reviewer.id],
        )
      ).rows[0];
      if (mode === "revoked") expect(saved.status).toBe("revoked");
      if (mode === "foreign") expect(saved.reviewer_user_id).toBe(unassured.id);
      if (mode === "expired-staff") expect(saved.current).toBe(false);
    },
    60000,
  );

  it("discovers an actual provisional booking and grants metadata without confirming or creating outcomes", async () => {
    const { value, booking } = await confirmationFixture();
    const before = await domainCounts();
    const client = await world.owner.pool.connect();
    try {
      expect(
        await dispatchManualPreview(client, value, expected, reviewer.email, {
          assertCurrent: () => {},
          record: vi.fn(),
        }),
      ).toMatchObject({
        status: "applied",
        discovered: 1,
        applied: 1,
        confirmations: 1,
      });
      expect(
        await dispatchManualPreview(client, value, expected, reviewer.email, {
          assertCurrent: () => {},
          record: vi.fn(),
        }),
      ).toMatchObject({
        status: "applied",
        discovered: 0,
        applied: 0,
      });
      expect(await domainCounts()).toEqual(before);
      expect(
        (
          await client.query("SELECT state FROM bookings WHERE id=$1", [
            booking.id,
          ])
        ).rows[0].state,
      ).toBe("provisional");
    } finally {
      client.release();
    }
  }, 60000);

  it("grants only new exact confirmation work and does not extend an existing still-current grant", async () => {
    const { value, booking } = await confirmationFixture();
    const command = {
      action: "grant-confirmation",
      bookingId: booking.id,
      validUntil: deadline(),
      newOnly: true,
    };
    const before = await domainCounts();
    expect(await run(value, command)).toMatchObject({ confirmationGrants: 1 });
    expect(
      await run(value, { ...command, validUntil: value.screening.validUntil }),
    ).toMatchObject({ confirmationGrants: 0 });
    expect(
      (
        await world.owner.pool.query(
          "SELECT valid_until=$2::timestamptz AS same FROM booking_workflow_grants WHERE logical_booking_id=$1",
          [booking.logicalBookingId, command.validUntil],
        )
      ).rows[0].same,
    ).toBe(true);
    expect(await domainCounts()).toEqual(before);
  }, 60000);

  it.each(["inactive", "expired", "foreign"])(
    "does not revive an %s confirmation grant after a real Tutor lock wait",
    async (mode) => {
      const { value, booking, fixture } = await confirmationFixture();
      const command = {
        action: "grant-confirmation",
        bookingId: booking.id,
        validUntil: deadline(),
      };
      await run(value, command);
      await whileOperatorWaits(
        value,
        command,
        (client) =>
          client.query("SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE", [
            fixture.profile.id,
          ]),
        (client) =>
          mode === "inactive"
            ? client.query(
                "UPDATE booking_workflow_grants SET active=false WHERE logical_booking_id=$1",
                [booking.logicalBookingId],
              )
            : mode === "expired"
              ? client.query(
                  "UPDATE booking_workflow_grants SET valid_until=clock_timestamp()-interval '1 second' WHERE logical_booking_id=$1",
                  [booking.logicalBookingId],
                )
              : client.query(
                  "UPDATE booking_workflow_grants SET actor_user_id=$2 WHERE logical_booking_id=$1",
                  [booking.logicalBookingId, unassured.id],
                ),
      );
      const saved = (
        await world.owner.pool.query(
          "SELECT actor_user_id,active,valid_until>clock_timestamp() AS current FROM booking_workflow_grants WHERE logical_booking_id=$1",
          [booking.logicalBookingId],
        )
      ).rows[0];
      if (mode === "inactive") expect(saved.active).toBe(false);
      if (mode === "expired") expect(saved.current).toBe(false);
      if (mode === "foreign") expect(saved.actor_user_id).toBe(unassured.id);
      expect(
        (
          await world.owner.pool.query(
            "SELECT state FROM bookings WHERE id=$1",
            [booking.id],
          )
        ).rows[0].state,
      ).toBe("provisional");
    },
    60000,
  );

  it("refuses a provisional deadline crossed during a later confirmation-grant row wait", async () => {
    const { value, booking } = await confirmationFixture(3000);
    const command = {
      action: "grant-confirmation",
      bookingId: booking.id,
      validUntil: deadline(),
    };
    await run(value, command);
    expect(
      (
        await world.owner.pool.query(
          "SELECT expires_at-created_at=interval '10 minutes' AS approved_hold FROM bookings WHERE id=$1",
          [booking.id],
        )
      ).rows[0].approved_hold,
    ).toBe(true);
    await whileOperatorWaits(
      value,
      command,
      (client) =>
        client.query(
          "SELECT logical_booking_id FROM booking_workflow_grants WHERE logical_booking_id=$1 FOR UPDATE",
          [booking.logicalBookingId],
        ),
      async () => {
        await expect
          .poll(
            async () =>
              (
                await world.owner.pool.query<{ expired: boolean }>(
                  "SELECT expires_at<=clock_timestamp() AS expired FROM bookings WHERE id=$1",
                  [booking.id],
                )
              ).rows[0].expired,
            { timeout: 4000 },
          )
          .toBe(true);
      },
    );
    expect(
      (
        await world.owner.pool.query(
          "SELECT valid_until=$2::timestamptz AS same FROM booking_workflow_grants WHERE logical_booking_id=$1",
          [booking.logicalBookingId, command.validUntil],
        )
      ).rows[0].same,
    ).toBe(true);
    expect(
      (
        await world.owner.pool.query("SELECT state FROM bookings WHERE id=$1", [
          booking.id,
        ])
      ).rows[0].state,
    ).toBe("provisional");
  }, 60000);

  it("rolls back a prepared assignment if the admitted packet changes before commit", async () => {
    const actor = await createAccount(world);
    const value = await packet({
      accountEmails: [reviewer.email, actor.email],
    });
    await prepare(value);
    const admission = await pending(value, actor);
    const client = await world.owner.pool.connect();
    try {
      await expect(
        runPrivateWorkflowOperation(
          client,
          value,
          expected,
          {
            apply: true,
            reviewerEmail: reviewer.email,
            action: "assign-admission",
            admissionId: admission.id,
            newOnly: true,
          },
          () => {
            throw new Error("Packet replaced while waiting.");
          },
        ),
      ).rejects.toBeInstanceOf(PrivateWorkflowOperatorError);
      expect(
        (
          await client.query(
            "SELECT admission_id FROM learner_admission_assignments WHERE admission_id=$1",
            [admission.id],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await client.query(
            "SELECT id FROM learner_admission_events WHERE admission_id=$1 AND event='assigned'",
            [admission.id],
          )
        ).rows,
      ).toEqual([]);
    } finally {
      client.release();
    }
  }, 60000);
});

describe("explicit private account metadata preparation", () => {
  it("grants one exact fictional target idempotently without changing domain state", async () => {
    const target = await createAccount(world, ["student"]);
    const base = await packet();
    const value = await packet({
      accountEmails: [...base.accountEmails, target.email],
    });
    await prepare(value);
    const before = await domainCounts();
    const beforeAccess = (
      await world.owner.pool.query(
        "SELECT status FROM user_access WHERE user_id=$1",
        [target.id],
      )
    ).rows;
    const command = { action: "grant-account", targetId: target.id };
    expect(await run(value, command)).toMatchObject({
      action: "grant-account",
      status: "applied",
      accountGrants: 1,
      assignments: 0,
      confirmationGrants: 0,
    });
    await run(value, command);
    expect(await domainCounts()).toEqual(before);
    expect(
      (
        await world.owner.pool.query(
          "SELECT status FROM user_access WHERE user_id=$1",
          [target.id],
        )
      ).rows,
    ).toEqual(beforeAccess);
    const metadata = (
      await world.owner.pool.query(
        `SELECT t.source,t.revision,g.status,g.source AS grant_source,
         (SELECT count(*)::int FROM account_restriction_grant_events e
           WHERE e.staff_user_id=g.staff_user_id AND e.target_user_id=t.user_id) AS events
         FROM account_restriction_targets t JOIN account_restriction_grants g
           ON g.target_user_id=t.user_id WHERE t.user_id=$1 AND g.staff_user_id=$2`,
        [target.id, reviewer.id],
      )
    ).rows;
    expect(metadata).toEqual([
      {
        source: "local_fixture",
        revision: 0,
        status: "authorized",
        grant_source: "local_fixture",
        events: 1,
      },
    ]);
  });

  it("refuses ineligible, self, Admin and out-of-packet targets without provisioning", async () => {
    const outside = await createAccount(world, ["parent"]);
    const value = await packet();
    await prepare(value);
    for (const targetId of [
      outside.id,
      reviewer.id,
      unassured.id,
      "missing-fictional-account",
    ]) {
      await expect(
        run(value, { action: "grant-account", targetId }),
      ).rejects.toBeInstanceOf(PrivateWorkflowOperatorError);
      expect(
        (
          await world.owner.pool.query(
            "SELECT user_id FROM account_restriction_targets WHERE user_id=$1",
            [targetId],
          )
        ).rows,
      ).toEqual([]);
    }
    await expect(
      run(value, {
        action: "grant-account",
        targetId: tutor.id,
        reviewerEmail: nonadmin.email,
      }),
    ).rejects.toBeInstanceOf(PrivateWorkflowOperatorError);
  });

  it("preserves revoked grants and refuses a different target provenance", async () => {
    const revoked = await createAccount(world, ["student"]);
    const otherSource = await createAccount(world, ["parent"]);
    const base = await packet();
    const value = await packet({
      accountEmails: [...base.accountEmails, revoked.email, otherSource.email],
    });
    await prepare(value);
    await run(value, { action: "grant-account", targetId: revoked.id });
    await world.owner.pool.query(
      "UPDATE account_restriction_grants SET status='revoked' WHERE staff_user_id=$1 AND target_user_id=$2",
      [reviewer.id, revoked.id],
    );
    await world.owner.pool.query(
      "INSERT INTO account_restriction_targets(user_id,source) VALUES($1,'synthetic_readiness')",
      [otherSource.id],
    );
    for (const targetId of [revoked.id, otherSource.id])
      await expect(
        run(value, { action: "grant-account", targetId }),
      ).rejects.toBeInstanceOf(PrivateWorkflowOperatorError);
    expect(
      (
        await world.owner.pool.query(
          "SELECT status FROM account_restriction_grants WHERE staff_user_id=$1 AND target_user_id=$2",
          [reviewer.id, revoked.id],
        )
      ).rows[0].status,
    ).toBe("revoked");
    expect(
      (
        await world.owner.pool.query(
          "SELECT staff_user_id FROM account_restriction_grants WHERE target_user_id=$1",
          [otherSource.id],
        )
      ).rows,
    ).toEqual([]);
  });
});
