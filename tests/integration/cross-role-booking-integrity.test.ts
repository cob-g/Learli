import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  closeWorld,
  createAccount,
  openWorld,
  password,
  type TestAccount,
  type World,
} from "./support";
import {
  admittedFixture,
  workflowFixture,
} from "../support/booking-workflows-fixtures";
import { refreshTestAdmin } from "../support/admin-mfa";
import { assertOwnedReadinessDatabase } from "../support/readiness-placement";
import {
  changePolicyBooking,
  createPolicyReservation,
  readWorkflowCandidates,
} from "@/features/booking-workflows/service";
import type { WorkflowReceipt } from "@/features/booking-workflows/model";
import {
  listParticipantBookings,
  readParticipantBooking,
} from "@/features/bookings/read-service";
import { RuleError } from "@/lib/rule-error";

type PolicyHeads = {
  admission: { current_policy_id: string; enabled: boolean } | null;
  booking: { policy_id: string; enabled: boolean } | null;
  screening: { version: string; status: "enabled" | "revoked" } | null;
};
type Contender = {
  account: TestAccount;
  input: {
    learnerId: string;
    tutorSlug: string;
    subjectSlug: string;
    displayTimezone: string;
    startAtUtc: string;
    endAtUtc: string;
    idempotencyKey: string;
  };
};
type SavedBooking = {
  id: string;
  logical_booking_id: string;
  revision: number;
  workflow_revision: number;
  state: string;
  learner_id: string;
  booked_by_user_id: string;
  tutor_id: string;
  workflow_policy_id: string;
  admission_policy_id: string;
  start_at_utc: Date;
  end_at_utc: Date;
  idempotency_key: string;
};
type SavedEvent = {
  id: string;
  booking_id: string;
  logical_booking_id: string;
  event: string;
  actor_user_id: string;
};
type Notice = { event_id: string; recipient_user_id: string; kind: string };
let world: World,
  fixture: Awaited<ReturnType<typeof workflowFixture>>,
  second: Awaited<ReturnType<typeof admittedFixture>>,
  previousHeads: PolicyHeads | undefined,
  installedHeads: PolicyHeads | undefined;

async function readPolicyHeads(): Promise<PolicyHeads> {
  return (
    await world.owner.pool.query<PolicyHeads>(`SELECT
      (SELECT jsonb_build_object('current_policy_id',current_policy_id,'enabled',enabled)
        FROM learner_admission_policy_state WHERE source='synthetic_readiness' AND market_code='synthetic_test') admission,
      (SELECT jsonb_build_object('policy_id',policy_id,'enabled',enabled)
        FROM booking_workflow_policy_head WHERE source='synthetic_readiness') booking,
      (SELECT jsonb_build_object('version',version,'status',status)
        FROM tutor_screening_policy_heads WHERE provenance='synthetic_readiness') screening`)
  ).rows[0];
}

beforeAll(async () => {
  assertOwnedReadinessDatabase(process.cwd());
  world = openWorld();
  previousHeads = await readPolicyHeads();
  try {
    const reviewer = await createAccount(
      world,
      ["admin"],
      "Fictional cross-role reviewer",
    );
    await refreshTestAdmin(world.runtime, reviewer, password);
    // Both accounts pass actual admission; the Tutor passes actual screening.
    // Only immutable policies and exact reviewer tasks use owner provisioning.
    fixture = await workflowFixture(world, reviewer, "self", "tutor");
    second = await admittedFixture(world, reviewer, "self");
  } finally {
    // Capture partial setup too, so a failing fixture can still restore its
    // metadata. This suite's database execution is serialized by the coordinator.
    installedHeads = await readPolicyHeads();
  }
}, 60_000);

afterAll(async () => {
  try {
    if (!world || !previousHeads || !installedHeads) return;
    const owner = await world.owner.pool.connect();
    try {
      await owner.query("BEGIN");
      // Compare-and-set avoids replacing another operation's later policy head.
      // Previously absent heads remain disabled; retained QA records are never
      // deleted and the admission revision continues to increase monotonically.
      if (installedHeads.booking) {
        const current = installedHeads.booking;
        const prior = previousHeads.booking ?? { ...current, enabled: false };
        const result = await owner.query(
          "UPDATE booking_workflow_policy_head SET policy_id=$1,enabled=$2 WHERE source='synthetic_readiness' AND policy_id=$3 AND enabled=$4",
          [prior.policy_id, prior.enabled, current.policy_id, current.enabled],
        );
        expect(result.rowCount).toBe(1);
      }
      if (installedHeads.screening) {
        const current = installedHeads.screening;
        const prior = previousHeads.screening ?? {
          ...current,
          status: "revoked",
        };
        const result = await owner.query(
          "UPDATE tutor_screening_policy_heads SET version=$1,status=$2 WHERE provenance='synthetic_readiness' AND version=$3 AND status=$4",
          [prior.version, prior.status, current.version, current.status],
        );
        expect(result.rowCount).toBe(1);
      }
      if (installedHeads.admission) {
        const current = installedHeads.admission;
        const prior = previousHeads.admission ?? { ...current, enabled: false };
        const result = await owner.query(
          "UPDATE learner_admission_policy_state SET current_policy_id=$1,enabled=$2,revision=revision+1,updated_at=clock_timestamp() WHERE source='synthetic_readiness' AND market_code='synthetic_test' AND current_policy_id=$3 AND enabled=$4",
          [
            prior.current_policy_id,
            prior.enabled,
            current.current_policy_id,
            current.enabled,
          ],
        );
        expect(result.rowCount).toBe(1);
      }
      await owner.query("COMMIT");
    } catch (error) {
      await owner.query("ROLLBACK");
      throw error;
    } finally {
      owner.release();
    }
  } finally {
    if (world) await closeWorld(world);
  }
});

