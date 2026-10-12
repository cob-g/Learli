import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import {
  bookings,
  bookingLifecycleEvents,
  guardianLearnerLinks,
  tutorProfiles,
  userAccess,
} from "@/lib/db/schema";
import {
  createDemoReservation,
  readDemoCandidates,
} from "@/features/bookings/service";
import {
  changeDemoBooking,
  readDemoRescheduleCandidates,
} from "@/features/bookings/lifecycle-service";
import { saveOwnTimeOff } from "@/features/time-off/service";
import { completeHistoricalDemoFixture } from "@/features/bookings/fixture-tooling";
import {
  readParticipantBooking,
  listParticipantBookingOverview,
} from "@/features/bookings/read-service";
import {
  readPrivateMeetingLink,
  savePrivateMeetingLink,
} from "@/features/booking-meeting-links/service";
import { familyLearner } from "../support/family-fixtures";
import {
  openWorld,
  closeWorld,
  createAccount,
  type World,
  type TestAccount,
} from "./support";
let world: World, parent: TestAccount, other: TestAccount, self: TestAccount;
const tutors: string[] = [];
beforeAll(async () => {
  world = openWorld();
  parent = await createAccount(world, ["parent"]);
  other = await createAccount(world, ["parent"]);
  self = await createAccount(world, ["student"]);
}, 30000);
afterAll(async () => {
  for (const id of tutors)
    await world.owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
      [id],
    );
  await closeWorld(world);
});
async function fixture(actor?: TestAccount) {
  if (!actor) {
    parent = await createAccount(world, ["parent"]);
    actor = parent;
  }
  const learner = await familyLearner(
    world.owner.pool,
    actor.id,
    actor === self ? "self" : "guardian",
    "Synthetic lifecycle learner",
  );
  const assigned = await createAccount(world, ["tutor"]);
  const created = await world.owner.pool.query(
    "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Synthetic lifecycle','Synthetic fixture.','Local testing only.','Asia/Manila','approved') RETURNING id",
    [assigned.id, `lifecycle-${randomUUID()}`],
  );
  const tutorId = created.rows[0].id as string;
  tutors.push(tutorId);
  const [tutor] = await world.owner.db
    .select()
    .from(tutorProfiles)
    .where(eq(tutorProfiles.id, tutorId));
  await world.owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT $1,id,ARRAY['elementary','college_support'] FROM subjects WHERE slug='math'",
    [tutorId],
  );
  await world.owner.pool.query(
    "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) SELECT $1,d,0,1440 FROM generate_series(1,7) d",
    [tutorId],
  );
  const choice = {
    learnerId: learner,
    tutorSlug: tutor.slug,
    subjectSlug: "math",
    displayTimezone: "Asia/Manila",
  };
  const options = await readDemoCandidates(
    world.runtime,
    actor.headers,
    choice,
  );
  const input = {
    ...choice,
    startAtUtc: options.times[0].startAtUtc,
    endAtUtc: options.times[0].endAtUtc,
    idempotencyKey: randomUUID(),
  };
  const reservation = await createDemoReservation(
    world.runtime,
    actor.headers,
    input,
  );
  const alternatives = await readDemoRescheduleCandidates(
    world.runtime,
    actor.headers,
    reservation.id,
  );
  const move = {
    requestId: randomUUID(),
    expectedRevision: 0,
    ...alternatives[0],
    displayTimezone: "America/New_York",
  };
  return { actor, assigned, learner, tutorId, tutor, input, reservation, move };
}
async function stored(id: string) {
  const [row] = await world.owner.db
    .select()
    .from(bookings)
    .where(eq(bookings.id, id));
  return row;
}
async function waitLock() {
  for (let n = 0; n < 100; n++) {
    const r = await world.owner.pool.query(
      "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND pid<>pg_backend_pid()",
    );
    if (r.rowCount) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("Expected waiter absent.");
}
async function held(
  f: Awaited<ReturnType<typeof fixture>>,
  action: () => Promise<unknown>,
  revoke: () => Promise<unknown>,
) {
  const c = await world.owner.pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE", [
      f.tutorId,
    ]);
    const p = action().then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    await waitLock();
    await revoke();
    await c.query("COMMIT");
    return await p;
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
}

