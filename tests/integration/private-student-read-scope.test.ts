import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { localDatabaseConfig } from "@/lib/db/local-config";
import { parsePrivateWorkflow } from "@/features/private-workflow/config";
import {
  createAdmission,
  mutateAdmissionReview,
  readAssignedAdmission,
} from "@/features/learner-admission/service";
import { readFamilyDashboard } from "@/features/family-dashboard/read";
import {
  listParticipantBookingOverview,
  listParticipantBookings,
  readParticipantBooking,
} from "@/features/bookings/read-service";
import {
  changePolicyBooking,
  createPolicyReservation,
  readWorkflowCandidates,
} from "@/features/booking-workflows/service";
import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { assignAdmissionReviewer } from "../support/learner-admission-fixtures";
import { workflowFixture } from "../support/booking-workflows-fixtures";
import {
  closeWorld,
  createAccount,
  openWorld,
  type TestAccount,
  type World,
} from "./support";

let world: World,
  reviewer: TestAccount,
  fixture: Awaited<ReturnType<typeof workflowFixture>>,
  foreign: TestAccount,
  selfId: string,
  foreignId: string,
  directory: string;
type Booking = Awaited<ReturnType<typeof createPolicyReservation>>;
let childActive: Booking,
  selfActive: Booking,
  childHistory: Booking,
  selfHistory: Booking,
  foreignBooking: Booking;
type Heads = {
  admission: { current_policy_id: string; enabled: boolean } | null;
  booking: { policy_id: string; enabled: boolean } | null;
  screening: { version: string; status: string } | null;
};
let previousHeads: Heads;

/** Both grants come from assigned MFA reviews, with no direct role/profile promotion. */
async function admitSelf(actor: TestAccount, displayName: string) {
  const context = fixture.admissionContext;
  const requested = await createAdmission(context, actor.headers, {
    requestId: randomUUID(),
    management: "self",
    displayName,
    level: "college_support",
    timezone: "Asia/Manila",
    policyVersion: fixture.admission.version,
    policyDigest: fixture.admission.contentDigest,
  });
  await assignAdmissionReviewer(world.owner.pool, requested.id, reviewer.id);
  const current = await readAssignedAdmission(
    context,
    reviewer.headers,
    requested.id,
  );
  const evidence = await mutateAdmissionReview(
    context,
    reviewer.headers,
    requested.id,
    "evidence",
    {
      requestId: randomUUID(),
      revision: current.revision,
      checkCode: "independent_eligibility",
      reference: `synthetic:${randomUUID()}`,
    },
  );
  const authorized = await mutateAdmissionReview(
    context,
    reviewer.headers,
    requested.id,
    "decision",
    {
      requestId: randomUUID(),
      revision: evidence.revision,
      action: "authorize",
    },
  );
  return authorized.learner.id;
}
async function reserve(
  actor: TestAccount,
  learnerId: string,
  cancelled = false,
) {
  const context = bookingWorkflowContext(world.runtime);
  const choice = { ...fixture.choice, learnerId };
  const slot = (
    await readWorkflowCandidates(context, actor.headers, choice)
  )[8];
  if (!slot) throw new Error("Required actual scope-test slot unavailable.");
  const booking = await createPolicyReservation(context, actor.headers, {
    ...choice,
    startAtUtc: slot.startAtUtc,
    endAtUtc: slot.endAtUtc,
    idempotencyKey: randomUUID(),
  });
  return cancelled
    ? changePolicyBooking(context, actor.headers, booking.id, "cancel", {
        requestId: randomUUID(),
        expectedRevision: booking.workflowRevision,
        reasonCode: "synthetic_participant_change",
      })
    : booking;
}