async function recordedState() {
  const bookings = await world.owner.pool.query<SavedBooking>(
    "SELECT id,logical_booking_id,revision,workflow_revision,state,learner_id,booked_by_user_id,tutor_id,workflow_policy_id,admission_policy_id,start_at_utc,end_at_utc,idempotency_key FROM bookings WHERE tutor_id=$1 ORDER BY id",
    [fixture.profile.id],
  );
  const events = await world.owner.pool.query<SavedEvent>(
    "SELECT e.id,e.booking_id,e.logical_booking_id,e.event,e.actor_user_id FROM booking_lifecycle_events e JOIN bookings b ON b.id=e.booking_id WHERE b.tutor_id=$1 ORDER BY e.id",
    [fixture.profile.id],
  );
  const intents = await world.owner.pool.query<Notice>(
    "SELECT i.event_id,i.recipient_user_id,i.kind FROM booking_workflow_notice_intents i JOIN booking_lifecycle_events e ON e.id=i.event_id JOIN bookings b ON b.id=e.booking_id WHERE b.tutor_id=$1 ORDER BY i.event_id,i.recipient_user_id",
    [fixture.profile.id],
  );
  return {
    bookings: bookings.rows,
    events: events.rows,
    intents: intents.rows,
  };
}

async function activeHeads(start: string, end: string) {
  return (
    await world.owner.pool.query<{ id: string; logical_booking_id: string }>(
      "SELECT id,logical_booking_id FROM bookings WHERE tutor_id=$1 AND start_at_utc<$3::timestamptz AND end_at_utc>$2::timestamptz AND source='synthetic_readiness' AND (state='confirmed' OR (state='provisional' AND expires_at>clock_timestamp())) ORDER BY id",
      [fixture.profile.id, start, end],
    )
  ).rows;
}

async function assertIsolatedRead(
  holder: Contender,
  other: Contender,
  booking: WorkflowReceipt,
) {
  const own = await readParticipantBooking(
    world.runtime,
    holder.account.headers,
    booking.id,
    "student",
  );
  expect(own).toMatchObject({
    id: booking.id,
    logicalBookingId: booking.logicalBookingId,
    state: booking.state,
    learner: { id: holder.input.learnerId, level: "college_support" },
    subject: { slug: holder.input.subjectSlug },
    tutor: { slug: fixture.profile.slug },
    time: {
      startAtUtc: holder.input.startAtUtc,
      endAtUtc: holder.input.endAtUtc,
    },
  });
  await expect(
    readParticipantBooking(
      world.runtime,
      other.account.headers,
      booking.id,
      "student",
    ),
  ).rejects.toMatchObject({ status: 404 });
  // Neither eligible independent Student has guardian authority by implication.
  for (const contender of [holder, other])
    await expect(
      readParticipantBooking(
        world.runtime,
        contender.account.headers,
        booking.id,
        "guardian",
      ),
    ).rejects.toMatchObject({ status: 404 });
}