describe("local booking lifecycle actual PostgreSQL", () => {
  it("cancels once, keeps immutable original fields/history and retry receipt", async () => {
    const f = await fixture();
    const before = await stored(f.reservation.id);
    const input = { requestId: randomUUID(), expectedRevision: 0 };
    const results = await Promise.all(
      [1, 2].map(() =>
        changeDemoBooking(
          world.runtime,
          parent.headers,
          f.reservation.id,
          "cancel",
          input,
        ),
      ),
    );
    expect(results[0]).toEqual(results[1]);
    expect(results[0].state).toBe("demo_cancelled");
    const after = await stored(f.reservation.id);
    expect({ ...after, state: before.state }).toEqual(before);
    const events = await world.owner.db
      .select()
      .from(bookingLifecycleEvents)
      .where(eq(bookingLifecycleEvents.bookingId, after.id));
    expect(events).toHaveLength(1);
    const detail = await readParticipantBooking(
      world.runtime,
      parent.headers,
      after.id,
      "guardian",
    );
    expect(detail.state).toBe("demo_cancelled");
    expect(detail.events.map((e) => e.event)).toEqual([
      "demo_reserved",
      "demo_cancelled",
    ]);
  });
  it("moves an overlapping original interval with unchanged expiry/root/creator; old-ID retries return saved replacement", async () => {
    const f = await fixture();
    const before = await stored(f.reservation.id);
    const results = await Promise.all(
      [1, 2].map(() =>
        changeDemoBooking(
          world.runtime,
          parent.headers,
          before.id,
          "reschedule",
          f.move,
        ),
      ),
    );
    expect(results[0]).toEqual(results[1]);
    const newRow = await stored(results[0].id);
    expect(newRow.logicalBookingId).toBe(before.id);
    expect(newRow.replacesBookingId).toBe(before.id);
    expect(newRow.revision).toBe(1);
    expect(newRow.expiresAt).toEqual(before.expiresAt);
    expect(newRow.bookedByUserId).toBe(before.bookedByUserId);
    expect((await stored(before.id)).state).toBe("demo_replaced");
    expect(newRow.startAtUtc.toISOString()).toBe(f.move.startAtUtc);
    const view = await listParticipantBookingOverview(
      world.runtime,
      parent.headers,
      { scope: "guardian", page: 1, pageSize: 20, learnerId: f.learner },
    );
    expect(view.active.items.map((b) => b.id)).toEqual([newRow.id]);
    expect(view.history.items.map((b) => b.id)).toContain(before.id);
    const original = await readParticipantBooking(
      world.runtime,
      parent.headers,
      before.id,
      "guardian",
    );
    expect(original.currentHeadId).toBe(newRow.id);
    expect(original.events.some((e) => e.event === "demo_rescheduled")).toBe(
      true,
    );
    expect(
      await changeDemoBooking(
        world.runtime,
        parent.headers,
        before.id,
        "reschedule",
        f.move,
      ),
    ).toEqual(results[0]);
  });
  it("failed conflict rolls back all retirement/event changes", async () => {
    const f = await fixture();
    const alternatives = await readDemoRescheduleCandidates(
      world.runtime,
      parent.headers,
      f.reservation.id,
    );
    Object.assign(f.move, alternatives[3]);
    await createDemoReservation(world.runtime, parent.headers, {
      ...f.input,
      startAtUtc: f.move.startAtUtc,
      endAtUtc: f.move.endAtUtc,
      idempotencyKey: randomUUID(),
    });
    await expect(
      changeDemoBooking(
        world.runtime,
        parent.headers,
        f.reservation.id,
        "reschedule",
        f.move,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect((await stored(f.reservation.id)).state).toBe("demo_reserved");
    expect(
      await world.owner.db
        .select()
        .from(bookingLifecycleEvents)
        .where(eq(bookingLifecycleEvents.bookingId, f.reservation.id)),
    ).toHaveLength(0);
  }, 15000);
  it("rejects differing payload retry and stale current-head changes", async () => {
    const f = await fixture();
    await changeDemoBooking(
      world.runtime,
      parent.headers,
      f.reservation.id,
      "reschedule",
      f.move,
    );
    await expect(
      changeDemoBooking(
        world.runtime,
        parent.headers,
        f.reservation.id,
        "reschedule",
        { ...f.move, displayTimezone: "UTC" },
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      changeDemoBooking(
        world.runtime,
        parent.headers,
        f.reservation.id,
        "cancel",
        { requestId: randomUUID(), expectedRevision: 0 },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("only one of distinct concurrent changes can retire a physical head", async () => {
    const f = await fixture();
    const r = await Promise.allSettled([
      changeDemoBooking(
        world.runtime,
        parent.headers,
        f.reservation.id,
        "reschedule",
        f.move,
      ),
      changeDemoBooking(
        world.runtime,
        parent.headers,
        f.reservation.id,
        "cancel",
        { requestId: randomUUID(), expectedRevision: 0 },
      ),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(r.filter((x) => x.status === "rejected")).toHaveLength(1);
  });
  it("denies unrelated family, staff bypass and revoked guardian even on saved retry", async () => {
    const f = await fixture();
    const input = { requestId: randomUUID(), expectedRevision: 0 };
    await expect(
      changeDemoBooking(
        world.runtime,
        other.headers,
        f.reservation.id,
        "cancel",
        input,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await changeDemoBooking(
      world.runtime,
      parent.headers,
      f.reservation.id,
      "cancel",
      input,
    );
    await world.owner.db
      .update(guardianLearnerLinks)
      .set({ status: "revoked" })
      .where(eq(guardianLearnerLinks.learnerId, f.learner));
    await expect(
      changeDemoBooking(
        world.runtime,
        parent.headers,
        f.reservation.id,
        "cancel",
        input,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("eligible independent college learner can move and cancel own simulation", async () => {
    const f = await fixture(self);
    const moved = await changeDemoBooking(
      world.runtime,
      self.headers,
      f.reservation.id,
      "reschedule",
      f.move,
    );
    expect(
      (
        await changeDemoBooking(
          world.runtime,
          self.headers,
          moved.id,
          "cancel",
          { requestId: randomUUID(), expectedRevision: 1 },
        )
      ).state,
    ).toBe("demo_cancelled");
  });
  it("cancellation remains available after tutor suspension while reschedule denies", async () => {
    const f = await fixture();
    await world.owner.db
      .update(tutorProfiles)
      .set({ reviewStatus: "suspended" })
      .where(eq(tutorProfiles.id, f.tutorId));
    await expect(
      changeDemoBooking(
        world.runtime,
        parent.headers,
        f.reservation.id,
        "reschedule",
        f.move,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await changeDemoBooking(
          world.runtime,
          parent.headers,
          f.reservation.id,
          "cancel",
          { requestId: randomUUID(), expectedRevision: 0 },
        )
      ).state,
    ).toBe("demo_cancelled");
  });
  it("cancellation survives removed offering but reschedule denies", async () => {
    const f = await fixture();
    await world.owner.pool.query(
      "DELETE FROM tutor_subjects WHERE tutor_id=$1",
      [f.tutorId],
    );
    await expect(
      changeDemoBooking(
        world.runtime,
        parent.headers,
        f.reservation.id,
        "reschedule",
        f.move,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await changeDemoBooking(
      world.runtime,
      parent.headers,
      f.reservation.id,
      "cancel",
      { requestId: randomUUID(), expectedRevision: 0 },
    );
  });
  it.each(["guardian", "role", "session", "account", "verified"] as const)(
    "rechecks %s revocation committed while waiting for tutor",
    async (kind) => {
      const actor = await createAccount(world, ["parent"]);
      const f = await fixture(actor);
      const result = await held(
        f,
        () =>
          changeDemoBooking(
            world.runtime,
            actor.headers,
            f.reservation.id,
            "reschedule",
            f.move,
          ),
        async () => {
          if (kind === "guardian")
            await world.owner.pool.query(
              "UPDATE guardian_learner_links SET status='revoked' WHERE learner_id=$1",
              [f.learner],
            );
          if (kind === "role")
            await world.owner.pool.query(
              "DELETE FROM user_roles WHERE user_id=$1 AND role='parent'",
              [actor.id],
            );
          if (kind === "session")
            await world.owner.pool.query(
              "DELETE FROM session WHERE user_id=$1",
              [actor.id],
            );
          if (kind === "account")
            await world.owner.db
              .update(userAccess)
              .set({ status: "suspended" })
              .where(eq(userAccess.userId, actor.id));
          if (kind === "verified")
            await world.owner.pool.query(
              'UPDATE "user" SET email_verified=false WHERE id=$1',
              [actor.id],
            );
        },
      );
      expect(result).toHaveProperty("error");
      expect((await stored(f.reservation.id)).state).toBe("demo_reserved");
    },
  );
  it("meeting link on retired ID cannot open and replacement starts missing", async () => {
    const f = await fixture();
    await savePrivateMeetingLink(
      world.runtime,
      f.assigned.headers,
      f.reservation.id,
      {
        url: "https://meet.google.com/abc-defg-hij",
        requestId: randomUUID(),
        expectedRevision: 0,
      },
    );
    const moved = await changeDemoBooking(
      world.runtime,
      parent.headers,
      f.reservation.id,
      "reschedule",
      f.move,
    );
    expect(
      (
        await readPrivateMeetingLink(
          world.runtime,
          parent.headers,
          f.reservation.id,
        )
      ).state,
    ).toBe("expired");
    expect(
      (await readPrivateMeetingLink(world.runtime, parent.headers, moved.id))
        .state,
    ).toBe("missing");
  });
  it("runtime cannot alter original schedule, renew TTL, promote fixture or edit/delete lifecycle history", async () => {
    const f = await fixture();
    for (const query of [
      "UPDATE bookings SET end_at_utc=end_at_utc+interval '1 hour' WHERE id=$1",
      "UPDATE bookings SET expires_at=expires_at+interval '1 hour' WHERE id=$1",
      "UPDATE bookings SET state='demo_completed' WHERE id=$1",
      "DELETE FROM bookings WHERE id=$1",
    ]) {
      await expect(
        world.runtime.pool.query(query, [f.reservation.id]),
      ).rejects.toBeDefined();
    }
    await changeDemoBooking(
      world.runtime,
      parent.headers,
      f.reservation.id,
      "cancel",
      { requestId: randomUUID(), expectedRevision: 0 },
    );
    await expect(
      world.runtime.pool.query(
        "DELETE FROM booking_lifecycle_events WHERE booking_id=$1",
        [f.reservation.id],
      ),
    ).rejects.toBeDefined();
    await expect(
      world.runtime.pool.query(
        "UPDATE booking_lifecycle_events SET event='demo_completed' WHERE booking_id=$1",
        [f.reservation.id],
      ),
    ).rejects.toBeDefined();
  });
  it("completion tooling requires ended owner fixture and keeps terminal outcome after TTL", async () => {
    const f = await fixture();
    await expect(
      completeHistoricalDemoFixture(world.owner, f.reservation.id),
    ).rejects.toThrow("Ended");
    const id = randomUUID();
    await world.owner.pool.query(
      "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) SELECT $1,source,tutor_id,learner_id,booked_by_user_id,subject_id,now()-interval '2 hours',now()-interval '1 hour',display_timezone,$2,request_fingerprint,'demo_reserved',now()-interval '3 hours',now()-interval '170 minutes' FROM bookings WHERE id=$3",
      [id, randomUUID(), f.reservation.id],
    );
    await world.owner.pool.query(
      "INSERT INTO booking_events(booking_id,event) VALUES($1,'demo_reserved')",
      [id],
    );
    await completeHistoricalDemoFixture(world.owner, id);
    const detail = await readParticipantBooking(
      world.runtime,
      parent.headers,
      id,
      "guardian",
    );
    expect(detail.state).toBe("demo_completed");
    expect(detail.events.map((e) => e.event)).toEqual([
      "demo_reserved",
      "demo_confirmed",
      "demo_completed",
    ]);
    await expect(
      completeHistoricalDemoFixture(
        { db: world.runtime.db, pool: world.runtime.pool },
        id,
      ),
    ).rejects.toThrow("Owner");
  });
  it("post-subject-wait current guardian authorization is mandatory", async () => {
    const f = await fixture();
    const c = await world.owner.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT id FROM subjects WHERE slug='math' FOR UPDATE");
      const result = changeDemoBooking(
        world.runtime,
        parent.headers,
        f.reservation.id,
        "reschedule",
        f.move,
      ).then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      await waitLock();
      await world.owner.pool.query(
        "UPDATE guardian_learner_links SET status='revoked' WHERE learner_id=$1",
        [f.learner],
      );
      await c.query("COMMIT");
      expect(await result).toHaveProperty("error");
      expect((await stored(f.reservation.id)).state).toBe("demo_reserved");
    } finally {
      await c.query("ROLLBACK");
      c.release();
    }
  });
  it("confirmed fixtures block overlap/time-off, preserve cancellation and TTL", async () => {
    const f = await fixture();
    await world.owner.db.transaction(async (tx) => {
      await tx
        .update(bookings)
        .set({ state: "demo_confirmed" })
        .where(eq(bookings.id, f.reservation.id));
      await tx.insert(bookingLifecycleEvents).values({
        logicalBookingId: f.reservation.id,
        bookingId: f.reservation.id,
        actorUserId: parent.id,
        event: "demo_confirmed",
        requestId: randomUUID(),
        requestFingerprint: "c".repeat(64),
      });
    });
    const before = await stored(f.reservation.id);
    await expect(
      createDemoReservation(world.runtime, other.headers, {
        ...f.input,
        learnerId: await familyLearner(
          world.owner.pool,
          other.id,
          "guardian",
          "Synthetic competitor",
        ),
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 409 });
    const local = (d: string) =>
      new Date(new Date(d).getTime() + 8 * 3600000).toISOString().slice(0, 16);
    await expect(
      saveOwnTimeOff(world.runtime, f.assigned.headers, {
        operation: "add",
        version: 0,
        timezone: "Asia/Manila",
        startLocal: local(f.input.startAtUtc),
        endLocal: local(f.input.endAtUtc),
      }),
    ).rejects.toMatchObject({ status: 409 });
    const moved = await changeDemoBooking(
      world.runtime,
      parent.headers,
      f.reservation.id,
      "reschedule",
      f.move,
    );
    expect((await stored(moved.id)).expiresAt).toEqual(before.expiresAt);
    expect(moved.state).toBe("demo_reserved");
  });
  it("reschedule and time-off race has exactly one valid winner, preserving rollback", async () => {
    const f = await fixture();
    const choices = await readDemoRescheduleCandidates(
      world.runtime,
      parent.headers,
      f.reservation.id,
    );
    Object.assign(f.move, choices[4]);
    const local = (d: string) =>
      new Date(new Date(d).getTime() + 8 * 3600000).toISOString().slice(0, 16);
    const results = await Promise.allSettled([
      changeDemoBooking(
        world.runtime,
        parent.headers,
        f.reservation.id,
        "reschedule",
        f.move,
      ),
      saveOwnTimeOff(world.runtime, f.assigned.headers, {
        operation: "add",
        version: 0,
        timezone: "Asia/Manila",
        startLocal: local(f.move.startAtUtc),
        endLocal: local(f.move.endAtUtc),
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("expiry after a real lock wait denies cancellation without revival", async () => {
    const f = await fixture();
    await changeDemoBooking(
      world.runtime,
      parent.headers,
      f.reservation.id,
      "cancel",
      { requestId: randomUUID(), expectedRevision: 0 },
    );
    const id = randomUUID();
    await world.owner.pool.query(
      "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) SELECT $1,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,$2,request_fingerprint,'demo_reserved',clock_timestamp()-interval '599 seconds',clock_timestamp()+interval '1 second' FROM bookings WHERE id=$3",
      [id, randomUUID(), f.reservation.id],
    );
    const result = await held(
      f,
      () =>
        changeDemoBooking(world.runtime, parent.headers, id, "cancel", {
          requestId: randomUUID(),
          expectedRevision: 0,
        }),
      async () => {
        await world.owner.pool.query("SELECT pg_sleep(1.2)");
      },
    );
    expect(result).toHaveProperty("error");
    expect((await stored(id)).state).toBe("demo_reserved");
    expect(
      (
        await readParticipantBooking(
          world.runtime,
          parent.headers,
          id,
          "guardian",
        )
      ).state,
    ).toBe("demo_expired");
    expect(
      await world.owner.db
        .select()
        .from(bookingLifecycleEvents)
        .where(eq(bookingLifecycleEvents.bookingId, id)),
    ).toHaveLength(0);
  });
  it("TEMP shadow history cannot satisfy deferred public audit provenance", async () => {
    const f = await fixture();
    const c = await world.runtime.pool.connect();
    await world.owner.pool.query(
      "GRANT TEMPORARY ON DATABASE learli_test TO learli_app",
    );
    try {
      await c.query("BEGIN");
      await c.query(
        "CREATE TEMP TABLE booking_lifecycle_events(booking_id uuid,event text)",
      );
      await c.query(
        "INSERT INTO pg_temp.booking_lifecycle_events VALUES($1,'demo_cancelled')",
        [f.reservation.id],
      );
      await c.query("SET LOCAL search_path=pg_temp,public");
      await c.query(
        "UPDATE public.bookings SET state='demo_cancelled' WHERE id=$1",
        [f.reservation.id],
      );
      await expect(c.query("COMMIT")).rejects.toMatchObject({ code: "23514" });
      expect((await stored(f.reservation.id)).state).toBe("demo_reserved");
    } finally {
      await c.query("ROLLBACK");
      c.release();
      await world.owner.pool.query(
        "REVOKE TEMPORARY ON DATABASE learli_test FROM learli_app",
      );
    }
  });
  it("TEMP shadow booking cannot authorize forged lifecycle event or replacement", async () => {
    const f = await fixture();
    const c = await world.runtime.pool.connect();
    await world.owner.pool.query(
      "GRANT TEMPORARY ON DATABASE learli_test TO learli_app",
    );
    try {
      await c.query("BEGIN");
      await c.query("CREATE TEMP TABLE bookings (LIKE public.bookings)");
      await c.query(
        "INSERT INTO pg_temp.bookings SELECT * FROM public.bookings WHERE id=$1",
        [f.reservation.id],
      );
      await c.query("UPDATE pg_temp.bookings SET state='demo_cancelled'");
      await c.query("SET LOCAL search_path=pg_temp,public");
      await expect(
        c.query(
          "INSERT INTO public.booking_lifecycle_events(logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint) VALUES($1,$1,$2,'demo_cancelled',$3,repeat('a',64))",
          [f.reservation.id, parent.id, randomUUID()],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await c.query("ROLLBACK");
      await c.query("BEGIN");
      await c.query("CREATE TEMP TABLE bookings (LIKE public.bookings)");
      await c.query(
        "INSERT INTO pg_temp.bookings SELECT * FROM public.bookings WHERE id=$1",
        [f.reservation.id],
      );
      await c.query("UPDATE pg_temp.bookings SET state='demo_replaced'");
      await c.query("SET LOCAL search_path=pg_temp,public");
      await expect(
        c.query(
          "INSERT INTO public.bookings(id,logical_booking_id,replaces_booking_id,revision,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) SELECT $1,id,id,1,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc+interval '1 day',end_at_utc+interval '1 day',display_timezone,$2,request_fingerprint,'demo_reserved',clock_timestamp(),expires_at FROM pg_temp.bookings",
          [randomUUID(), randomUUID()],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await c.query("ROLLBACK");
      expect((await stored(f.reservation.id)).state).toBe("demo_reserved");
    } finally {
      await c.query("ROLLBACK");
      c.release();
      await world.owner.pool.query(
        "REVOKE TEMPORARY ON DATABASE learli_test FROM learli_app",
      );
    }
  });
});
