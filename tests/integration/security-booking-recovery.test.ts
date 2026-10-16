import { randomUUID } from "node:crypto";
import { inspect } from "node:util";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createLocalAuth, type LocalAuthRuntime } from "@/lib/auth-factory";
import { handleBookingRead } from "@/features/bookings/read-handler";
import type { BookingDetail } from "@/features/bookings/read-model";
import { handleWorkflowMutation } from "@/features/booking-workflows/handler";
import type { WorkflowReceipt } from "@/features/booking-workflows/model";
import {
  changePolicyBooking,
  createPolicyReservation,
  readWorkflowCandidates,
} from "@/features/booking-workflows/service";
import {
  grantWorkflowTask,
  workflowFixture,
} from "../support/booking-workflows-fixtures";
import { assertOwnedReadinessDatabase } from "../support/readiness-placement";
import {
  closeWorld,
  createAccount,
  jsonRequest,
  openWorld,
  type TestAccount,
  type World,
} from "./support";

type PolicyHeads = {
  admission: { current_policy_id: string; enabled: boolean } | null;
  booking: { policy_id: string; enabled: boolean } | null;
  screening: { version: string; status: "enabled" | "revoked" } | null;
};
type BookingRecord = {
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
  expires_at: Date;
  idempotency_key: string;
};
type LifecycleRecord = {
  id: string;
  booking_id: string;
  logical_booking_id: string;
  event: string;
  actor_user_id: string;
  created_at: Date;
};
type NoticeRecord = {
  event_id: string;
  recipient_user_id: string;
  kind: string;
};
let world: World,
  fixture: Awaited<ReturnType<typeof workflowFixture>>,
  reviewer: TestAccount,
  foreign: TestAccount,
  previousHeads: PolicyHeads | undefined,
  installedHeads: PolicyHeads | undefined;

async function policyHeads(): Promise<PolicyHeads> {
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
  previousHeads = await policyHeads();
  try {
    reviewer = await createAccount(
      world,
      ["admin"],
      "Fictional recovery reviewer",
    );
    fixture = await workflowFixture(world, reviewer);
    foreign = await createAccount(world, ["parent"], "Fictional other parent");
  } finally {
    installedHeads = await policyHeads();
  }
}, 60_000);

