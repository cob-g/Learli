import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { dispatchPendingBookingNotices } from "@/features/booking-notifications/dispatch";
import { readLifecycleNoticeRecipient } from "@/features/booking-notifications/lifecycle-recipient";
import * as capture from "@/features/booking-notifications/local-capture";
import {
  changeDemoBooking,
  readDemoRescheduleCandidates,
} from "@/features/bookings/lifecycle-service";
import { completeHistoricalDemoFixture } from "@/features/bookings/fixture-tooling";
import type { LifecycleNoticeKind } from "@/features/booking-notifications/kinds";
import { familyLearner, familyTutor } from "../support/family-fixtures";
import { openWorld, closeWorld, createAccount, type World } from "./support";

let world: World;
const tutors: string[] = [];
beforeAll(() => {
  world = openWorld();
});
const changedEmails = new Map<string, string>();
async function rememberSyntheticEmail(id: string) {
  const row = (
    await world.owner.pool.query('SELECT email FROM "user" WHERE id=$1', [id])
  ).rows[0];
  if (!row?.email.endsWith(".test"))
    throw new Error(
      "Owned synthetic email required before negative fixture mutation.",
    );
  changedEmails.set(id, row.email);
}
afterEach(async () => {
  try {
    for (const [id, email] of changedEmails)
      await world.owner.pool.query('UPDATE "user" SET email=$2 WHERE id=$1', [
        id,
        email,
      ]);
  } finally {
    changedEmails.clear();
    vi.restoreAllMocks();
  }
});
afterAll(async () => {
  for (const id of tutors)
    await world.owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
      [id],
    );
  await closeWorld(world);
});
async function fixture(
  options: {
    self?: boolean;
    dual?: boolean;
    expiry?: number;
    historical?: boolean;
  } = {},
) {
  const actor = await createAccount(
    world,
    options.self
      ? ["student"]
      : options.dual
        ? ["parent", "tutor"]
        : ["parent"],
  );
  const learnerId = await familyLearner(
    world.owner.pool,
    actor.id,
    options.self ? "self" : "guardian",
    "Private synthetic lifecycle notice learner",
  );
  const tutorId = await familyTutor(world.owner.pool);
  tutors.push(tutorId);
  if (options.dual)
    await world.owner.pool.query(
      "UPDATE tutor_profiles SET user_id=$1 WHERE id=$2",
      [actor.id, tutorId],
    );
  const t = await world.owner.pool.query(
    "SELECT user_id FROM tutor_profiles WHERE id=$1",
    [tutorId],
  );
  const tutorUserId = t.rows[0].user_id as string;
  await world.owner.pool.query(
    "UPDATE \"user\" SET timezone=CASE WHEN id=$1 THEN 'America/New_York' ELSE 'Europe/Paris' END WHERE id=ANY($2::text[])",
    [actor.id, [actor.id, tutorUserId]],
  );
  await world.owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT $1,id,ARRAY['elementary','college_support'] FROM subjects WHERE slug='math'",
    [tutorId],
  );
  await world.owner.pool.query(
    "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) SELECT $1,d,0,1440 FROM generate_series(1,7) d",
    [tutorId],
  );
  const bookingId = randomUUID();
  // A's real creation path uses Date milliseconds. Avoid a direct SQL fixture
  // with finer precision than the provider's immutable instant representation.
  const now = new Date();
  const start = new Date(
    now.getTime() + (options.historical ? -120 : 180) * 60_000,
  );
  await world.owner.pool.query(
    "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) SELECT $1,'local_simulation',$2,$3,$4,id,$5,$6,'Asia/Manila',$7,repeat('a',64),'demo_reserved',$8,$9 FROM subjects WHERE slug='math'",
    [
      bookingId,
      tutorId,
      learnerId,
      actor.id,
      start,
      new Date(start.getTime() + 3_600_000),
      randomUUID(),
      new Date(now.getTime() + ((options.expiry ?? 600) - 600) * 1000),
      new Date(now.getTime() + (options.expiry ?? 600) * 1000),
    ],
  );
  await world.owner.pool.query(
    "INSERT INTO booking_events(booking_id,event) VALUES($1,'demo_reserved')",
    [bookingId],
  );
  const e = await world.owner.pool.query(
    "SELECT id FROM booking_events WHERE booking_id=$1 AND event='demo_reserved'",
    [bookingId],
  );
  return {
    actor,
    learnerId,
    tutorId,
    tutorUserId,
    bookingId,
    creationEventId: e.rows[0].id as string,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const drain = (eventId: string, limit = 25) =>
  dispatchPendingBookingNotices(world.runtime, { eventId, limit });
const rows = async (eventId: string) =>
  (
    await world.owner.pool.query(
      "SELECT * FROM booking_lifecycle_notification_deliveries WHERE event_id=$1 ORDER BY recipient_user_id",
      [eventId],
    )
  ).rows;
const file = (eventId: string, recipient: string, kind: LifecycleNoticeKind) =>
  path.join(
    capture.bookingNoticeMailbox("test"),
    `${capture.bookingNoticeKey(eventId, recipient, kind)}.html`,
  );
async function cancel(f: Fixture) {
  const input = { requestId: randomUUID(), expectedRevision: 0 };
  return {
    result: await changeDemoBooking(
      world.runtime,
      f.actor.headers,
      f.bookingId,
      "cancel",
      input,
    ),
    input,
  };
}
async function reschedule(f: Fixture, id: string = f.bookingId, revision = 0) {
  const times = await readDemoRescheduleCandidates(
    world.runtime,
    f.actor.headers,
    id,
  );
  const input = {
    requestId: randomUUID(),
    expectedRevision: revision,
    ...times[0],
    displayTimezone: "Asia/Manila",
  };
  return {
    result: await changeDemoBooking(
      world.runtime,
      f.actor.headers,
      id,
      "reschedule",
      input,
    ),
    input,
  };
}
async function lifecycleEvents(id: string) {
  return (
    await world.owner.pool.query(
      "SELECT id,event FROM booking_lifecycle_events WHERE booking_id=$1 ORDER BY created_at",
      [id],
    )
  ).rows as { id: string; event: string }[];
}

describe("committed synthetic lifecycle notice PostgreSQL boundary", () => {
  it("queues cancellation once from actual idempotent service requests and captures only creator/tutor", async () => {
    const f = await fixture();
    const c = await cancel(f);
    const retry = await changeDemoBooking(
      world.runtime,
      f.actor.headers,
      f.bookingId,
      "cancel",
      c.input,
    );
    expect(retry.eventId).toBe(c.result.eventId);
    expect(await rows(c.result.eventId)).toHaveLength(2);
    expect(await drain(f.creationEventId)).toMatchObject({
      captured: 0,
      suppressed: 2,
    });
    expect(await drain(c.result.eventId)).toMatchObject({
      captured: 2,
      retryable: 0,
    });
    const html = await readFile(
      file(c.result.eventId, f.actor.id, "simulated_reservation_cancelled"),
      "utf8",
    );
    expect(html).toContain("Simulated reservation cancelled");
    expect(html).toContain("Eastern Time");
    for (const value of [
      f.learnerId,
      f.actor.id,
      f.tutorUserId,
      "Private synthetic lifecycle notice learner",
      "@learli.test",
      "meet.google.com",
      "zoom.us",
    ])
      expect(html.includes(value)).toBe(false);
    expect(html).not.toContain("Simulation expires at");
    expect(
      (
        await stat(
          file(c.result.eventId, f.actor.id, "simulated_reservation_cancelled"),
        )
      ).mode & 0o777,
    ).toBe(0o600);
    expect(await drain(c.result.eventId)).toMatchObject({ captured: 0 });
  });
  it("moves using A service, queues one logical change and no replacement-created notice", async () => {
    const f = await fixture();
    const m = await reschedule(f);
    const retry = await changeDemoBooking(
      world.runtime,
      f.actor.headers,
      f.bookingId,
      "reschedule",
      m.input,
    );
    expect(retry.eventId).toBe(m.result.eventId);
    const replacement = await world.owner.pool.query(
      "SELECT id FROM booking_events WHERE booking_id=$1 AND event='demo_reserved'",
      [m.result.id],
    );
    expect(
      (
        await world.owner.pool.query(
          "SELECT 1 FROM booking_notification_deliveries WHERE event_id=$1",
          [replacement.rows[0].id],
        )
      ).rows,
    ).toHaveLength(0);
    expect(await drain(m.result.eventId)).toMatchObject({ captured: 2 });
    const creator = await readFile(
      file(m.result.eventId, f.actor.id, "simulated_reservation_rescheduled"),
      "utf8",
    );
    const tutor = await readFile(
      file(
        m.result.eventId,
        f.tutorUserId,
        "simulated_reservation_rescheduled",
      ),
      "utf8",
    );
    expect(creator).toContain(`/bookings/${m.result.id}?scope=guardian`);
    expect(creator).toContain("Eastern Time");
    expect(tutor).toContain("Central European Time");
    expect(creator).toContain("Simulation expires at");
    expect(await drain(f.creationEventId)).toMatchObject({ suppressed: 2 });
  });
  it("suppresses reschedule notices superseded by another revision and cancellation", async () => {
    const f = await fixture();
    const one = await reschedule(f);
    const two = await reschedule(f, one.result.id, 1);
    expect(await drain(one.result.eventId)).toMatchObject({
      captured: 0,
      suppressed: 2,
    });
    const c = await changeDemoBooking(
      world.runtime,
      f.actor.headers,
      two.result.id,
      "cancel",
      { requestId: randomUUID(), expectedRevision: 2 },
    );
    expect(await drain(two.result.eventId)).toMatchObject({
      captured: 0,
      suppressed: 2,
    });
    expect(await drain(c.eventId)).toMatchObject({ captured: 2 });
  });
  it("preserves original captured creation artifacts as historical captures", async () => {
    const f = await fixture();
    expect(await drain(f.creationEventId)).toMatchObject({ captured: 2 });
    const old = path.join(
      capture.bookingNoticeMailbox("test"),
      `${capture.bookingNoticeKey(f.creationEventId, f.actor.id)}.html`,
    );
    const before = await readFile(old);
    const c = await cancel(f);
    await drain(c.result.eventId);
    expect(await readFile(old)).toEqual(before);
  });
  it("suppresses fixture-confirmed superseded in the same owner completion transaction", async () => {
    const f = await fixture({ historical: true, expiry: -1 });
    await completeHistoricalDemoFixture(world.owner, f.bookingId);
    await completeHistoricalDemoFixture(world.owner, f.bookingId);
    const events = await lifecycleEvents(f.bookingId);
    expect(events).toHaveLength(2);
    const confirmed = events.find((e) => e.event === "demo_confirmed")!,
      completed = events.find((e) => e.event === "demo_completed")!;
    expect(await drain(confirmed.id)).toMatchObject({
      captured: 0,
      suppressed: 2,
    });
    expect(await drain(completed.id)).toMatchObject({ captured: 2 });
    const html = await readFile(
      file(completed.id, f.actor.id, "simulated_fixture_completed"),
      "utf8",
    );
    expect(html).toContain("Synthetic fixture marked completed");
    expect(html).toContain(
      "does not establish a real lesson, payment or attendance",
    );
    expect(html).not.toContain("Simulation expires at");
  });
  it("captures only currently confirmed live owner fixture with explicit simulation wording", async () => {
    const f = await fixture();
    const id = randomUUID();
    await world.owner.db.transaction(async (tx) => {
      await tx.execute(
        sql`UPDATE bookings SET state='demo_confirmed' WHERE id=${f.bookingId}::uuid`,
      );
      await tx.execute(
        sql`INSERT INTO booking_lifecycle_events(id,logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint) VALUES(${id}::uuid,${f.bookingId}::uuid,${f.bookingId}::uuid,${f.actor.id},'demo_confirmed',${randomUUID()}::uuid,repeat('a',64))`,
      );
    });
    expect(await drain(id)).toMatchObject({ captured: 2 });
    expect(
      await readFile(
        file(id, f.actor.id, "simulated_fixture_confirmed"),
        "utf8",
      ),
    ).toContain("Owner-provisioned synthetic fixture only");
  });
  it("retains cancellation capture after original TTL for current head", async () => {
    const f = await fixture({ expiry: 2 });
    const c = await cancel(f);
    await world.owner.pool.query("SELECT pg_sleep(2.1)");
    expect(await drain(c.result.eventId)).toMatchObject({ captured: 2 });
  });
  it("rechecks elapsed TTL for a pending live moved notice", async () => {
    const f = await fixture({ expiry: 2 });
    const m = await reschedule(f);
    await world.owner.pool.query("SELECT pg_sleep(2.1)");
    expect(await drain(m.result.eventId)).toMatchObject({
      captured: 0,
      suppressed: 2,
    });
  });
  it("never captures uncommitted lifecycle events or rolled-back state", async () => {
    const f = await fixture();
    const id = randomUUID();
    const client = await world.owner.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE bookings SET state='demo_cancelled' WHERE id=$1",
        [f.bookingId],
      );
      await client.query(
        "INSERT INTO booking_lifecycle_events(id,logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint) VALUES($1,$2,$2,$3,'demo_cancelled',$4,repeat('a',64))",
        [id, f.bookingId, f.actor.id, randomUUID()],
      );
      expect(await drain(id)).toEqual({
        captured: 0,
        suppressed: 0,
        retryable: 0,
        skipped: 0,
      });
      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    expect(await rows(id)).toHaveLength(0);
    await expect(
      access(file(id, f.actor.id, "simulated_reservation_cancelled")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(
      (
        await world.owner.pool.query("SELECT state FROM bookings WHERE id=$1", [
          f.bookingId,
        ])
      ).rows[0].state,
    ).toBe("demo_reserved");
  });
  it("capture failure leaves cancellation and history committed, retry uses stable event identity", async () => {
    const f = await fixture();
    const c = await cancel(f);
    const spy = vi
      .spyOn(capture, "captureBookingNotice")
      .mockRejectedValue(
        new Error("Controlled failure; private detail omitted"),
      );
    expect(await drain(c.result.eventId)).toMatchObject({
      retryable: 2,
      captured: 0,
    });
    expect(
      (await rows(c.result.eventId)).every(
        (r) =>
          r.state === "pending" &&
          r.attempts === 1 &&
          r.failure_code === "capture_unavailable",
      ),
    ).toBe(true);
    expect(
      (
        await world.owner.pool.query("SELECT state FROM bookings WHERE id=$1", [
          f.bookingId,
        ])
      ).rows[0].state,
    ).toBe("demo_cancelled");
    expect(await lifecycleEvents(f.bookingId)).toHaveLength(1);
    spy.mockRestore();
    expect(await drain(c.result.eventId)).toMatchObject({ captured: 2 });
    expect(
      (await rows(c.result.eventId)).every(
        (r) => r.attempts === 2 && r.state === "captured",
      ),
    ).toBe(true);
  });
  it("capture-before-ack crash retries one stable artifact", async () => {
    const f = await fixture({ dual: true });
    const c = await cancel(f);
    await world.owner.pool.query(
      `CREATE FUNCTION lifecycle_notice_ack_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_id='${c.result.eventId}' AND NEW.state='captured' THEN RAISE EXCEPTION 'Controlled acknowledgement failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER lifecycle_notice_ack_failure BEFORE UPDATE ON booking_lifecycle_notification_deliveries FOR EACH ROW EXECUTE FUNCTION lifecycle_notice_ack_failure()`,
    );
    try {
      expect(await drain(c.result.eventId)).toMatchObject({ retryable: 1 });
      await access(
        file(c.result.eventId, f.actor.id, "simulated_reservation_cancelled"),
      );
      expect((await rows(c.result.eventId))[0].state).toBe("pending");
    } finally {
      await world.owner.pool.query(
        "DROP TRIGGER lifecycle_notice_ack_failure ON booking_lifecycle_notification_deliveries; DROP FUNCTION lifecycle_notice_ack_failure()",
      );
    }
    expect(await drain(c.result.eventId)).toMatchObject({ captured: 1 });
    const key = capture.bookingNoticeKey(
      c.result.eventId,
      f.actor.id,
      "simulated_reservation_cancelled",
    );
    expect(
      (await readdir(capture.bookingNoticeMailbox("test"))).filter((n) =>
        n.startsWith(key),
      ),
    ).toHaveLength(1);
  });
  it("concurrent manual drains claim each recipient once and deduplicate dual-role accounts", async () => {
    const f = await fixture({ dual: true });
    const c = await cancel(f);
    expect(await rows(c.result.eventId)).toHaveLength(1);
    const spy = vi.spyOn(capture, "captureBookingNotice");
    const results = await Promise.all([
      drain(c.result.eventId),
      drain(c.result.eventId),
      drain(c.result.eventId),
    ]);
    expect(results.reduce((sum, r) => sum + r.captured, 0)).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it("supports currently eligible College Support self recipient", async () => {
    const f = await fixture({ self: true });
    const c = await cancel(f);
    expect(await drain(c.result.eventId)).toMatchObject({ captured: 2 });
    expect(
      await readFile(
        file(c.result.eventId, f.actor.id, "simulated_reservation_cancelled"),
        "utf8",
      ),
    ).toContain("?scope=student");
  });
  it.each([
    "suspended",
    "unverified",
    "role-revoked",
    "guardian-revoked",
    "real-email",
    "inactive-learner",
  ])("suppresses currently unauthorized creator: %s", async (condition) => {
    const f = await fixture();
    const c = await cancel(f);
    if (condition === "suspended")
      await world.owner.pool.query(
        "UPDATE user_access SET status='suspended' WHERE user_id=$1",
        [f.actor.id],
      );
    if (condition === "unverified")
      await world.owner.pool.query(
        'UPDATE "user" SET email_verified=false WHERE id=$1',
        [f.actor.id],
      );
    if (condition === "role-revoked")
      await world.owner.pool.query("DELETE FROM user_roles WHERE user_id=$1", [
        f.actor.id,
      ]);
    if (condition === "guardian-revoked")
      await world.owner.pool.query(
        "UPDATE guardian_learner_links SET status='revoked' WHERE learner_id=$1",
        [f.learnerId],
      );
    if (condition === "real-email") {
      await rememberSyntheticEmail(f.actor.id);
      await world.owner.pool.query('UPDATE "user" SET email=$2 WHERE id=$1', [
        f.actor.id,
        `synthetic-${randomUUID()}@example.com`,
      ]);
    }
    if (condition === "inactive-learner")
      await world.owner.pool.query(
        "UPDATE learner_profiles SET status='inactive' WHERE id=$1",
        [f.learnerId],
      );
    await drain(c.result.eventId);
    expect(
      (await rows(c.result.eventId)).find(
        (r) => r.recipient_user_id === f.actor.id,
      ).state,
    ).toBe("suppressed");
    await expect(
      access(
        file(c.result.eventId, f.actor.id, "simulated_reservation_cancelled"),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
  it.each([
    "suspended",
    "unverified",
    "role-revoked",
    "review-revoked",
    "reassigned",
    "real-email",
  ])(
    "suppresses currently unauthorized assigned tutor: %s",
    async (condition) => {
      const f = await fixture();
      const c = await cancel(f);
      if (condition === "suspended")
        await world.owner.pool.query(
          "UPDATE user_access SET status='suspended' WHERE user_id=$1",
          [f.tutorUserId],
        );
      if (condition === "unverified")
        await world.owner.pool.query(
          'UPDATE "user" SET email_verified=false WHERE id=$1',
          [f.tutorUserId],
        );
      if (condition === "role-revoked")
        await world.owner.pool.query(
          "DELETE FROM user_roles WHERE user_id=$1",
          [f.tutorUserId],
        );
      if (condition === "review-revoked")
        await world.owner.pool.query(
          "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
          [f.tutorId],
        );
      if (condition === "reassigned") {
        const other = await createAccount(world, ["tutor"]);
        await world.owner.pool.query(
          "UPDATE tutor_profiles SET user_id=$1 WHERE id=$2",
          [other.id, f.tutorId],
        );
      }
      if (condition === "real-email") {
        await rememberSyntheticEmail(f.tutorUserId);
        await world.owner.pool.query('UPDATE "user" SET email=$2 WHERE id=$1', [
          f.tutorUserId,
          `synthetic-${randomUUID()}@example.com`,
        ]);
      }
      expect(await drain(c.result.eventId)).toMatchObject({
        captured: 1,
        suppressed: 1,
      });
      expect(
        (await rows(c.result.eventId)).find(
          (r) => r.recipient_user_id === f.tutorUserId,
        ).state,
      ).toBe("suppressed");
    },
  );
  it("rejects other authorized guardians, unrelated accounts/admins and wrong event kind", async () => {
    const f = await fixture();
    const c = await cancel(f);
    const other = await createAccount(world, ["parent", "admin"]);
    await world.owner.pool.query(
      "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
      [other.id, f.learnerId],
    );
    expect(
      await readLifecycleNoticeRecipient(world.runtime.db, {
        eventId: c.result.eventId,
        recipientUserId: other.id,
        kind: "simulated_reservation_cancelled",
      }),
    ).toBeNull();
    expect(
      await readLifecycleNoticeRecipient(world.runtime.db, {
        eventId: c.result.eventId,
        recipientUserId: f.actor.id,
        kind: "simulated_reservation_rescheduled",
      }),
    ).toBeNull();
    expect(await rows(c.result.eventId)).toHaveLength(2);
  });
  it("checks revocation freshly between recipients in one invocation", async () => {
    const f = await fixture();
    const c = await cancel(f);
    const recipients = (await rows(c.result.eventId)).map(
      (r) => r.recipient_user_id as string,
    );
    const original = capture.captureBookingNotice;
    let enter = () => {},
      resume = () => {};
    const entered = new Promise<void>((r) => {
        enter = r;
      }),
      held = new Promise<void>((r) => {
        resume = r;
      });
    vi.spyOn(capture, "captureBookingNotice").mockImplementation(
      async (options) => {
        if (options.recipientUserId === recipients[0]) {
          enter();
          await held;
        }
        return original(options);
      },
    );
    const pending = drain(c.result.eventId);
    await entered;
    await world.owner.pool.query(
      "UPDATE user_access SET status='suspended' WHERE user_id=$1",
      [recipients[1]],
    );
    resume();
    expect(await pending).toMatchObject({ captured: 1, suppressed: 1 });
  });
  it("preserves exact event FK, narrow runtime grants and immutable terminal identity", async () => {
    const f = await fixture();
    const c = await cancel(f);
    for (const query of [
      "DELETE FROM booking_lifecycle_notification_deliveries WHERE event_id=$1",
      "UPDATE booking_lifecycle_notification_deliveries SET recipient_user_id='forged' WHERE event_id=$1",
      "INSERT INTO booking_lifecycle_notification_deliveries(event_id,recipient_user_id,kind) SELECT event_id,recipient_user_id,kind FROM booking_lifecycle_notification_deliveries WHERE event_id=$1",
    ])
      await expect(
        world.runtime.pool.query(query, [c.result.eventId]),
      ).rejects.toMatchObject({ code: "42501" });
    await expect(
      world.owner.pool.query(
        "INSERT INTO booking_lifecycle_notification_deliveries(event_id,recipient_user_id,kind) VALUES($1,$2,'simulated_reservation_cancelled')",
        [randomUUID(), f.actor.id],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      world.runtime.pool.query(
        "SELECT public.queue_local_booking_lifecycle_notice()",
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      world.owner.pool.query(
        "UPDATE booking_lifecycle_notification_deliveries SET state='suppressed',attempts=1,last_attempt_at=now(),closed_at=now(),suppressed_reason=NULL WHERE event_id=$1",
        [c.result.eventId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await drain(c.result.eventId);
    await expect(
      world.runtime.pool.query(
        "UPDATE booking_lifecycle_notification_deliveries SET attempts=attempts+1 WHERE event_id=$1",
        [c.result.eventId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("one manual call shares its bound across original and lifecycle queues", async () => {
    const f = await fixture();
    const c = await cancel(f);
    const result = await dispatchPendingBookingNotices(world.runtime, {
      limit: 1,
    });
    expect(
      result.captured + result.suppressed + result.retryable + result.skipped,
    ).toBeLessThanOrEqual(1);
    expect(await drain(c.result.eventId, 1)).toMatchObject({ captured: 1 });
  });
});