describe("cross-role booking integrity with distinct eligible College learners", () => {
  it("serializes two actual same-slot contenders, preserves ownership and reopens a cancelled interval", async () => {
    expect(fixture.booking).toMatchObject({
      version: "synthetic-booking-v2",
      completionActor: "assigned_tutor",
      admissionPolicyId: fixture.admission.policyId,
    });
    expect(second.admission.policyId).toBe(fixture.admission.policyId);
    expect(second.requester.id).not.toBe(fixture.requester.id);
    expect(second.learner.id).not.toBe(fixture.learner.id);
    const learners = (
      await world.owner.pool.query<{
        id: string;
        user_id: string;
        management: "self";
        level: "college_support";
        guardians: number;
      }>(
        "SELECT id,user_id,management,level,(SELECT count(*)::int FROM guardian_learner_links g WHERE g.learner_id=l.id) guardians FROM learner_profiles l WHERE id=ANY($1::uuid[]) ORDER BY id",
        [[fixture.learner.id, second.learner.id]],
      )
    ).rows;
    expect(learners).toEqual(
      [
        { id: fixture.learner.id, user_id: fixture.requester.id },
        { id: second.learner.id, user_id: second.requester.id },
      ]
        .map((learner) => ({
          ...learner,
          management: "self",
          level: "college_support",
          guardians: 0,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
    const otherChoice = { ...fixture.choice, learnerId: second.learner.id };
    const [firstSlots, secondSlots] = await Promise.all([
      readWorkflowCandidates(
        fixture.context,
        fixture.requester.headers,
        fixture.choice,
      ),
      readWorkflowCandidates(
        fixture.context,
        second.requester.headers,
        otherChoice,
      ),
    ]);
    const slot = firstSlots.find(
      (candidate) =>
        Date.parse(candidate.startAtUtc) > Date.now() + 4 * 3600000,
    );
    if (!slot)
      throw new Error("Required fresh owned test interval unavailable.");
    expect(secondSlots).toContainEqual(slot);
    const interval = { startAtUtc: slot.startAtUtc, endAtUtc: slot.endAtUtc };
    const contenders: Contender[] = [
      {
        account: fixture.requester,
        input: { ...fixture.choice, ...interval, idempotencyKey: randomUUID() },
      },
      {
        account: second.requester,
        input: { ...otherChoice, ...interval, idempotencyKey: randomUUID() },
      },
    ];
    expect(contenders[0].input.idempotencyKey).not.toBe(
      contenders[1].input.idempotencyKey,
    );
    const blocker = await world.owner.pool.connect();
    let pending: Promise<PromiseSettledResult<WorkflowReceipt>[]> | undefined;
    try {
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() pid")
      ).rows[0].pid;
      const held = await blocker.query(
        "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
        [fixture.profile.id],
      );
      expect(held.rowCount).toBe(1);
      pending = Promise.allSettled(
        contenders.map(({ account, input }) =>
          createPolicyReservation(fixture.context, account.headers, input),
        ),
      );
      // A second waiter can be queued behind the first waiter's tuple lock.
      // Follow PostgreSQL's complete blocking graph back to this exact owner
      // transaction, then require two actual ungranted runtime lock requests.
      await expect
        .poll(
          async () =>
            (
              await world.owner.pool.query<{ waiting: number }>(
                `WITH RECURSIVE blocked(pid) AS (
                  SELECT a.pid FROM pg_stat_activity a
                  WHERE a.datname=current_database() AND a.usename='learli_app'
                    AND $1::int=ANY(pg_blocking_pids(a.pid))
                  UNION
                  SELECT a.pid FROM pg_stat_activity a JOIN blocked b
                    ON b.pid=ANY(pg_blocking_pids(a.pid))
                  WHERE a.datname=current_database() AND a.usename='learli_app'
                )
                SELECT count(DISTINCT a.pid)::int waiting
                FROM blocked b JOIN pg_stat_activity a ON a.pid=b.pid
                JOIN pg_locks l ON l.pid=a.pid AND NOT l.granted
                WHERE a.wait_event_type='Lock' AND a.query LIKE '%tutor_profiles%'
                  AND a.query ILIKE '%for update%'`,
                [blockerPid],
              )
            ).rows[0].waiting,
          { timeout: 5000, interval: 15 },
        )
        .toBe(2);
    } finally {
      try {
        await blocker.query("ROLLBACK");
      } finally {
        blocker.release();
        // Drain both real requests even if lock observation fails, before any
        // metadata restoration or pool shutdown can race an in-flight mutation.
        if (pending) await pending;
      }
    }
    if (!pending) throw new Error("Both actual contenders must be launched.");
    const outcomes = await pending;
    expect(
      outcomes.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const winnerIndex = outcomes.findIndex(
      (result) => result.status === "fulfilled",
    );
    const loserIndex = 1 - winnerIndex;
    const won = outcomes[winnerIndex];
    const lost = outcomes[loserIndex];
    if (won.status !== "fulfilled" || lost.status !== "rejected")
      throw new Error("Expected one actual reservation and one safe conflict.");
    expect(lost.reason).toBeInstanceOf(RuleError);
    expect(lost.reason).toMatchObject({ status: 409 });
    const winner = contenders[winnerIndex],
      loser = contenders[loserIndex],
      receipt = won.value;
    expect(receipt.state).toBe("provisional");
    const initial = await recordedState();
    expect(initial.bookings).toEqual([
      {
        id: receipt.id,
        logical_booking_id: receipt.logicalBookingId,
        revision: 0,
        workflow_revision: 0,
        state: "provisional",
        learner_id: winner.input.learnerId,
        booked_by_user_id: winner.account.id,
        tutor_id: fixture.profile.id,
        workflow_policy_id: fixture.booking.policyId,
        admission_policy_id: fixture.admission.policyId,
        start_at_utc: new Date(slot.startAtUtc),
        end_at_utc: new Date(slot.endAtUtc),
        idempotency_key: winner.input.idempotencyKey,
      },
    ]);
    expect(initial.events).toEqual([
      {
        id: receipt.eventId,
        booking_id: receipt.id,
        logical_booking_id: receipt.logicalBookingId,
        event: "workflow_provisional",
        actor_user_id: winner.account.id,
      },
    ]);
    expect(initial.intents).toEqual(
      [winner.account.id, fixture.tutor.id].sort().map((recipient) => ({
        event_id: receipt.eventId,
        recipient_user_id: recipient,
        kind: "workflow_provisional",
      })),
    );
    expect(await activeHeads(slot.startAtUtc, slot.endAtUtc)).toEqual([
      { id: receipt.id, logical_booking_id: receipt.logicalBookingId },
    ]);
    const replay = await createPolicyReservation(
      fixture.context,
      winner.account.headers,
      winner.input,
    );
    expect(replay).toEqual(receipt);
    expect(await recordedState()).toEqual(initial);
    await assertIsolatedRead(winner, loser, receipt);
    const loserList = await listParticipantBookings(
      world.runtime,
      loser.account.headers,
      { scope: "student", filter: "all" },
    );
    expect(loserList.items).toEqual([]);
    await expect(
      changePolicyBooking(
        fixture.context,
        loser.account.headers,
        receipt.id,
        "cancel",
        {
          requestId: randomUUID(),
          expectedRevision: receipt.workflowRevision,
          reasonCode: "synthetic_participant_change",
        },
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(await recordedState()).toEqual(initial);
    const cancelled = await changePolicyBooking(
      fixture.context,
      winner.account.headers,
      receipt.id,
      "cancel",
      {
        requestId: randomUUID(),
        expectedRevision: receipt.workflowRevision,
        reasonCode: "synthetic_participant_change",
      },
    );
    expect(cancelled.state).toBe("cancelled");
    expect(await activeHeads(slot.startAtUtc, slot.endAtUtc)).toEqual([]);
    expect(
      await readWorkflowCandidates(fixture.context, loser.account.headers, {
        ...fixture.choice,
        learnerId: loser.input.learnerId,
      }),
    ).toContainEqual(slot);
    const replacementInput = { ...loser.input, idempotencyKey: randomUUID() };
    const acquired = await createPolicyReservation(
      fixture.context,
      loser.account.headers,
      replacementInput,
    );
    expect(acquired.state).toBe("provisional");
    expect(acquired.logicalBookingId).not.toBe(receipt.logicalBookingId);
    expect(await activeHeads(slot.startAtUtc, slot.endAtUtc)).toEqual([
      { id: acquired.id, logical_booking_id: acquired.logicalBookingId },
    ]);
    await assertIsolatedRead(loser, winner, acquired);
    await assertIsolatedRead(winner, loser, cancelled);
    const final = await recordedState();
    expect(final.bookings).toHaveLength(2);
    expect(
      final.bookings.find((booking) => booking.id === receipt.id),
    ).toMatchObject({
      state: "cancelled",
      workflow_revision: 1,
      learner_id: winner.input.learnerId,
      booked_by_user_id: winner.account.id,
    });
    expect(
      final.bookings.find((booking) => booking.id === acquired.id),
    ).toMatchObject({
      state: "provisional",
      workflow_revision: 0,
      learner_id: loser.input.learnerId,
      booked_by_user_id: loser.account.id,
      idempotency_key: replacementInput.idempotencyKey,
    });
    expect(final.events).toHaveLength(3);
    expect(final.events).toEqual(
      expect.arrayContaining([
        ...initial.events,
        {
          id: cancelled.eventId,
          booking_id: receipt.id,
          logical_booking_id: receipt.logicalBookingId,
          event: "workflow_cancelled",
          actor_user_id: winner.account.id,
        },
        {
          id: acquired.eventId,
          booking_id: acquired.id,
          logical_booking_id: acquired.logicalBookingId,
          event: "workflow_provisional",
          actor_user_id: loser.account.id,
        },
      ]),
    );
    expect(final.intents).toHaveLength(6);
    expect(final.intents).toEqual(
      expect.arrayContaining([
        ...initial.intents,
        ...[winner.account.id, fixture.tutor.id].map((recipient) => ({
          event_id: cancelled.eventId,
          recipient_user_id: recipient,
          kind: "workflow_cancelled",
        })),
        ...[loser.account.id, fixture.tutor.id].map((recipient) => ({
          event_id: acquired.eventId,
          recipient_user_id: recipient,
          kind: "workflow_provisional",
        })),
      ]),
    );
  }, 30_000);
});
