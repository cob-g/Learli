import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
vi.mock("server-only", () => ({}));
import {
  readTutorBookingWorkspace,
  tutorAgendaBooking,
} from "@/features/tutors/booking-workspace";
import { nextTutorSimulation } from "@/features/tutors/booking-agenda";
import {
  readParticipantBooking,
  listParticipantBookingOverview,
} from "@/features/bookings/read-service";
import {
  closeWorld,
  createAccount,
  openWorld,
  type TestAccount,
  type World,
} from "./support";

let world: World;
let tutor: TestAccount;
let other: TestAccount;
let guardian: TestAccount;
let admin: TestAccount;
let tutorId: string;
let otherId: string;
let learnerId: string;
let subjectId: string;
let nextId: string;
let laterId: string;
let expiredId: string;
let foreignId: string;

async function profile(account: TestAccount) {
  const result = await world.owner.pool.query(
    "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Synthetic tutor','Synthetic biography','Test fixture','Asia/Manila','approved') RETURNING id",
    [account.id, `tutor-dashboard-${randomUUID()}`],
  );
  return result.rows[0].id as string;
}
async function reservation(profileId: string, hours: number, expired = false) {
  const id = randomUUID();
  await world.owner.pool.query(
    "WITH clock AS (SELECT clock_timestamp() AS now), times AS (SELECT now,date_bin('30 minutes',now,'2000-01-01'::timestamptz) AS start_base FROM clock) INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) SELECT $1,'local_simulation',$2,$3,$4,$5,start_base+($6::text||' hours')::interval,start_base+(($6::int+1)::text||' hours')::interval,'Asia/Manila',$7,$8,$9,now+(($10::int-600)::text||' seconds')::interval,now+($10::text||' seconds')::interval FROM times",
    [
      id,
      profileId,
      learnerId,
      guardian.id,
      subjectId,
      hours,
      randomUUID(),
      "d".repeat(64),
      "demo_reserved",
      expired ? -600 : 600,
    ],
  );
  await world.owner.pool.query(
    "INSERT INTO booking_events(booking_id,event,created_at) SELECT id,'demo_reserved',created_at FROM bookings WHERE id=$1",
    [id],
  );
  return id;
}
beforeAll(async () => {
  world = openWorld();
  await world.owner.pool.query("UPDATE rate_limit SET count=0");
  tutor = await createAccount(world, ["tutor"]);
  other = await createAccount(world, ["tutor"]);
  guardian = await createAccount(world, ["parent"]);
  admin = await createAccount(world, ["admin"]);
  tutorId = await profile(tutor);
  otherId = await profile(other);
  const learner = await world.owner.pool.query(
    "INSERT INTO learner_profiles(fixture_key,source,management,display_name,level,timezone) VALUES($1,'local_fixture','guardian','Synthetic assigned learner','elementary','Asia/Manila') RETURNING id",
    [randomUUID()],
  );
  learnerId = learner.rows[0].id as string;
  await world.owner.pool.query(
    "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
    [guardian.id, learnerId],
  );
  subjectId = (
    await world.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
  ).rows[0].id as string;
  nextId = await reservation(tutorId, 2);
  laterId = await reservation(tutorId, 4);
  expiredId = await reservation(tutorId, 6, true);
  foreignId = await reservation(otherId, 2);
});
beforeEach(() => world.owner.pool.query("UPDATE rate_limit SET count=0"));
afterAll(() => closeWorld(world));

