import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import {
  mutateAdmissionReview,
  readAssignedAdmission,
} from "@/features/learner-admission/service";
import { currentCompletionEligibilityPredicate } from "@/features/booking-workflows/provider";
import {
  openWorld,
  closeWorld,
  createAccount,
  password,
  type World,
  type TestAccount,
} from "./support";
import {
  workflowFixture,
  grantWorkflowTask,
  historicalWorkflowBooking,
  provisionBookingPolicy,
} from "../support/booking-workflows-fixtures";
import { refreshTestAdmin } from "../support/admin-mfa";
import {
  createPolicyReservation,
  changePolicyBooking,
  readWorkflowCandidates,
  readWorkflowTask,
  readWorkflowMoveCandidates,
  type BookingWorkflowContext,
} from "@/features/booking-workflows/service";
import { generateSlots } from "@/lib/time/availability";
import { saveOwnAvailability } from "@/features/availability/service";
import { savePrivateMeetingLink } from "@/features/booking-meeting-links/service";
import { observedLock } from "./screening-fixtures";
let w: World,
  reviewer: TestAccount,
  f: Awaited<ReturnType<typeof workflowFixture>>;
beforeAll(async () => {
  w = openWorld();
  reviewer = await createAccount(w, ["admin"]);
});
beforeEach(async () => {
  await refreshTestAdmin(w.runtime, reviewer, password);
  f = await workflowFixture(w, reviewer);
});
afterAll(async () => {
  await w.owner.pool.query(
    "UPDATE booking_workflow_policy_head SET enabled=false",
  );
  await w.owner.pool.query(
    "UPDATE tutor_screening_policy_heads SET status='revoked'",
  );
  await closeWorld(w);
});
async function provisional() {
  const t = (
    await readWorkflowCandidates(f.context, f.requester.headers, f.choice)
  )[8];
  return createPolicyReservation(f.context, f.requester.headers, {
    ...f.choice,
    startAtUtc: t.startAtUtc,
    endAtUtc: t.endAtUtc,
    idempotencyKey: randomUUID(),
  });
}
async function confirmed() {
  const b = await provisional();
  await grantWorkflowTask(w, b.logicalBookingId, reviewer);
  return changePolicyBooking(f.context, reviewer.headers, b.id, "confirm", {
    requestId: randomUUID(),
    expectedRevision: 0,
    reasonCode: "synthetic_prerequisite_review",
  });
}
/** Test-owned structural transaction interception pauses only after the actual
 * scoped DB mutation returns, before the separate real receipt statement. No
 * production hook, mocked query, privilege bypass or assertion replacement. */