beforeAll(async () => {
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
  world = openWorld();
  previousHeads = (
    await world.owner.pool.query<Heads>(`SELECT
      (SELECT jsonb_build_object('current_policy_id',current_policy_id,'enabled',enabled)
        FROM learner_admission_policy_state WHERE source='synthetic_readiness' AND market_code='synthetic_test') AS admission,
      (SELECT jsonb_build_object('policy_id',policy_id,'enabled',enabled)
        FROM booking_workflow_policy_head WHERE source='synthetic_readiness') AS booking,
      (SELECT jsonb_build_object('version',version,'status',status)
        FROM tutor_screening_policy_heads WHERE provenance='synthetic_readiness') AS screening`)
  ).rows[0];
  reviewer = await createAccount(world, ["admin"], "Fictional scope reviewer");
  fixture = await workflowFixture(world, reviewer, "guardian", "tutor");
  selfId = await admitSelf(
    fixture.requester,
    "Fictional dual-role independent learner",
  );
  foreign = await createAccount(world);
  foreignId = await admitSelf(foreign, "Fictional other independent learner");
  const grants = await world.owner.pool.query<{ role: string }>(
    "SELECT role FROM user_roles WHERE user_id=$1 ORDER BY role",
    [fixture.requester.id],
  );
  expect(grants.rows.map(({ role }) => role)).toEqual(["parent", "student"]);
  const configured = localDatabaseConfig(process.env.DATABASE_URL, true);
  const host = configured.host;
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1")
    throw new Error("Expected owned loopback target.");
  const database = {
    mode: "local-test",
    host,
    port: configured.port,
    database: "learli_test",
    runtimeRole: "learli_app",
  } as const;
  const packet = parsePrivateWorkflow(
    {
      version: 1,
      purpose: "private_fictional_workflow",
      audience: "fictional_only",
      realIntake: "disabled",
      payments: "disabled",
      origin: world.runtime.origin,
      database,
      accountEmails: [reviewer, fixture.requester, fixture.tutor, foreign].map(
        (actor) => actor.email,
      ),
      admission: fixture.admission,
      screening: fixture.policy,
      booking: fixture.booking,
    },
    { origin: world.runtime.origin, database },
  );
  const local = path.join(process.cwd(), ".local");
  mkdirSync(local, { recursive: true, mode: 0o700 });
  directory = mkdtempSync(path.join(local, "private-student-read-scope-"));
  const file = path.join(directory, "packet.json");
  writeFileSync(file, JSON.stringify(packet), { mode: 0o600, flag: "wx" });
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", file);
  childActive = await reserve(fixture.requester, fixture.learner.id);
  selfActive = await reserve(fixture.requester, selfId);
  childHistory = await reserve(fixture.requester, fixture.learner.id, true);
  selfHistory = await reserve(fixture.requester, selfId, true);
  foreignBooking = await reserve(foreign, foreignId);
}, 60_000);
afterAll(async () => {
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
  try {
    if (world && fixture && previousHeads) {
      await world.owner.pool.query(
        "UPDATE booking_workflow_policy_head SET policy_id=$1,enabled=$2 WHERE source='synthetic_readiness' AND policy_id=$3",
        [
          previousHeads.booking?.policy_id ?? fixture.booking.policyId,
          previousHeads.booking?.enabled ?? false,
          fixture.booking.policyId,
        ],
      );
      await world.owner.pool.query(
        "UPDATE tutor_screening_policy_heads SET version=$1,status=$2 WHERE provenance='synthetic_readiness' AND version=$3",
        [
          previousHeads.screening?.version ?? fixture.policy.version,
          previousHeads.screening?.status ?? "revoked",
          fixture.policy.version,
        ],
      );
      await world.owner.pool.query(
        "UPDATE learner_admission_policy_state SET current_policy_id=$1,enabled=$2,revision=revision+1,updated_at=clock_timestamp() WHERE source='synthetic_readiness' AND market_code='synthetic_test' AND current_policy_id=$3",
        [
          previousHeads.admission?.current_policy_id ??
            fixture.admission.policyId,
          previousHeads.admission?.enabled ?? false,
          fixture.admission.policyId,
        ],
      );
    }
  } finally {
    await closeWorld(world);
    if (directory) rmSync(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
  }
});
const ids = (rows: { id: string }[]) => rows.map(({ id }) => id).sort();
function scopes() {
  return [
    {
      scope: "student",
      workspace: "student",
      learner: selfId,
      active: selfActive.id,
      history: selfHistory.id,
    },
    {
      scope: "guardian",
      workspace: "parent",
      learner: fixture.learner.id,
      active: childActive.id,
      history: childHistory.id,
    },
  ] as const;
}

describe("actual private readiness reads separate a dual-role Student and Parent", () => {
  it("keeps each learner-summary selector confined to the selected management", async () => {
    for (const expected of scopes()) {
      const page = await listParticipantBookings(
        world.runtime,
        fixture.requester.headers,
        {
          scope: expected.scope,
        },
      );
      expect(ids(page.learners)).toEqual([expected.learner]);
    }
  });
  it("separates list, active/history and overview projections", async () => {
    for (const expected of scopes()) {
      for (const filter of ["all", "active", "history"] as const) {
        const page = await listParticipantBookings(
          world.runtime,
          fixture.requester.headers,
          {
            scope: expected.scope,
            filter,
          },
        );
        expect(ids(page.items)).toEqual(
          (filter === "all"
            ? [expected.active, expected.history]
            : [filter === "active" ? expected.active : expected.history]
          ).sort(),
        );
      }
      const overview = await listParticipantBookingOverview(
        world.runtime,
        fixture.requester.headers,
        {
          scope: expected.scope,
        },
      );
      expect(ids(overview.active.items)).toEqual([expected.active]);
      expect(ids(overview.history.items)).toEqual([expected.history]);
      expect(ids(overview.active.learners)).toEqual([expected.learner]);
      expect(ids(overview.history.learners)).toEqual([expected.learner]);
    }
  });
  it("keeps each dashboard and its learner options in the selected role view", async () => {
    for (const expected of scopes()) {
      const dashboard = await readFamilyDashboard(
        world.runtime,
        fixture.requester.headers,
        expected.workspace,
        {},
      );
      expect(ids(dashboard.learners)).toEqual([expected.learner]);
      expect(ids(dashboard.active)).toEqual([expected.active]);
      expect(ids(dashboard.history)).toEqual([expected.history]);
    }
    await expect(
      readFamilyDashboard(world.runtime, fixture.requester.headers, "parent", {
        learner: selfId,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("allows correct-scope detail and denies opposite-scope active and history detail", async () => {
    for (const expected of scopes()) {
      for (const bookingId of [expected.active, expected.history]) {
        const correct = await readParticipantBooking(
          world.runtime,
          fixture.requester.headers,
          bookingId,
          expected.scope,
        );
        expect(correct.learner.id).toBe(expected.learner);
        await expect(
          readParticipantBooking(
            world.runtime,
            fixture.requester.headers,
            bookingId,
            expected.scope === "student" ? "guardian" : "student",
          ),
        ).rejects.toMatchObject({ status: 404 });
      }
    }
  });
  it("cannot widen a role view by submitting the other management's learner ID", async () => {
    for (const expected of scopes()) {
      const wrongLearner =
        expected.scope === "student" ? fixture.learner.id : selfId;
      const page = await listParticipantBookings(
        world.runtime,
        fixture.requester.headers,
        {
          scope: expected.scope,
          learnerId: wrongLearner,
        },
      );
      expect(page.items).toEqual([]);
      expect(ids(page.learners)).toEqual([expected.learner]);
      const overview = await listParticipantBookingOverview(
        world.runtime,
        fixture.requester.headers,
        {
          scope: expected.scope,
          learnerId: wrongLearner,
        },
      );
      expect(overview.active.items).toEqual([]);
      expect(overview.history.items).toEqual([]);
      expect(ids(overview.history.learners)).toEqual([expected.learner]);
    }
  });
  it("denies a second allowlisted admitted Student's records through current SQL ownership", async () => {
    const own = await readParticipantBooking(
      world.runtime,
      foreign.headers,
      foreignBooking.id,
      "student",
    );
    expect(own.learner.id).toBe(foreignId);
    await expect(
      readParticipantBooking(
        world.runtime,
        fixture.requester.headers,
        foreignBooking.id,
        "student",
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      readParticipantBooking(
        world.runtime,
        foreign.headers,
        selfActive.id,
        "student",
      ),
    ).rejects.toMatchObject({ status: 404 });
    const page = await listParticipantBookings(world.runtime, foreign.headers, {
      scope: "student",
    });
    expect(ids(page.items)).toEqual([foreignBooking.id]);
    expect(ids(page.learners)).toEqual([foreignId]);
    const dashboard = await readFamilyDashboard(
      world.runtime,
      foreign.headers,
      "student",
      {},
    );
    expect(ids(dashboard.active)).toEqual([foreignBooking.id]);
    expect(ids(dashboard.learners)).toEqual([foreignId]);
  });
  it("preserves assigned Tutor visibility across both management modes with no learner selector", async () => {
    const page = await listParticipantBookings(
      world.runtime,
      fixture.tutor.headers,
      { scope: "tutor" },
    );
    expect(ids(page.items)).toEqual(
      [
        childActive.id,
        selfActive.id,
        childHistory.id,
        selfHistory.id,
        foreignBooking.id,
      ].sort(),
    );
    expect(page.learners).toEqual([]);
  });
});