afterAll(async () => {
  try {
    if (!world || !previousHeads || !installedHeads) return;
    const owner = await world.owner.pool.connect();
    try {
      await owner.query("BEGIN");
      // Restore only heads this setup still owns. Retain all synthetic history;
      // never replace a later operation's policy or reset admission revisions.
      if (installedHeads.booking) {
        const current = installedHeads.booking;
        const prior = previousHeads.booking ?? { ...current, enabled: false };
        const restored = await owner.query(
          "UPDATE booking_workflow_policy_head SET policy_id=$1,enabled=$2 WHERE source='synthetic_readiness' AND policy_id=$3 AND enabled=$4",
          [prior.policy_id, prior.enabled, current.policy_id, current.enabled],
        );
        expect(restored.rowCount).toBe(1);
      }
      if (installedHeads.screening) {
        const current = installedHeads.screening;
        const prior = previousHeads.screening ?? {
          ...current,
          status: "revoked",
        };
        const restored = await owner.query(
          "UPDATE tutor_screening_policy_heads SET version=$1,status=$2 WHERE provenance='synthetic_readiness' AND version=$3 AND status=$4",
          [prior.version, prior.status, current.version, current.status],
        );
        expect(restored.rowCount).toBe(1);
      }
      if (installedHeads.admission) {
        const current = installedHeads.admission;
        const prior = previousHeads.admission ?? { ...current, enabled: false };
        const restored = await owner.query(
          "UPDATE learner_admission_policy_state SET current_policy_id=$1,enabled=$2,revision=revision+1,updated_at=clock_timestamp() WHERE source='synthetic_readiness' AND market_code='synthetic_test' AND current_policy_id=$3 AND enabled=$4",
          [
            prior.current_policy_id,
            prior.enabled,
            current.current_policy_id,
            current.enabled,
          ],
        );
        expect(restored.rowCount).toBe(1);
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
  const bookings = await world.owner.pool.query<BookingRecord>(
    "SELECT id,logical_booking_id,revision,workflow_revision,state,learner_id,booked_by_user_id,tutor_id,workflow_policy_id,admission_policy_id,start_at_utc,end_at_utc,expires_at,idempotency_key FROM bookings WHERE tutor_id=$1 ORDER BY id",
    [fixture.profile.id],
  );
  const events = await world.owner.pool.query<LifecycleRecord>(
    "SELECT e.id,e.booking_id,e.logical_booking_id,e.event,e.actor_user_id,e.created_at FROM booking_lifecycle_events e JOIN bookings b ON b.id=e.booking_id WHERE b.tutor_id=$1 ORDER BY e.id",
    [fixture.profile.id],
  );
  const intents = await world.owner.pool.query<NoticeRecord>(
    "SELECT i.event_id,i.recipient_user_id,i.kind FROM booking_workflow_notice_intents i JOIN booking_lifecycle_events e ON e.id=i.event_id JOIN bookings b ON b.id=e.booking_id WHERE b.tutor_id=$1 ORDER BY i.event_id,i.recipient_user_id",
    [fixture.profile.id],
  );
  return {
    bookings: bookings.rows,
    events: events.rows,
    intents: intents.rows,
  };
}

function readRequest(account: TestAccount, id: string) {
  return jsonRequest(world, `/api/bookings/${id}?scope=guardian`, {
    method: "GET",
    cookie: account.cookie,
  });
}

function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe(
    "private, no-store, max-age=0",
  );
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
}

it("closed separate runtime fails protected booking reads and creates safely, then a fresh runtime recovers once with the same cookie and key", async () => {
  const slots = await readWorkflowCandidates(
    fixture.context,
    fixture.requester.headers,
    fixture.choice,
  );
  const initialSlot = slots[6],
    retrySlot = slots[12];
  expect(initialSlot).toBeDefined();
  expect(retrySlot).toBeDefined();
  const initial = await createPolicyReservation(
    fixture.context,
    fixture.requester.headers,
    {
      ...fixture.choice,
      startAtUtc: initialSlot.startAtUtc,
      endAtUtc: initialSlot.endAtUtc,
      idempotencyKey: randomUUID(),
    },
  );
  await grantWorkflowTask(world, initial.logicalBookingId, reviewer, [
    "confirm",
  ]);
  const confirmed = await changePolicyBooking(
    fixture.context,
    reviewer.headers,
    initial.id,
    "confirm",
    {
      requestId: randomUUID(),
      expectedRevision: initial.workflowRevision,
      reasonCode: "synthetic_prerequisite_review",
    },
  );
  expect(confirmed.state).toBe("confirmed");
  const beforeRead = await handleBookingRead(
    world.runtime,
    readRequest(fixture.requester, confirmed.id),
    confirmed.id,
  );
  expect(beforeRead.status).toBe(200);
  const priorDetail = (await beforeRead.json()) as BookingDetail;
  const before = await recordedState();
  expect(before.bookings).toHaveLength(1);
  expect(before.events).toHaveLength(2);
  expect(before.intents).toHaveLength(4);

  const input = {
    ...fixture.choice,
    startAtUtc: retrySlot.startAtUtc,
    endAtUtc: retrySlot.endAtUtc,
    idempotencyKey: randomUUID(),
  };
  const runtimes = new Set<LocalAuthRuntime>();
  try {
    // Only this unused test-owned pool closes. No cluster, role, listener or
    // shared runtime is stopped. This is not a Neon suspend/resume simulation.
    const unavailable = createLocalAuth(process.env);
    runtimes.add(unavailable);
    await unavailable.pool.end();
    runtimes.delete(unavailable);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const warningLog = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const failedRead = await handleBookingRead(
        unavailable,
        readRequest(fixture.requester, confirmed.id),
        confirmed.id,
      );
      expect(failedRead.status).toBe(503);
      expectPrivate(failedRead);
      expect(await failedRead.json()).toEqual({
        message: "We couldn't load bookings. Try again later.",
      });
      const failedCreate = await handleWorkflowMutation(
        unavailable,
        jsonRequest(world, "/api/bookings/demo", {
          cookie: fixture.requester.cookie,
          body: input,
        }),
        undefined,
        undefined,
        { ...fixture.context, runtime: unavailable },
      );
      expect(failedCreate.status).toBe(503);
      expectPrivate(failedCreate);
      expect(await failedCreate.json()).toEqual({
        message: "This service is unavailable. Try again later.",
      });
      const captured = inspect([
        ...errorLog.mock.calls,
        ...warningLog.mock.calls,
      ]);
      const secrets = [
        process.env.DATABASE_URL,
        process.env.DATABASE_URL_DIRECT,
        process.env.BETTER_AUTH_SECRET,
        ...[process.env.DATABASE_URL, process.env.DATABASE_URL_DIRECT]
          .filter((value): value is string => Boolean(value))
          .map((value) => decodeURIComponent(new URL(value).password)),
        fixture.requester.cookie,
        ...fixture.requester.cookie
          .split(";")
          .map((part) => part.trim().replace(/^[^=]*=/, "")),
      ].filter((value): value is string => Boolean(value));
      // Boolean assertions avoid printing a forbidden value on test failure.
      expect(secrets.some((secret) => captured.includes(secret))).toBe(false);
      expect(
        /postgres(?:ql)?:|\b(?:select|insert|update|delete)\b|password|cookie|127\.0\.0\.1/i.test(
          captured,
        ),
      ).toBe(false);
    } finally {
      errorLog.mockRestore();
      warningLog.mockRestore();
    }
    expect(await recordedState()).toEqual(before);

    // Same isolated DB, real provider configuration and original signed cookie;
    // the pool is recreated, not secretly reopened or replaced with a mock.
    const healthy = createLocalAuth(process.env);
    runtimes.add(healthy);
    const recoveredRead = await handleBookingRead(
      healthy,
      readRequest(fixture.requester, confirmed.id),
      confirmed.id,
    );
    expect(recoveredRead.status).toBe(200);
    expectPrivate(recoveredRead);
    const recoveredDetail = (await recoveredRead.json()) as BookingDetail;
    // Snapshot clock is intentionally fresh; persisted state and history agree.
    expect({
      ...recoveredDetail,
      snapshotAtUtc: priorDetail.snapshotAtUtc,
    }).toEqual(priorDetail);
    const create = () =>
      handleWorkflowMutation(
        healthy,
        jsonRequest(world, "/api/bookings/demo", {
          cookie: fixture.requester.cookie,
          body: input,
        }),
        undefined,
        undefined,
        { ...fixture.context, runtime: healthy },
      );
    const recovered = await create();
    expect(recovered.status).toBe(200);
    expectPrivate(recovered);
    const receipt = (await recovered.json()) as WorkflowReceipt;
    expect(receipt).toMatchObject({
      state: "provisional",
      revision: 0,
      workflowRevision: 0,
    });
    expect(receipt.id).not.toBe(confirmed.id);
    const after = await recordedState();
    expect(after.bookings).toHaveLength(2);
    expect(after.events).toHaveLength(3);
    expect(after.intents).toHaveLength(6);
    expect(after.bookings.find((row) => row.id === confirmed.id)).toEqual(
      before.bookings[0],
    );
    expect(
      after.bookings.filter(
        (row) => row.idempotency_key === input.idempotencyKey,
      ),
    ).toHaveLength(1);
    expect(after.events.filter((row) => row.booking_id === receipt.id)).toEqual(
      [
        expect.objectContaining({
          id: receipt.eventId,
          event: "workflow_provisional",
          actor_user_id: fixture.requester.id,
        }),
      ],
    );
    expect(
      after.intents.filter((row) => row.event_id === receipt.eventId),
    ).toEqual(
      [fixture.requester.id, fixture.tutor.id].sort().map((recipient) => ({
        event_id: receipt.eventId,
        recipient_user_id: recipient,
        kind: "workflow_provisional",
      })),
    );
    const replay = await create();
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(receipt);
    expect(await recordedState()).toEqual(after);

    for (const id of [confirmed.id, receipt.id]) {
      const denied = await handleBookingRead(
        healthy,
        readRequest(foreign, id),
        id,
      );
      expect(denied.status).toBe(404);
      expectPrivate(denied);
      expect(await denied.json()).toEqual({
        message: "We can't find that booking on this account.",
      });
    }
    expect(await recordedState()).toEqual(after);
  } finally {
    await Promise.all([...runtimes].map((runtime) => runtime.pool.end()));
  }
}, 30_000);