function interceptAfterMutation(
  context: BookingWorkflowContext,
  operation: () => Promise<void>,
): BookingWorkflowContext {
  const db = context.runtime.db;
  const decorated = Object.create(db) as typeof db;
  decorated.transaction = async (run, config) =>
    db.transaction(async (tx) => {
      const view = Object.create(tx) as typeof tx;
      let fired = false;
      view.execute = <
        T extends Record<string, unknown> = Record<string, unknown>,
      >(
        queryArgument: string | import("drizzle-orm").SQLWrapper,
      ) => {
        const args = [queryArgument] as const;
        const query = args[0] as { queryChunks?: unknown[] };
        const statement = JSON.stringify(query.queryChunks ?? query);
        const raw = tx.execute<T>(...args),
          execute = raw.execute.bind(raw);
        raw.execute = async () => {
          const result = await execute();
          if (
            !fired &&
            /create_policy_booking|change_policy_booking/.test(statement)
          ) {
            fired = true;
            await operation();
          }
          return result;
        };
        return raw;
      };
      return run(view);
    }, config);
  return { ...context, runtime: { ...context.runtime, db: decorated } };
}
async function sessionId(a: TestAccount): Promise<string> {
  return (
    await w.owner.pool.query(
      "SELECT id FROM session WHERE user_id=$1 AND expires_at>clock_timestamp() ORDER BY created_at DESC LIMIT 1",
      [a.id],
    )
  ).rows[0].id;
}
describe("independent provider review boundary regressions", () => {
  it("direct offset-window create/move use 09:15/09:45 anchors rather than clock modulo30", async () => {
    const version = (
      await w.owner.pool.query(
        "SELECT availability_version FROM tutor_profiles WHERE id=$1",
        [f.profile.id],
      )
    ).rows[0].availability_version;
    await saveOwnAvailability(w.runtime, f.tutor.headers, {
      version,
      timezone: "UTC",
      windows: Array.from({ length: 7 }, (_, i) => ({
        isoWeekday: i + 1,
        startMinute: 555,
        endMinute: 735,
      })),
    });
    const slots = await readWorkflowCandidates(
        f.context,
        f.requester.headers,
        f.choice,
      ),
      slot = slots[4],
      target = slots[5],
      subject = (
        await w.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
      ).rows[0].id;
    expect(new Date(slot.startAtUtc).getUTCMinutes() % 30).toBe(15);
    const r = await w.runtime.pool.query(
      "SELECT * FROM create_policy_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,'UTC',$10)",
      [
        f.requester.id,
        await sessionId(f.requester),
        randomUUID(),
        f.booking.policyId,
        f.learner.id,
        f.profile.id,
        subject,
        slot.startAtUtc,
        slot.endAtUtc,
        "a".repeat(64),
      ],
    );
    expect(r.rows[0].outcome).toBe("created");
    await grantWorkflowTask(w, r.rows[0].booking_id, reviewer);
    await changePolicyBooking(
      f.context,
      reviewer.headers,
      r.rows[0].booking_id,
      "confirm",
      {
        requestId: randomUUID(),
        expectedRevision: 0,
        reasonCode: "synthetic_prerequisite_review",
      },
    );
    const moved = await w.runtime.pool.query(
      "SELECT * FROM change_policy_booking($1,$2,$3,$4,$5,1,'reschedule','synthetic_participant_change',$6,$7,'UTC',$8)",
      [
        f.requester.id,
        await sessionId(f.requester),
        r.rows[0].booking_id,
        randomUUID(),
        f.booking.policyId,
        target.startAtUtc,
        target.endAtUtc,
        "b".repeat(64),
      ],
    );
    expect(moved.rows[0].outcome).toBe("saved");
  });
  it.each([
    [
      "NY fall",
      "America/New_York",
      "2026-11-01T00:00:00Z",
      "2026-11-01T12:00:00Z",
      15,
      240,
    ],
    [
      "NY gap",
      "America/New_York",
      "2026-03-08T00:00:00Z",
      "2026-03-08T12:00:00Z",
      75,
      240,
    ],
    [
      "Lord Howe half-hour gap",
      "Australia/Lord_Howe",
      "2026-10-03T12:00:00Z",
      "2026-10-04T12:00:00Z",
      15,
      240,
    ],
  ] as const)(
    "actual PG fixed-date %s candidate grids match window/transition anchors",
    async (_name, timezone, from, to, startMinute, endMinute) => {
      const version = (
          await w.owner.pool.query(
            "SELECT availability_version FROM tutor_profiles WHERE id=$1",
            [f.profile.id],
          )
        ).rows[0].availability_version,
        windows = [{ isoWeekday: 7, startMinute, endMinute }];
      await saveOwnAvailability(w.runtime, f.tutor.headers, {
        version,
        timezone,
        windows,
      });
      const expected = generateSlots({
          timeZone: timezone,
          windows,
          from: new Date(from),
          to: new Date(to),
          slotMinutes: 60,
          stepMinutes: 30,
        }),
        starts = new Set(expected.map((t) => t.start.toISOString()));
      expect(expected.length).toBeGreaterThanOrEqual(3);
      const now = new Date(new Date(from).getTime() - 86400000),
        probes = new Set(
          expected.flatMap((t) => [
            t.start.toISOString(),
            new Date(t.start.getTime() + 900000).toISOString(),
          ]),
        );
      for (const value of probes) {
        const start = new Date(value),
          end = new Date(start.getTime() + 3600000),
          r = await w.owner.pool.query(
            "SELECT booking_workflow_slot_valid($1,$2,$3,$4,NULL) AS valid",
            [f.profile.id, start, end, now],
          );
        expect(r.rows[0].valid, value).toBe(starts.has(value));
      }
    },
  );

  it.each(["create", "reschedule"])(
    "direct granted %s rejects off-grid start inside all-day availability",
    async (action) => {
      const slot = (
          await readWorkflowCandidates(f.context, f.requester.headers, f.choice)
        )[8],
        start = new Date(new Date(slot.startAtUtc).getTime() + 900000),
        end = new Date(start.getTime() + 3600000),
        subject = (
          await w.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
        ).rows[0].id;
      if (action === "create") {
        const r = await w.runtime.pool.query(
          "SELECT * FROM create_policy_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,'UTC',$10)",
          [
            f.requester.id,
            await sessionId(f.requester),
            randomUUID(),
            f.booking.policyId,
            f.learner.id,
            f.profile.id,
            subject,
            start,
            end,
            "a".repeat(64),
          ],
        );
        expect(r.rows[0].outcome).toBe("conflict");
      } else {
        const b = await confirmed(),
          r = await w.runtime.pool.query(
            "SELECT * FROM change_policy_booking($1,$2,$3,$4,$5,1,'reschedule','synthetic_participant_change',$6,$7,'UTC',$8)",
            [
              f.requester.id,
              await sessionId(f.requester),
              b.id,
              randomUUID(),
              f.booking.policyId,
              start,
              end,
              "a".repeat(64),
            ],
          );
        expect(r.rows[0].outcome).toBe("conflict");
        expect(
          (
            await w.owner.pool.query("SELECT state FROM bookings WHERE id=$1", [
              b.id,
            ])
          ).rows[0].state,
        ).toBe("confirmed");
      }
    },
  );

  it("direct replacement late event FK wait crossing its new-slot notice clock rolls back all writes", async () => {
    const b = await confirmed(),
      clock = (
        await w.owner.pool.query(
          "SELECT date_trunc('minute',clock_timestamp())+interval '61 minutes'+CASE WHEN extract(second from clock_timestamp())>58 THEN interval '1 minute' ELSE interval '0 minutes' END AS target",
        )
      ).rows[0],
      start = new Date(clock.target),
      end = new Date(start.getTime() + 3600000),
      minute = start.getUTCHours() * 60 + start.getUTCMinutes();
    const version = (
      await w.owner.pool.query(
        "SELECT availability_version FROM tutor_profiles WHERE id=$1",
        [f.profile.id],
      )
    ).rows[0].availability_version;
    await saveOwnAvailability(w.runtime, f.tutor.headers, {
      version,
      timezone: "UTC",
      windows: Array.from({ length: 7 }, (_, i) => ({
        isoWeekday: i + 1,
        startMinute: minute,
        endMinute: minute + 90,
      })),
    });
    expect(
      (
        await readWorkflowCandidates(f.context, f.requester.headers, f.choice)
      ).some((t) => t.startAtUtc === start.toISOString()),
    ).toBe(true);
    const blocker = await w.owner.pool.connect();
    let pending: Promise<import("pg").QueryResult> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
        f.tutor.id,
      ]);
      pending = w.runtime.pool.query(
        "SELECT * FROM change_policy_booking($1,$2,$3,$4,$5,$6,'reschedule','synthetic_participant_change',$7,$8,'UTC',$9)",
        [
          f.tutor.id,
          await sessionId(f.tutor),
          b.id,
          randomUUID(),
          f.booking.policyId,
          1,
          start,
          end,
          "a".repeat(64),
        ],
      );
      const settled = pending.then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      await observedLock(w, "change_policy_booking");
      await blocker.query(
        "SELECT pg_sleep(greatest(0,extract(epoch from ($1::timestamptz-interval '60 minutes'-clock_timestamp()))+0.1))",
        [start],
      );
      await blocker.query("COMMIT");
      expect(await settled).toMatchObject({ error: { code: "P4090" } });
      expect(
        (
          await w.owner.pool.query(
            "SELECT state,workflow_revision FROM bookings WHERE id=$1",
            [b.id],
          )
        ).rows[0],
      ).toEqual({ state: "confirmed", workflow_revision: 1 });
      expect(
        (
          await w.owner.pool.query(
            "SELECT count(*)::int n FROM bookings WHERE logical_booking_id=$1",
            [b.logicalBookingId],
          )
        ).rows[0].n,
      ).toBe(1);
      expect(
        (
          await w.owner.pool.query(
            "SELECT count(*)::int n FROM booking_lifecycle_events WHERE logical_booking_id=$1",
            [b.logicalBookingId],
          )
        ).rows[0].n,
      ).toBe(2);
      expect(
        (
          await w.owner.pool.query(
            "SELECT count(*)::int n FROM booking_workflow_notice_intents i JOIN booking_lifecycle_events e ON e.id=i.event_id WHERE e.logical_booking_id=$1",
            [b.logicalBookingId],
          )
        ).rows[0].n,
      ).toBe(4);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      if (pending) await pending.catch(() => undefined);
    }
  }, 90000);

  it.each(["task", "move"])(
    "original policy %s projection denies a new current policy head",
    async (projection) => {
      const b = await confirmed();
      expect(
        (await readWorkflowTask(f.context, reviewer.headers, b.id)).id,
      ).toBe(b.id);
      expect(
        (await readWorkflowMoveCandidates(f.context, f.requester.headers, b.id))
          .length,
      ).toBeGreaterThan(0);
      const next = await provisionBookingPolicy(w, f.admission.policyId),
        context = { runtime: w.runtime, booking: next };
      await expect(
        projection === "task"
          ? readWorkflowTask(context, reviewer.headers, b.id)
          : readWorkflowMoveCandidates(context, f.requester.headers, b.id),
      ).rejects.toMatchObject({ status: 404 });
    },
  );
  it("direct granted definer supports overlapping-original move without an application receipt", async () => {
    const b = await confirmed(),
      row = (
        await w.owner.pool.query(
          "SELECT start_at_utc,end_at_utc FROM bookings WHERE id=$1",
          [b.id],
        )
      ).rows[0];
    const r = await w.runtime.pool.query(
      "SELECT * FROM change_policy_booking($1,$2,$3,$4,$5,$6,'reschedule','synthetic_participant_change',$7,$8,'UTC',$9)",
      [
        f.requester.id,
        await sessionId(f.requester),
        b.id,
        randomUUID(),
        f.booking.policyId,
        1,
        new Date(new Date(row.start_at_utc).getTime() + 1800000),
        new Date(new Date(row.end_at_utc).getTime() + 1800000),
        "a".repeat(64),
      ],
    );
    expect(r.rows[0].outcome).toBe("saved");
    expect(r.rows[0].booking_id).not.toBe(b.id);
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM bookings WHERE logical_booking_id=$1 AND state='confirmed'",
          [b.logicalBookingId],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("direct granted replacement late actor event FK wait then target availability revocation rolls back chain/events/intents", async () => {
    const b = await confirmed(),
      target = (
        await readWorkflowCandidates(f.context, f.requester.headers, f.choice)
      )[20],
      blocker = await w.owner.pool.connect();
    let pending: Promise<import("pg").QueryResult> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
        f.tutor.id,
      ]);
      pending = w.runtime.pool.query(
        "SELECT * FROM change_policy_booking($1,$2,$3,$4,$5,$6,'reschedule','synthetic_participant_change',$7,$8,'UTC',$9)",
        [
          f.tutor.id,
          await sessionId(f.tutor),
          b.id,
          randomUUID(),
          f.booking.policyId,
          1,
          target.startAtUtc,
          target.endAtUtc,
          "a".repeat(64),
        ],
      );
      const settled = pending.then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      await observedLock(w, "change_policy_booking");
      await blocker.query("DELETE FROM tutor_availability WHERE tutor_id=$1", [
        f.profile.id,
      ]);
      await blocker.query("COMMIT");
      expect(await settled).toMatchObject({ error: { code: "P4090" } });
      expect(
        (
          await w.owner.pool.query(
            "SELECT state,workflow_revision FROM bookings WHERE id=$1",
            [b.id],
          )
        ).rows[0],
      ).toEqual({ state: "confirmed", workflow_revision: 1 });
      expect(
        (
          await w.owner.pool.query(
            "SELECT count(*)::int n FROM bookings WHERE logical_booking_id=$1",
            [b.logicalBookingId],
          )
        ).rows[0].n,
      ).toBe(1);
      expect(
        (
          await w.owner.pool.query(
            "SELECT count(*)::int n FROM booking_lifecycle_events WHERE logical_booking_id=$1",
            [b.logicalBookingId],
          )
        ).rows[0].n,
      ).toBe(2);
      expect(
        (
          await w.owner.pool.query(
            "SELECT count(*)::int n FROM booking_workflow_notice_intents i JOIN booking_lifecycle_events e ON e.id=i.event_id WHERE e.logical_booking_id=$1",
            [b.logicalBookingId],
          )
        ).rows[0].n,
      ).toBe(4);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      if (pending) await pending.catch(() => undefined);
    }
  });

  it("atomic confirmed replacement may overlap its retired original while keeping one blocking head", async () => {
    const b = await confirmed(),
      row = (
        await w.owner.pool.query(
          "SELECT start_at_utc,end_at_utc FROM bookings WHERE id=$1",
          [b.id],
        )
      ).rows[0];
    const moved = await changePolicyBooking(
      f.context,
      f.requester.headers,
      b.id,
      "reschedule",
      {
        requestId: randomUUID(),
        expectedRevision: 1,
        reasonCode: "synthetic_participant_change",
        startAtUtc: new Date(
          new Date(row.start_at_utc).getTime() + 1800000,
        ).toISOString(),
        endAtUtc: new Date(
          new Date(row.end_at_utc).getTime() + 1800000,
        ).toISOString(),
        displayTimezone: "UTC",
      },
    );
    expect(moved.state).toBe("confirmed");
    expect(
      (
        await w.owner.pool.query("SELECT state FROM bookings WHERE id=$1", [
          b.id,
        ])
      ).rows[0].state,
    ).toBe("replaced");
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM bookings WHERE logical_booking_id=$1 AND state='confirmed'",
          [b.logicalBookingId],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it.each([
    "actor",
    "session",
    "request",
    "policy",
    "revision",
    "action",
    "reason",
    "fingerprint",
  ])(
    "direct granted change rejects NULL %s without any writes",
    async (field) => {
      const b = await confirmed(),
        client = await w.runtime.pool.connect();
      const fields = [
        "actor",
        "session",
        "booking",
        "request",
        "policy",
        "revision",
        "action",
        "reason",
        "start",
        "end",
        "zone",
        "fingerprint",
      ];
      const values: unknown[] = [
        reviewer.id,
        await sessionId(reviewer),
        b.id,
        randomUUID(),
        f.booking.policyId,
        1,
        "cancel",
        "synthetic_participant_change",
        null,
        null,
        null,
        "a".repeat(64),
      ];
      values[fields.indexOf(field)] = null;
      try {
        await client.query("BEGIN");
        const before = await client.query(
          "SELECT (SELECT count(*) FROM booking_lifecycle_events WHERE logical_booking_id=$1)::int events,(SELECT count(*) FROM booking_workflow_notice_intents i JOIN booking_lifecycle_events e ON e.id=i.event_id WHERE e.logical_booking_id=$1)::int intents",
          [b.logicalBookingId],
        );
        const r = await client.query(
          "SELECT * FROM change_policy_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
          values,
        );
        expect(r.rows[0].outcome).toBe("invalid");
        expect(
          (
            await client.query(
              "SELECT state,workflow_revision FROM bookings WHERE id=$1",
              [b.id],
            )
          ).rows[0],
        ).toEqual({ state: "confirmed", workflow_revision: 1 });
        expect(
          (
            await client.query(
              "SELECT (SELECT count(*) FROM booking_lifecycle_events WHERE logical_booking_id=$1)::int events,(SELECT count(*) FROM booking_workflow_notice_intents i JOIN booking_lifecycle_events e ON e.id=i.event_id WHERE e.logical_booking_id=$1)::int intents",
              [b.logicalBookingId],
            )
          ).rows,
        ).toEqual(before.rows);
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
    },
  );
  it("confirmation expiry between mutation and final receipt rolls back state/event/intents", async () => {
    const now = Date.now(),
      b = await historicalWorkflowBooking(w, f, reviewer, {
        state: "provisional",
        start: new Date(now + 86400000),
        end: new Date(now + 90000000),
        created: new Date(now - 599000),
        expires: new Date(now + 1000),
      });
    await grantWorkflowTask(w, b.logicalBookingId, reviewer);
    const context = interceptAfterMutation(f.context, async () => {
      await w.owner.pool.query("SELECT pg_sleep(1.2)");
    });
    await expect(
      changePolicyBooking(context, reviewer.headers, b.id, "confirm", {
        requestId: randomUUID(),
        expectedRevision: 0,
        reasonCode: "synthetic_prerequisite_review",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await w.owner.pool.query(
          "SELECT state,workflow_revision FROM bookings WHERE id=$1",
          [b.id],
        )
      ).rows[0],
    ).toEqual({ state: "provisional", workflow_revision: 0 });
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM booking_lifecycle_events WHERE booking_id=$1",
          [b.id],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it.each([
    "foreign_event",
    "foreign_actor",
    "session",
    "admission",
    "screening",
    "policy",
    "different_booking_event",
  ])(
    "completion eligibility denies %s after a real administrative completion",
    async (kind) => {
      const now = Date.now(),
        b = await historicalWorkflowBooking(w, f, reviewer, {
          state: "confirmed",
          start: new Date(now - 7200000),
          end: new Date(now - 3600000),
          created: new Date(now - 14400000),
          expires: new Date(now - 13800000),
        });
      await grantWorkflowTask(w, b.logicalBookingId, reviewer);
      const done = await changePolicyBooking(
        f.context,
        reviewer.headers,
        b.id,
        "complete",
        {
          requestId: randomUUID(),
          expectedRevision: 0,
          reasonCode: "synthetic_completed",
        },
      );
      let userId = f.requester.id,
        actingSession = await sessionId(f.requester),
        eventId = done.eventId;
      const eligible = async () => {
        const predicate: SQL = currentCompletionEligibilityPredicate({
          userId,
          sessionId: actingSession,
          bookingId: b.id,
          eventId,
        });
        return (
          await w.runtime.db.execute<{ allowed: boolean }>(
            sql`SELECT ${predicate} AS allowed`,
          )
        ).rows[0].allowed;
      };
      expect(await eligible()).toBe(true);
      if (kind === "foreign_event") eventId = randomUUID();
      if (kind === "foreign_actor") {
        userId = reviewer.id;
        actingSession = await sessionId(reviewer);
      }
      if (kind === "session") actingSession = "not-a-current-session";
      if (kind === "admission") {
        const a = await readAssignedAdmission(
          f.admissionContext,
          reviewer.headers,
          f.admissionId,
        );
        await mutateAdmissionReview(
          f.admissionContext,
          reviewer.headers,
          f.admissionId,
          "decision",
          { requestId: randomUUID(), revision: a.revision, action: "revoke" },
        );
      }
      if (kind === "screening")
        await w.owner.pool.query(
          "UPDATE tutor_screening_policy_heads SET status='revoked'",
        );
      if (kind === "policy")
        await w.owner.pool.query(
          "UPDATE booking_workflow_policy_head SET enabled=false",
        );
      if (kind === "different_booking_event") {
        const future = await provisional();
        eventId = future.eventId;
      }
      expect(await eligible()).toBe(false);
    },
  );

  it("least-privilege direct SQL NULL action cannot create a no-show with a nonexistent session", async () => {
    const now = Date.now(),
      b = await historicalWorkflowBooking(w, f, reviewer, {
        state: "confirmed",
        start: new Date(now - 7200000),
        end: new Date(now - 3600000),
        created: new Date(now - 14400000),
        expires: new Date(now - 13800000),
      }),
      client = await w.runtime.pool.connect();
    try {
      await client.query("BEGIN");
      const r = await client.query(
        "SELECT * FROM public.change_policy_booking($1,$2,$3,$4,$5,$6,$7,$8,NULL,NULL,NULL,$9)",
        [
          f.requester.id,
          "nonexistent-session",
          b.id,
          randomUUID(),
          f.booking.policyId,
          0,
          null,
          "synthetic_participant_change",
          "a".repeat(64),
        ],
      );
      expect(r.rows[0].outcome).not.toBe("saved");
      expect(
        (
          await client.query(
            "SELECT state,workflow_revision FROM bookings WHERE id=$1",
            [b.id],
          )
        ).rows[0],
      ).toEqual({ state: "confirmed", workflow_revision: 0 });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
  it("revocation between definer assertion and final receipt rolls back provisional/event/intents", async () => {
    const t = (
        await readWorkflowCandidates(f.context, f.requester.headers, f.choice)
      )[8],
      key = randomUUID(),
      context = interceptAfterMutation(f.context, async () => {
        await w.owner.pool.query(
          "UPDATE user_access SET status='suspended' WHERE user_id=$1",
          [f.tutor.id],
        );
      });
    await expect(
      createPolicyReservation(context, f.requester.headers, {
        ...f.choice,
        startAtUtc: t.startAtUtc,
        endAtUtc: t.endAtUtc,
        idempotencyKey: key,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM bookings WHERE idempotency_key=$1",
          [key],
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it.each(["session", "account", "role", "screening", "policy", "end"])(
    "late readiness meeting actor FK wait then revoked %s rolls back link and audit",
    async (kind) => {
      const now = Date.now(),
        b =
          kind === "end"
            ? await historicalWorkflowBooking(w, f, reviewer, {
                state: "confirmed",
                start: new Date(now - 3600000),
                end: new Date(now + 1000),
                created: new Date(now - 7200000),
                expires: new Date(now - 6600000),
              })
            : await confirmed(),
        blocker = await w.owner.pool.connect();
      let pending: Promise<unknown> | undefined;
      try {
        await blocker.query("BEGIN");
        await blocker.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
          f.tutor.id,
        ]);
        pending = savePrivateMeetingLink(w.runtime, f.tutor.headers, b.id, {
          requestId: randomUUID(),
          expectedRevision: 0,
          url: "https://meet.google.com/abc-defg-hij",
        });
        const settled = pending.then(
          () => ({ ok: true }),
          (error) => ({ error }),
        );
        await observedLock(w, "booking_meeting_links");
        if (kind === "session")
          await blocker.query(
            "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
            [f.tutor.id],
          );
        if (kind === "account")
          await blocker.query(
            "UPDATE user_access SET status='suspended' WHERE user_id=$1",
            [f.tutor.id],
          );
        if (kind === "role")
          await blocker.query(
            "DELETE FROM user_roles WHERE user_id=$1 AND role='tutor'",
            [f.tutor.id],
          );
        if (kind === "screening")
          await blocker.query(
            "UPDATE tutor_screening_policy_heads SET status='revoked'",
          );
        if (kind === "end") await blocker.query("SELECT pg_sleep(1.2)");
        if (kind === "policy")
          await blocker.query(
            "UPDATE booking_workflow_policy_head SET enabled=false",
          );
        await blocker.query("COMMIT");
        expect(await settled).toMatchObject({ error: { status: 404 } });
        expect(
          (
            await w.owner.pool.query(
              "SELECT count(*)::int n FROM booking_meeting_links WHERE booking_id=$1",
              [b.id],
            )
          ).rows[0].n,
        ).toBe(0);
        expect(
          (
            await w.owner.pool.query(
              "SELECT count(*)::int n FROM booking_meeting_link_events WHERE booking_id=$1",
              [b.id],
            )
          ).rows[0].n,
        ).toBe(0);
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
        if (pending) await pending.catch(() => undefined);
      }
    },
  );
});