describe("real PostgreSQL tutor dashboard composition", () => {
  it("uses exact assignment and one effective-state snapshot for next, agenda and history", async () => {
    const result = await readTutorBookingWorkspace(
      world.runtime,
      tutor.headers,
    );
    const overview = result.overview;
    if (!overview) throw new Error("Expected an assigned tutor overview.");
    expect(
      overview.active.items.map((row) => row.id).join() ===
        [nextId, laterId].join(),
    ).toBe(true);
    expect(
      overview.history.items.some(
        (row) => row.id === expiredId && row.state === "demo_expired",
      ),
    ).toBe(true);
    expect(
      [...overview.active.items, ...overview.history.items].every(
        (row) => row.id !== foreignId,
      ),
    ).toBe(true);
    expect(
      overview.active.snapshotAtUtc === overview.history.snapshotAtUtc,
    ).toBe(true);
    expect(
      overview.active.items.every(
        (row) => row.snapshotAtUtc === overview.active.snapshotAtUtc,
      ),
    ).toBe(true);
    expect(overview.active.learners).toEqual([]);
    expect(overview.history.learners).toEqual([]);
    const next = nextTutorSimulation(
      overview.active.items.map(tutorAgendaBooking),
      overview.active.snapshotAtUtc,
    );
    expect(next?.id === nextId).toBe(true);
    expect(next?.learnerLevel).toBe("Elementary");
    expect(next?.subject).toBe("Math");
    expect(
      next &&
        !("learnerId" in next) &&
        !("email" in next) &&
        !("timezone" in next),
    ).toBe(true);
    // Read projection must not materialize an expiry or fabricate an event.
    const stored = await world.owner.pool.query(
      "SELECT state,(SELECT count(*)::int FROM booking_events e WHERE e.booking_id=b.id) AS events FROM bookings b WHERE id=$1",
      [expiredId],
    );
    expect(
      stored.rows[0].state === "demo_reserved" && stored.rows[0].events === 1,
    ).toBe(true);
  });
  it("formats both pages in the current account zone and preserves UTC instants after zone changes", async () => {
    const first = await listParticipantBookingOverview(
      world.runtime,
      tutor.headers,
      { scope: "tutor" },
    );
    await world.owner.pool.query(
      "UPDATE \"user\" SET timezone='America/New_York' WHERE id=$1",
      [tutor.id],
    );
    try {
      const second = await listParticipantBookingOverview(
        world.runtime,
        tutor.headers,
        { scope: "tutor" },
      );
      expect(
        second.active.viewerTimezone === "America/New_York" &&
          second.history.viewerTimezone === "America/New_York",
      ).toBe(true);
      expect(
        second.active.items[0].time.startAtUtc ===
          first.active.items[0].time.startAtUtc,
      ).toBe(true);
      expect(
        second.active.items.every(
          (row) =>
            row.viewerTimezone === second.active.viewerTimezone &&
            row.time.zone.includes("Eastern"),
        ),
      ).toBe(true);
      expect(
        second.history.items.every(
          (row) => row.viewerTimezone === second.active.viewerTimezone,
        ),
      ).toBe(true);
    } finally {
      await world.owner.pool.query(
        "UPDATE \"user\" SET timezone='UTC' WHERE id=$1",
        [tutor.id],
      );
    }
  });
  it("denies foreign detail and unrelated family/admin tutor scope, without a role bypass", async () => {
    await expect(
      readParticipantBooking(world.runtime, other.headers, nextId, "tutor"),
    ).rejects.toMatchObject({ status: 404 });
    for (const actor of [guardian, admin])
      await expect(
        readTutorBookingWorkspace(world.runtime, actor.headers),
      ).rejects.toMatchObject({ status: 403 });
    await expect(
      readTutorBookingWorkspace(world.runtime, new Headers()),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("denies a removed trusted role", async () => {
    await world.owner.pool.query(
      "DELETE FROM user_roles WHERE user_id=$1 AND role='tutor'",
      [tutor.id],
    );
    try {
      await expect(
        readTutorBookingWorkspace(world.runtime, tutor.headers),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await world.owner.pool.query(
        "INSERT INTO user_roles(user_id,role) VALUES($1,'tutor')",
        [tutor.id],
      );
    }
  });
  it("rechecks a role revoked while the earlier profile read is blocked", async () => {
    const lock = await world.owner.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await lock.query("BEGIN");
      await lock.query("LOCK TABLE tutor_subjects IN ACCESS EXCLUSIVE MODE");
      pending = readTutorBookingWorkspace(world.runtime, tutor.headers).catch(
        (error: unknown) => error,
      );
      await expect
        .poll(async () => {
          const result = await world.owner.pool.query(
            "SELECT EXISTS(SELECT 1 FROM pg_locks WHERE relation='tutor_subjects'::regclass AND mode='AccessShareLock' AND NOT granted) AS waiting",
          );
          return result.rows[0].waiting;
        })
        .toBe(true);
      await world.owner.pool.query(
        "DELETE FROM user_roles WHERE user_id=$1 AND role='tutor'",
        [tutor.id],
      );
      await lock.query("COMMIT");
      expect(await pending).toMatchObject({ status: 404 });
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
      await pending;
      await world.owner.pool.query(
        "INSERT INTO user_roles(user_id,role) VALUES($1,'tutor') ON CONFLICT DO NOTHING",
        [tutor.id],
      );
    }
  });
  it("denies account suspension and email unverification", async () => {
    await world.owner.pool.query(
      "UPDATE user_access SET status='suspended' WHERE user_id=$1",
      [tutor.id],
    );
    try {
      await expect(
        readTutorBookingWorkspace(world.runtime, tutor.headers),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await world.owner.pool.query(
        "UPDATE user_access SET status='active' WHERE user_id=$1",
        [tutor.id],
      );
    }
    await world.owner.pool.query(
      'UPDATE "user" SET email_verified=false WHERE id=$1',
      [tutor.id],
    );
    try {
      await expect(
        readTutorBookingWorkspace(world.runtime, tutor.headers),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await world.owner.pool.query(
        'UPDATE "user" SET email_verified=true WHERE id=$1',
        [tutor.id],
      );
    }
  });
  it("denies suspended tutor profile even with an active verified role", async () => {
    await world.owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
      [tutorId],
    );
    try {
      await expect(
        readTutorBookingWorkspace(world.runtime, tutor.headers),
      ).rejects.toMatchObject({ status: 404 });
    } finally {
      await world.owner.pool.query(
        "UPDATE tutor_profiles SET review_status='approved' WHERE id=$1",
        [tutorId],
      );
    }
  });
  it("retains safe first-use profile flow for a trusted profileless tutor", async () => {
    const actor = await createAccount(world, ["tutor"]);
    const result = await readTutorBookingWorkspace(
      world.runtime,
      actor.headers,
    );
    expect(result.profile).toBeNull();
    expect(result.overview).toBeNull();
  });
  it("keeps earliest active preview separate from bounded reverse-order history", async () => {
    const result = await listParticipantBookingOverview(
      world.runtime,
      tutor.headers,
      { scope: "tutor", pageSize: 1 },
    );
    expect(result.active.items[0].id === nextId && result.active.hasNext).toBe(
      true,
    );
    expect(result.history.items[0].id === expiredId).toBe(true);
    await expect(
      listParticipantBookingOverview(world.runtime, tutor.headers, {
        scope: "tutor",
        learnerId,
      }),
    ).rejects.toBeDefined();
  });
  it("revoked and elapsed sessions cannot reopen the dashboard", async () => {
    const actor = await createAccount(world, ["tutor"]);
    await profile(actor);
    await world.owner.pool.query(
      "UPDATE \"session\" SET expires_at=now()-interval '1 second' WHERE user_id=$1",
      [actor.id],
    );
    await expect(
      readTutorBookingWorkspace(world.runtime, actor.headers),
    ).rejects.toMatchObject({ status: 401 });
    await world.owner.pool.query('DELETE FROM "session" WHERE user_id=$1', [
      other.id,
    ]);
    await expect(
      readTutorBookingWorkspace(world.runtime, other.headers),
    ).rejects.toMatchObject({ status: 401 });
  });
});
