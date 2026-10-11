import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  bookings,
  bookingEvents,
  guardianLearnerLinks,
  learnerProfiles,
  subjects,
  tutorAvailability,
  tutorProfiles,
  user,
  userAccess,
  userRoles,
} from "@/lib/db/schema";
import { findEligibleTutor, filterTutors } from "@/features/tutors/eligibility";
import { saveOwnTutorProfile } from "@/features/tutors/service";
import {
  readOwnAvailabilityIntervals,
  saveOwnAvailability,
} from "@/features/availability/service";
import {
  createDemoReservation,
  readDemoCandidates,
} from "@/features/bookings/service";
import { bookingFingerprint } from "@/features/bookings/request-fingerprint";
import {
  handleDemoBookingCreate,
  handleDemoCandidateRead,
} from "@/features/bookings/handler";
import type { DemoBookingInput } from "@/features/bookings/input";
import { saveOwnTimeOff } from "@/features/time-off/service";
import { AccessError } from "@/lib/permissions/access";
import {
  createAccount,
  closeWorld,
  openWorld,
  jsonRequest,
  type World,
  type TestAccount,
} from "./support";

let world: World,
  parent: TestAccount,
  other: TestAccount,
  self: TestAccount,
  admin: TestAccount;
let learnerId: string, foreignId: string, selfId: string, subjectId: string;
async function learner(actor: TestAccount, independent = false) {
  const [row] = await world.owner.db
    .insert(learnerProfiles)
    .values({
      fixtureKey: randomUUID(),
      source: "local_fixture",
      management: independent ? "self" : "guardian",
      userId: independent ? actor.id : null,
      displayName: "Synthetic booking learner",
      level: independent ? "college_support" : "elementary",
      timezone: "Asia/Manila",
    })
    .returning();
  if (!independent)
    await world.owner.db.insert(guardianLearnerLinks).values({
      guardianUserId: actor.id,
      learnerId: row.id,
      source: "local_fixture",
      status: "authorized",
    });
  return row.id;
}
async function fresh(actor = parent, id = learnerId, timezone = "Asia/Manila") {
  const ownerId = randomUUID();
  await world.owner.db.insert(user).values({
    id: ownerId,
    name: "Synthetic booking tutor",
    email: `booking-${ownerId}@learli.test`,
    emailVerified: true,
  });
  await world.owner.db.insert(userAccess).values({ userId: ownerId });
  await world.owner.db
    .insert(userRoles)
    .values({ userId: ownerId, role: "tutor" });
  const [profile] = await world.owner.db
    .insert(tutorProfiles)
    .values({
      userId: ownerId,
      slug: `booking-${ownerId}`,
      headline: "Synthetic academic support",
      bio: "Synthetic test tutor profile.",
      teachingBackground: "Local test fixture only.",
      timezone,
      reviewStatus: "approved",
    })
    .returning();
  await world.owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) VALUES ($1,$2,ARRAY['elementary','college_support'])",
    [profile.id, subjectId],
  );
  await world.owner.db.insert(tutorAvailability).values(
    Array.from({ length: 7 }, (_, i) => ({
      tutorId: profile.id,
      isoWeekday: i + 1,
      startMinute: 480,
      endMinute: 1200,
    })),
  );
  const choice = {
    learnerId: id,
    tutorSlug: profile.slug,
    subjectSlug: "math",
    displayTimezone: "America/New_York",
  };
  const candidates = await readDemoCandidates(
    world.runtime,
    actor.headers,
    choice,
  );
  expect(candidates.times.length).toBeGreaterThan(2);
  const input: DemoBookingInput = {
    ...choice,
    startAtUtc: candidates.times[0].startAtUtc,
    endAtUtc: candidates.times[0].endAtUtc,
    idempotencyKey: randomUUID(),
  };
  return { profile, choice, candidates, input, ownerId };
}
beforeAll(async () => {
  world = openWorld();
  parent = await createAccount(world, ["parent"]);
  other = await createAccount(world, ["parent"]);
  self = await createAccount(world, ["student"]);
  admin = await createAccount(world, ["admin"]);
  learnerId = await learner(parent);
  foreignId = await learner(other);
  selfId = await learner(self, true);
  const [subject] = await world.owner.db
    .select()
    .from(subjects)
    .where(eq(subjects.slug, "math"));
  subjectId = subject.id;
}, 30000);
afterAll(() => closeWorld(world));

async function waitForTutorLock(count = 1) {
  for (let attempts = 0; attempts < 100; attempts++) {
    const waiting = await world.owner.pool.query(
      "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%tutor_profiles%'",
    );
    if (waiting.rows[0].count >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(
    "Expected booking request to wait on the controlled tutor lock.",
  );
}

async function combinedFixture() {
  const data = await fresh();
  const tutor = await createAccount(world, ["tutor"]);
  await world.owner.db
    .update(tutorProfiles)
    .set({ userId: tutor.id })
    .where(eq(tutorProfiles.id, data.profile.id));
  const local = (iso: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(iso));
    const value = (type: string) => parts.find((p) => p.type === type)!.value;
    return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
  };
  const timeOff = {
    operation: "add" as const,
    version: 0,
    timezone: "Asia/Manila",
    startLocal: local(data.input.startAtUtc),
    endLocal: local(data.input.endAtUtc),
  };
  const snapshot = async () => {
    const [result] = (
      await world.owner.pool.query(
        `SELECT availability_version AS version,
       (SELECT count(*)::int FROM tutor_availability_exceptions WHERE tutor_id=$1) AS exceptions,
       (SELECT count(*)::int FROM audit_events WHERE actor_user_id=$2 AND action='tutor_time_off.updated') AS audits,
       (SELECT count(*)::int FROM bookings WHERE tutor_id=$1) AS reservations
       FROM tutor_profiles WHERE id=$1`,
        [data.profile.id, tutor.id],
      )
    ).rows;
    return result;
  };
  return { ...data, tutor, timeOff, local, snapshot };
}

describe("atomic local synthetic bookings against PostgreSQL", () => {
  it("keeps the multi-role subject-admin audit foreign key compatible with actor quota locking", async () => {
    await world.owner.pool.query("UPDATE rate_limit SET count=0");
    const account = await createAccount(world, ["admin", "parent"]);
    const id = await learner(account);
    const data = await fresh(account, id);
    const blocker = await world.owner.pool.connect();
    const attempts = vi.spyOn(world.runtime.db, "transaction");
    try {
      // The exact subject-lock then actor audit FK order used by setSubjectActive.
      await blocker.query("BEGIN");
      await blocker.query(
        "UPDATE subjects SET is_active=false,updated_at=clock_timestamp() WHERE id=$1",
        [subjectId],
      );
      const pending = createDemoReservation(
        world.runtime,
        account.headers,
        data.input,
      ).then(
        (value) => ({ value, error: null }),
        (error) => ({ value: null, error }),
      );
      let waiting = false;
      for (let i = 0; i < 100; i++) {
        const result = await world.owner.pool.query(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%subjects%' AND query NOT LIKE '%tutor_profiles%'",
        );
        if (result.rows[0].n > 0) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
      const audit = await blocker
        .query(
          "INSERT INTO audit_events(actor_user_id,target_subject_id,action) VALUES($1,$2,'subject.deactivated')",
          [account.id, subjectId],
        )
        .then(
          () => ({ code: null }),
          (error) => ({ code: error.code }),
        );
      await blocker.query(audit.code ? "ROLLBACK" : "COMMIT");
      const result = await pending;
      expect(audit.code).toBeNull();
      // Either transaction can be the deadlock victim. A hidden booking retry
      // must not make this avoidable lock cycle appear to pass.
      expect(attempts).toHaveBeenCalledTimes(1);
      expect(result.error).toMatchObject({ status: 409 });
      expect(result.value).toBeNull();
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      attempts.mockRestore();
      await world.owner.pool.query(
        "UPDATE subjects SET is_active=true WHERE id=$1",
        [subjectId],
      );
    }
  });

  it.each([
    "student-role",
    "actor-verification",
    "learner-link",
    "tutor-verification",
    "session-deadline",
  ] as const)(
    "denies %s across its distinct waited authorization boundary",
    async (change) => {
      await world.owner.pool.query("UPDATE rate_limit SET count=0");
      const independent = change === "student-role";
      const account = await createAccount(world, [
        independent ? "student" : "parent",
      ]);
      const id = await learner(account, independent);
      const data = await fresh(account, id);
      const blocker = await world.owner.pool.connect();
      try {
        await blocker.query("BEGIN");
        const lockTable =
          change === "student-role" || change === "actor-verification"
            ? '"user"'
            : change === "learner-link"
              ? "learner_profiles"
              : "tutor_profiles";
        const lockId =
          lockTable === '"user"'
            ? account.id
            : lockTable === "learner_profiles"
              ? id
              : data.profile.id;
        await blocker.query(
          `SELECT id FROM ${lockTable} WHERE id=$1 FOR UPDATE`,
          [lockId],
        );
        const pending = createDemoReservation(
          world.runtime,
          account.headers,
          data.input,
        ).then(
          () => ({ accepted: true, status: 200 }),
          (error) => ({ accepted: false, status: error.status }),
        );
        let observed = false;
        for (let i = 0; i < 100; i++) {
          const result = await world.owner.pool.query(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",
            [`%${lockTable}%`],
          );
          if (result.rows[0].n > 0) {
            observed = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(observed).toBe(true);
        if (change === "session-deadline") {
          // Set the deadline after Better Auth resolves the session: its normal
          // rolling refresh may extend a deadline supplied before getSession.
          await world.owner.pool.query(
            "UPDATE session SET expires_at=clock_timestamp()+interval '1.2 seconds' WHERE user_id=$1",
            [account.id],
          );
        }
        if (change === "student-role")
          await blocker.query(
            "DELETE FROM user_roles WHERE user_id=$1 AND role='student'",
            [account.id],
          );
        if (change === "actor-verification")
          await blocker.query(
            'UPDATE "user" SET email_verified=false WHERE id=$1',
            [account.id],
          );
        if (change === "learner-link")
          await blocker.query(
            "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1",
            [account.id],
          );
        if (change === "tutor-verification")
          await blocker.query(
            'UPDATE "user" SET email_verified=false WHERE id=$1',
            [data.ownerId],
          );
        if (change === "session-deadline")
          await blocker.query("SELECT pg_sleep(1.3)");
        await blocker.query("COMMIT");
        const result = await pending;
        expect(result.accepted).toBe(false);
        expect([401, 403, 404, 409]).toContain(result.status);
        expect(
          await world.owner.db
            .select()
            .from(bookings)
            .where(eq(bookings.tutorId, data.profile.id)),
        ).toEqual([]);
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
      }
    },
  );

  it.each(["time-off", "availability", "profile", "interval-read"] as const)(
    "handles five authorized concurrent %s transactions at the existing pool capacity",
    async (operation) => {
      await world.owner.pool.query("UPDATE rate_limit SET count=0");
      const data = await combinedFixture();
      const blocker = await world.owner.pool.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
          [data.profile.id],
        );
        const pending = Array.from({ length: 5 }, () =>
          (operation === "time-off"
            ? saveOwnTimeOff(world.runtime, data.tutor.headers, data.timeOff)
            : operation === "availability"
              ? saveOwnAvailability(world.runtime, data.tutor.headers, {
                  version: 0,
                  timezone: "Asia/Manila",
                  windows: [],
                })
              : operation === "interval-read"
                ? readOwnAvailabilityIntervals(
                    world.runtime,
                    data.tutor.headers,
                    new Date(data.input.startAtUtc),
                    new Date(data.input.endAtUtc),
                  )
                : saveOwnTutorProfile(world.runtime, data.tutor.headers, {
                    headline: data.profile.headline,
                    bio: data.profile.bio,
                    teachingBackground: data.profile.teachingBackground,
                    timezone: "Asia/Manila",
                    teachingLanguages: ["en"],
                    offerings: [{ subjectId, levels: ["elementary"] }],
                  })
          ).then(
            () => 200,
            (error) => error.status ?? 503,
          ),
        );
        await waitForTutorLock(5);
        await blocker.query("COMMIT");
        const outcomes = (await Promise.all(pending)).sort();
        expect(outcomes).toEqual(
          operation === "profile" || operation === "interval-read"
            ? [200, 200, 200, 200, 200]
            : [200, 409, 409, 409, 409],
        );
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
      }
    },
  );

  it.each(["remove", "interval-read"] as const)(
    "denies queued time-off %s after provider-session deletion",
    async (operation) => {
      await world.owner.pool.query("UPDATE rate_limit SET count=0");
      const data = await combinedFixture();
      await saveOwnTimeOff(world.runtime, data.tutor.headers, data.timeOff);
      const exception = (
        await world.owner.pool.query(
          "SELECT id FROM tutor_availability_exceptions WHERE tutor_id=$1",
          [data.profile.id],
        )
      ).rows[0];
      const before = await data.snapshot();
      const blocker = await world.owner.pool.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
          [data.profile.id],
        );
        const pending = (
          operation === "remove"
            ? saveOwnTimeOff(world.runtime, data.tutor.headers, {
                operation: "remove",
                version: 1,
                id: exception.id,
              })
            : readOwnAvailabilityIntervals(
                world.runtime,
                data.tutor.headers,
                new Date(data.input.startAtUtc),
                new Date(data.input.endAtUtc),
              )
        ).then(
          () => 200,
          (error) => error.status,
        );
        await waitForTutorLock();
        await blocker.query("DELETE FROM session WHERE user_id=$1", [
          data.tutor.id,
        ]);
        await blocker.query("COMMIT");
        expect(await pending).toBe(401);
        expect(await data.snapshot()).toEqual(before);
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
      }
    },
  );

  it("enforces the actor technical quota atomically across different tutor locks", async () => {
    await world.owner.pool.query("UPDATE rate_limit SET count=0");
    const account = await createAccount(world, ["parent"]);
    const id = await learner(account);
    const data = [];
    for (let i = 0; i < 21; i++) data.push(await fresh(account, id));
    const outcomes = await Promise.all(
      data.map((item) =>
        createDemoReservation(world.runtime, account.headers, item.input).then(
          () => 200,
          (error) => error.status,
        ),
      ),
    );
    expect(outcomes.filter((status) => status === 200)).toHaveLength(20);
    expect(outcomes.filter((status) => status === 409)).toHaveLength(1);
    const rows = await world.owner.pool.query(
      "SELECT count(*)::int AS n FROM bookings WHERE booked_by_user_id=$1",
      [account.id],
    );
    expect(rows.rows[0].n).toBe(20);
    const events = await world.owner.pool.query(
      "SELECT count(*)::int AS n FROM booking_events e JOIN bookings b ON b.id=e.booking_id WHERE b.booked_by_user_id=$1",
      [account.id],
    );
    expect(events.rows[0].n).toBe(20);
  }, 15000);

  it.each([
    ["read", "guardian"],
    ["read", "role"],
    ["read", "access"],
    ["create", "guardian"],
    ["create", "role"],
    ["create", "access"],
  ] as const)(
    "denies queued subject-lock %s after %s revocation and preserves expiry history",
    async (operation, change) => {
      await world.owner.pool.query("UPDATE rate_limit SET count=0");
      const account = await createAccount(world, ["parent"]);
      const accountLearner = await learner(account);
      const data = await fresh(account, accountLearner);
      const [old] = await world.owner.db
        .insert(bookings)
        .values({
          source: "local_simulation",
          tutorId: data.profile.id,
          learnerId: accountLearner,
          bookedByUserId: account.id,
          subjectId,
          startAtUtc: new Date(data.input.startAtUtc),
          endAtUtc: new Date(data.input.endAtUtc),
          displayTimezone: data.input.displayTimezone,
          idempotencyKey: randomUUID(),
          requestFingerprint: "a".repeat(64),
          state: "demo_reserved",
          createdAt: new Date(Date.now() - 1_200_000),
          expiresAt: new Date(Date.now() - 600_000),
        })
        .returning();
      await world.owner.db.insert(bookingEvents).values({
        bookingId: old.id,
        event: "demo_reserved",
        createdAt: old.createdAt,
      });
      const blocker = await world.owner.pool.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query("SELECT id FROM subjects WHERE id=$1 FOR UPDATE", [
          subjectId,
        ]);
        const pending =
          operation === "read"
            ? readDemoCandidates(
                world.runtime,
                account.headers,
                data.choice,
              ).then(
                () => ({ accepted: true, status: 200 }),
                (error) => ({ accepted: false, status: error.status }),
              )
            : createDemoReservation(
                world.runtime,
                account.headers,
                data.input,
              ).then(
                () => ({ accepted: true, status: 200 }),
                (error) => ({ accepted: false, status: error.status }),
              );
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          const result = await world.owner.pool.query(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%subjects%' AND query NOT LIKE '%tutor_profiles%'",
          );
          if (result.rows[0].n > 0) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(waiting).toBe(true);
        if (change === "guardian")
          await blocker.query(
            "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1",
            [account.id],
          );
        if (change === "role")
          await blocker.query("DELETE FROM user_roles WHERE user_id=$1", [
            account.id,
          ]);
        if (change === "access")
          await blocker.query(
            "UPDATE user_access SET status='suspended' WHERE user_id=$1",
            [account.id],
          );
        await blocker.query("COMMIT");
        const outcome = await pending;
        expect(outcome.accepted).toBe(false);
        expect([403, 404]).toContain(outcome.status);
        expect(
          await world.owner.db
            .select()
            .from(bookings)
            .where(eq(bookings.tutorId, data.profile.id)),
        ).toEqual([old]);
        const history = await world.owner.db
          .select()
          .from(bookingEvents)
          .where(eq(bookingEvents.bookingId, old.id));
        expect(history).toHaveLength(1);
        expect(history[0]).toMatchObject({
          event: "demo_reserved",
          createdAt: old.createdAt,
        });
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
      }
    },
  );

  it.each([
    "guardian",
    "parent-role",
    "parent-access",
    "parent-session",
    "tutor-role",
    "tutor-access",
  ] as const)(
    "rejects committed %s revocation after a controlled tutor-lock wait",
    async (change) => {
      await world.owner.pool.query("UPDATE rate_limit SET count=0");
      const data = await combinedFixture();
      const blocker = await world.owner.pool.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
          [data.profile.id],
        );
        const pending = handleDemoBookingCreate(
          world.runtime,
          jsonRequest(world, "/api/bookings/demo", {
            cookie: parent.cookie,
            body: data.input,
          }),
        );
        await waitForTutorLock();
        if (change === "guardian")
          await blocker.query(
            "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1 AND learner_id=$2",
            [parent.id, learnerId],
          );
        if (change === "parent-role")
          await blocker.query(
            "DELETE FROM user_roles WHERE user_id=$1 AND role='parent'",
            [parent.id],
          );
        if (change === "parent-access")
          await blocker.query(
            "UPDATE user_access SET status='suspended' WHERE user_id=$1",
            [parent.id],
          );
        if (change === "parent-session")
          await blocker.query(
            "UPDATE session SET expires_at=now()-interval '1 second' WHERE user_id=$1",
            [parent.id],
          );
        if (change === "tutor-role")
          await blocker.query(
            "DELETE FROM user_roles WHERE user_id=$1 AND role='tutor'",
            [data.tutor.id],
          );
        if (change === "tutor-access")
          await blocker.query(
            "UPDATE user_access SET status='suspended' WHERE user_id=$1",
            [data.tutor.id],
          );
        await blocker.query("COMMIT");
        const response = await pending;
        expect([401, 403, 404, 409]).toContain(response.status);
        expect((await data.snapshot()).reservations).toBe(0);
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
        await world.owner.pool.query(
          "UPDATE guardian_learner_links SET status='authorized' WHERE guardian_user_id=$1 AND learner_id=$2",
          [parent.id, learnerId],
        );
        await world.owner.pool.query(
          "INSERT INTO user_roles(user_id,role) VALUES($1,'parent') ON CONFLICT DO NOTHING",
          [parent.id],
        );
        await world.owner.pool.query(
          "UPDATE user_access SET status='active' WHERE user_id=$1",
          [parent.id],
        );
        await world.owner.pool.query(
          "UPDATE session SET expires_at=now()+interval '1 day' WHERE user_id=$1",
          [parent.id],
        );
      }
    },
  );

  it.each(["time-off", "availability", "profile"] as const)(
    "rechecks queued %s mutations after session, role or account revocation",
    async (operation) => {
      for (const change of ["session", "role", "access"] as const) {
        await world.owner.pool.query("UPDATE rate_limit SET count=0");
        const data = await combinedFixture();
        const blocker = await world.owner.pool.connect();
        try {
          await blocker.query("BEGIN");
          await blocker.query(
            "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
            [data.profile.id],
          );
          const pending = (
            operation === "time-off"
              ? saveOwnTimeOff(world.runtime, data.tutor.headers, data.timeOff)
              : operation === "availability"
                ? saveOwnAvailability(world.runtime, data.tutor.headers, {
                    version: 0,
                    timezone: "Asia/Manila",
                    windows: [],
                  })
                : saveOwnTutorProfile(world.runtime, data.tutor.headers, {
                    headline: data.profile.headline,
                    bio: data.profile.bio,
                    teachingBackground: data.profile.teachingBackground,
                    timezone: "Asia/Manila",
                    teachingLanguages: ["en"],
                    offerings: [{ subjectId, levels: ["elementary"] }],
                  })
          ).then(
            () => ({ accepted: true, status: 200, error: null }),
            (error) => ({ accepted: false, status: error.status, error }),
          );
          await waitForTutorLock();
          if (change === "session")
            await blocker.query("DELETE FROM session WHERE user_id=$1", [
              data.tutor.id,
            ]);
          if (change === "role")
            await blocker.query(
              "DELETE FROM user_roles WHERE user_id=$1 AND role='tutor'",
              [data.tutor.id],
            );
          if (change === "access")
            await blocker.query(
              "UPDATE user_access SET status='suspended' WHERE user_id=$1",
              [data.tutor.id],
            );
          await blocker.query("COMMIT");
          const denied = await pending;
          expect(denied.accepted).toBe(false);
          expect(denied.status).toBe(change === "session" ? 401 : 403);
          expect(denied.error).toBeInstanceOf(AccessError);
          expect(await data.snapshot()).toEqual({
            version: 0,
            exceptions: 0,
            audits: 0,
            reservations: 0,
          });
          expect(
            (
              await world.owner.pool.query(
                "SELECT count(*)::int AS n FROM tutor_availability WHERE tutor_id=$1",
                [data.profile.id],
              )
            ).rows[0].n,
          ).toBe(7);
          expect(
            (
              await world.owner.pool.query(
                "SELECT count(*)::int AS n FROM tutor_teaching_languages WHERE tutor_id=$1",
                [data.profile.id],
              )
            ).rows[0].n,
          ).toBe(0);
        } finally {
          await blocker.query("ROLLBACK");
          blocker.release();
        }
      }
    },
  );

  it("materializes reservations expiring during the subject wait before overlapping insertion", async () => {
    const { input, profile } = await fresh();
    const createdAt = new Date(),
      expiresAt = new Date(createdAt.getTime() + 1000);
    const [old] = await world.owner.db
      .insert(bookings)
      .values({
        source: "local_simulation",
        tutorId: profile.id,
        learnerId,
        bookedByUserId: parent.id,
        subjectId,
        startAtUtc: new Date(input.startAtUtc),
        endAtUtc: new Date(input.endAtUtc),
        displayTimezone: input.displayTimezone,
        idempotencyKey: randomUUID(),
        requestFingerprint: "a".repeat(64),
        state: "demo_reserved",
        createdAt,
        expiresAt,
      })
      .returning();
    await world.owner.db
      .insert(bookingEvents)
      .values({ bookingId: old.id, event: "demo_reserved", createdAt });
    const blocker = await world.owner.pool.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM subjects WHERE id=$1 FOR UPDATE", [
        subjectId,
      ]);
      const pending = createDemoReservation(
        world.runtime,
        parent.headers,
        input,
      ).then(
        (value) => ({ value, error: null }),
        (error) => ({ value: null, error }),
      );
      let observed = false;
      for (let i = 0; i < 100; i++) {
        const result = await world.owner.pool.query(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%subjects%' AND query NOT LIKE '%tutor_profiles%'",
        );
        if (result.rows[0].n > 0) {
          observed = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(observed).toBe(true);
      await blocker.query("SELECT pg_sleep(1.1)");
      await blocker.query("COMMIT");
      const result = await pending;
      expect(result.error).toBeNull();
      expect(result.value?.state).toBe("demo_reserved");
      const rows = await world.owner.db
        .select()
        .from(bookings)
        .where(eq(bookings.tutorId, profile.id));
      expect(rows).toHaveLength(2);
      expect(rows.find((row) => row.id === old.id)?.state).toBe("demo_expired");
      const history = await world.owner.db
        .select()
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, old.id));
      expect(history).toHaveLength(2);
      expect(
        history
          .find((row) => row.event === "demo_expired")!
          .createdAt.getTime(),
      ).toBeGreaterThanOrEqual(expiresAt.getTime());
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
    }
  });

  it("records expiry after its deadline when the deadline passes during a lock wait", async () => {
    const { input, profile } = await fresh();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 1000);
    const [old] = await world.owner.db
      .insert(bookings)
      .values({
        source: "local_simulation",
        tutorId: profile.id,
        learnerId,
        bookedByUserId: parent.id,
        subjectId,
        startAtUtc: new Date(input.startAtUtc),
        endAtUtc: new Date(input.endAtUtc),
        displayTimezone: input.displayTimezone,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: bookingFingerprint(input),
        state: "demo_reserved",
        createdAt,
        expiresAt,
      })
      .returning();
    await world.owner.db
      .insert(bookingEvents)
      .values({ bookingId: old.id, event: "demo_reserved", createdAt });
    const blocker = await world.owner.pool.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
        [profile.id],
      );
      const pending = createDemoReservation(
        world.runtime,
        parent.headers,
        input,
      );
      await waitForTutorLock();
      await blocker.query("SELECT pg_sleep(1.1)");
      await blocker.query("COMMIT");
      expect((await pending).state).toBe("demo_expired");
      const history = await world.owner.db
        .select()
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, old.id));
      expect(history).toHaveLength(2);
      const expiry = history.find((row) => row.event === "demo_expired")!;
      expect(expiry.createdAt.getTime()).toBeGreaterThanOrEqual(
        expiresAt.getTime(),
      );
      expect(expiry.createdAt.getTime()).toBeGreaterThan(createdAt.getTime());
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
    }
  });

  it("records creation after a real lock wait with the same trusted mutation timestamp", async () => {
    await world.owner.pool.query("UPDATE rate_limit SET count=0");
    const data = await fresh();
    const blocker = await world.owner.pool.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
        [data.profile.id],
      );
      const pending = createDemoReservation(
        world.runtime,
        parent.headers,
        data.input,
      );
      await waitForTutorLock();
      await blocker.query("SELECT pg_sleep(0.03)");
      await blocker.query("COMMIT");
      const result = await pending;
      const row = (
        await world.owner.pool.query(
          "SELECT b.created_at=e.created_at AS same FROM bookings b JOIN booking_events e ON e.booking_id=b.id AND e.event='demo_reserved' WHERE b.id=$1",
          [result.id],
        )
      ).rows[0];
      expect(row.same).toBe(true);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
    }
  });

  it("composes optional languages and profile edits with booking eligibility and time off", async () => {
    const data = await combinedFixture();
    const profileInput = {
      headline: data.profile.headline,
      bio: data.profile.bio,
      teachingBackground: data.profile.teachingBackground,
      timezone: "Asia/Manila",
      offerings: [{ subjectId, levels: ["elementary", "college_support"] }],
    };
    const publicTutor = () =>
      findEligibleTutor(world.runtime.db, data.profile.slug);
    expect((await publicTutor())?.teachingLanguages).toEqual([]);
    await saveOwnTutorProfile(world.runtime, data.tutor.headers, {
      ...profileInput,
      teachingLanguages: ["en", "fil"],
    });
    await saveOwnTutorProfile(world.runtime, data.tutor.headers, profileInput);
    const declared = await publicTutor();
    expect(declared?.teachingLanguages.sort()).toEqual(["en", "fil"]);
    expect(
      filterTutors([declared!], {
        subject: "math",
        level: "elementary",
        language: "fil",
      }),
    ).toHaveLength(1);
    expect(
      filterTutors([declared!], {
        subject: "math",
        level: "high_school",
        language: "fil",
      }),
    ).toHaveLength(0);
    await saveOwnTimeOff(world.runtime, data.tutor.headers, data.timeOff);
    const candidates = await readDemoCandidates(
      world.runtime,
      parent.headers,
      data.choice,
    );
    expect(
      candidates.times.some(
        (time) => time.startAtUtc === data.input.startAtUtc,
      ),
    ).toBe(false);
    const reservation = await createDemoReservation(
      world.runtime,
      parent.headers,
      {
        ...data.input,
        startAtUtc: candidates.times[0].startAtUtc,
        endAtUtc: candidates.times[0].endAtUtc,
      },
    );
    await saveOwnTutorProfile(world.runtime, data.tutor.headers, {
      ...profileInput,
      teachingLanguages: [],
    });
    expect((await publicTutor())?.teachingLanguages).toEqual([]);
    const after = await readDemoCandidates(
      world.runtime,
      parent.headers,
      data.choice,
    );
    expect(
      after.times.some(
        (time) => time.startAtUtc === candidates.times[0].startAtUtc,
      ),
    ).toBe(false);
    const [stored] = await world.owner.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, reservation.id));
    expect(stored.state).toBe("demo_reserved");
    expect((await data.snapshot()).exceptions).toBe(1);
  });

  it("removes a role-revoked tutor from shared discovery and denies new bookings", async () => {
    await world.owner.pool.query("UPDATE rate_limit SET count=0");
    const data = await combinedFixture();
    expect(
      await findEligibleTutor(world.runtime.db, data.profile.slug),
    ).not.toBeNull();
    await world.owner.pool.query(
      "DELETE FROM user_roles WHERE user_id=$1 AND role='tutor'",
      [data.tutor.id],
    );
    expect(
      await findEligibleTutor(world.runtime.db, data.profile.slug),
    ).toBeNull();
    expect(
      (
        await handleDemoCandidateRead(
          world.runtime,
          new Request(
            `${world.runtime.origin}/api/bookings/demo/candidates?${new URLSearchParams(data.choice)}`,
            { headers: parent.headers },
          ),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await handleDemoBookingCreate(
          world.runtime,
          jsonRequest(world, "/api/bookings/demo", {
            cookie: parent.cookie,
            body: data.input,
          }),
        )
      ).status,
    ).toBe(409);
    expect((await data.snapshot()).reservations).toBe(0);
  });

  it("proves both queued booking/time-off race orders on the shared tutor lock", async () => {
    for (const first of ["time-off", "booking"] as const) {
      const data = await combinedFixture();
      const blocker = await world.owner.pool.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
          [data.profile.id],
        );
        const observe = (run: Promise<unknown>) =>
          run.then(
            (value) => ({ value, error: null }),
            (error: unknown) => ({ value: null, error }),
          );
        const reserve = () =>
          createDemoReservation(world.runtime, parent.headers, data.input);
        const add = () =>
          saveOwnTimeOff(world.runtime, data.tutor.headers, data.timeOff);
        const winner = observe(first === "booking" ? reserve() : add());
        await waitForTutorLock();
        const loser = observe(first === "booking" ? add() : reserve());
        await waitForTutorLock(2);
        await blocker.query("COMMIT");
        expect((await winner).error).toBeNull();
        expect((await loser).error).toMatchObject({ status: 409 });
        expect(await data.snapshot()).toEqual(
          first === "time-off"
            ? { version: 1, exceptions: 1, audits: 1, reservations: 0 }
            : { version: 0, exceptions: 0, audits: 0, reservations: 1 },
        );
        const candidates = await readDemoCandidates(
          world.runtime,
          parent.headers,
          data.choice,
        );
        expect(
          candidates.times.some(
            (time) => time.startAtUtc === data.input.startAtUtc,
          ),
        ).toBe(false);
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
      }
    }
  });
  it("rejects active time-off overlap atomically while allowing exactly adjacent intervals", async () => {
    const data = await combinedFixture();
    const saved = await createDemoReservation(
      world.runtime,
      parent.headers,
      data.input,
    );
    await expect(
      saveOwnTimeOff(world.runtime, data.tutor.headers, data.timeOff),
    ).rejects.toMatchObject({ status: 409 });
    expect(await data.snapshot()).toEqual({
      version: 0,
      exceptions: 0,
      audits: 0,
      reservations: 1,
    });
    const adjacentEnd = new Date(
      new Date(data.input.endAtUtc).getTime() + 3_600_000,
    ).toISOString();
    await saveOwnTimeOff(world.runtime, data.tutor.headers, {
      ...data.timeOff,
      startLocal: data.timeOff.endLocal,
      endLocal: data.local(adjacentEnd),
    });
    const adjacentStart = new Date(
      new Date(data.input.startAtUtc).getTime() - 3_600_000,
    ).toISOString();
    await saveOwnTimeOff(world.runtime, data.tutor.headers, {
      ...data.timeOff,
      version: 1,
      startLocal: data.local(adjacentStart),
      endLocal: data.timeOff.startLocal,
    });
    const before = await data.snapshot();
    await expect(
      saveOwnTimeOff(world.runtime, data.tutor.headers, {
        ...data.timeOff,
        version: 2,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await data.snapshot()).toEqual(before);
    expect(before).toEqual({
      version: 2,
      exceptions: 2,
      audits: 2,
      reservations: 1,
    });
    expect(
      (await createDemoReservation(world.runtime, parent.headers, data.input))
        .id,
    ).toBe(saved.id);
  });
  it("time off ignores elapsed reservations without cancelling or rewriting their history", async () => {
    const data = await combinedFixture();
    const [old] = await world.owner.db
      .insert(bookings)
      .values({
        source: "local_simulation",
        tutorId: data.profile.id,
        learnerId,
        bookedByUserId: parent.id,
        subjectId,
        startAtUtc: new Date(data.input.startAtUtc),
        endAtUtc: new Date(data.input.endAtUtc),
        displayTimezone: data.input.displayTimezone,
        idempotencyKey: data.input.idempotencyKey,
        requestFingerprint: bookingFingerprint(data.input),
        state: "demo_reserved",
        createdAt: new Date(Date.now() - 1_200_000),
        expiresAt: new Date(Date.now() - 600_000),
      })
      .returning();
    await world.owner.db
      .insert(bookingEvents)
      .values({ bookingId: old.id, event: "demo_reserved" });
    await saveOwnTimeOff(world.runtime, data.tutor.headers, data.timeOff);
    expect(await data.snapshot()).toEqual({
      version: 1,
      exceptions: 1,
      audits: 1,
      reservations: 1,
    });
    const retry = await createDemoReservation(
      world.runtime,
      parent.headers,
      data.input,
    );
    expect(retry).toMatchObject({ id: old.id, state: "demo_expired" });
    const [retained] = await world.owner.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, old.id));
    expect(retained.expiresAt).toEqual(old.expiresAt);
    expect(retained.requestFingerprint).toBe(old.requestFingerprint);
    expect(
      await world.owner.db
        .select()
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, old.id)),
    ).toHaveLength(2);
  });
  it("recovers an existing same-key result after the tutor becomes unavailable without creating a new reservation", async () => {
    const { input, profile } = await fresh();
    const saved = await createDemoReservation(
      world.runtime,
      parent.headers,
      input,
    );
    await world.owner.db
      .update(tutorProfiles)
      .set({ reviewStatus: "suspended" })
      .where(eq(tutorProfiles.id, profile.id));
    expect(
      (await createDemoReservation(world.runtime, parent.headers, input)).id,
    ).toBe(saved.id);
    await expect(
      createDemoReservation(world.runtime, parent.headers, {
        ...input,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await world.owner.db
        .select()
        .from(bookings)
        .where(eq(bookings.tutorId, profile.id)),
    ).toHaveLength(1);
  });
  it("revalidates after a queued schedule or suspension mutation wins the tutor lock", async () => {
    for (const mutation of ["schedule", "suspension"]) {
      const { profile, input } = await fresh();
      const blocker = await world.owner.pool.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
          [profile.id],
        );
        const queued = createDemoReservation(
          world.runtime,
          parent.headers,
          input,
        );
        const observed = queued.then(
          (value) => ({ value, error: null }),
          (error) => ({ value: null, error }),
        );
        await waitForTutorLock();
        if (mutation === "schedule") {
          await blocker.query(
            "DELETE FROM tutor_availability WHERE tutor_id=$1",
            [profile.id],
          );
          await blocker.query(
            "UPDATE tutor_profiles SET availability_version=availability_version+1 WHERE id=$1",
            [profile.id],
          );
        } else
          await blocker.query(
            "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
            [profile.id],
          );
        await blocker.query("COMMIT");
        expect((await observed).error).toMatchObject({ status: 409 });
        expect(
          await world.owner.db
            .select()
            .from(bookings)
            .where(eq(bookings.tutorId, profile.id)),
        ).toEqual([]);
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
      }
    }
  });
  it("rechecks a subject disabled while a booking is queued", async () => {
    const { profile, input } = await fresh();
    const blocker = await world.owner.pool.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
        [profile.id],
      );
      const observed = createDemoReservation(
        world.runtime,
        parent.headers,
        input,
      ).then(
        (value) => ({ value, error: null }),
        (error) => ({ value: null, error }),
      );
      await waitForTutorLock();
      await world.owner.db
        .update(subjects)
        .set({ isActive: false })
        .where(eq(subjects.id, subjectId));
      await blocker.query("COMMIT");
      expect((await observed).error).toMatchObject({ status: 409 });
      expect(
        await world.owner.db
          .select()
          .from(bookings)
          .where(eq(bookings.tutorId, profile.id)),
      ).toEqual([]);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      await world.owner.db
        .update(subjects)
        .set({ isActive: true })
        .where(eq(subjects.id, subjectId));
    }
  });
  it("persists UTC parent reservation with minimal state/event and no paid fields", async () => {
    const { input, profile } = await fresh();
    const result = await createDemoReservation(
      world.runtime,
      parent.headers,
      input,
    );
    expect(result.state).toBe("demo_reserved");
    expect(result.time.startAtUtc).toBe(input.startAtUtc);
    expect(result.time.zone).toMatch(/GMT-/);
    const [row] = await world.owner.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, result.id));
    expect(row.tutorId).toBe(profile.id);
    expect(row.learnerId).toBe(learnerId);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(600_000);
    expect(
      (
        await world.owner.db
          .select()
          .from(bookingEvents)
          .where(eq(bookingEvents.bookingId, result.id))
      ).map((e) => e.event),
    ).toEqual(["demo_reserved"]);
    expect(result).not.toHaveProperty("paid");
    expect(result).not.toHaveProperty("meetingUrl");
  });
  it("allows eligible self-managed College Support without guardian", async () => {
    const { input } = await fresh(self, selfId);
    expect(
      (await createDemoReservation(world.runtime, self.headers, input)).state,
    ).toBe("demo_reserved");
  });
  it("accepts one of concurrently overlapping distinct requests", async () => {
    const { input, candidates, profile } = await fresh();
    const second = {
      ...input,
      startAtUtc: candidates.times[1].startAtUtc,
      endAtUtc: candidates.times[1].endAtUtc,
      idempotencyKey: randomUUID(),
    };
    expect(new Date(second.startAtUtc).getTime()).toBeLessThan(
      new Date(input.endAtUtc).getTime(),
    );
    const outcomes = await Promise.allSettled([
      createDemoReservation(world.runtime, parent.headers, input),
      createDemoReservation(world.runtime, parent.headers, second),
    ]);
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
    const rows = await world.owner.db
      .select()
      .from(bookings)
      .where(eq(bookings.tutorId, profile.id));
    expect(rows).toHaveLength(1);
  });
  it("concurrent retries share one booking and one creation event", async () => {
    const { input } = await fresh();
    const outcomes = await Promise.all(
      Array.from({ length: 3 }, () =>
        createDemoReservation(world.runtime, parent.headers, input),
      ),
    );
    expect(new Set(outcomes.map((row) => row.id)).size).toBe(1);
    expect(
      await world.owner.db
        .select()
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, outcomes[0].id)),
    ).toHaveLength(1);
  });
  it("rejects reused key when payload changes, including a different tutor", async () => {
    const first = await fresh();
    await createDemoReservation(world.runtime, parent.headers, first.input);
    await expect(
      createDemoReservation(world.runtime, parent.headers, {
        ...first.input,
        displayTimezone: "UTC",
      }),
    ).rejects.toMatchObject({ status: 409 });
    const next = await fresh();
    await expect(
      createDemoReservation(world.runtime, parent.headers, {
        ...next.input,
        idempotencyKey: first.input.idempotencyKey,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("scopes same retry key to each authorized actor", async () => {
    const first = await fresh();
    const second = await fresh(other, foreignId);
    const results = await Promise.all([
      createDemoReservation(world.runtime, parent.headers, first.input),
      createDemoReservation(world.runtime, other.headers, {
        ...second.input,
        idempotencyKey: first.input.idempotencyKey,
      }),
    ]);
    expect(results[0].id).not.toBe(results[1].id);
  });
  it("rechecks stale slot and rejects off-grid, wrong-duration and notice/horizon requests", async () => {
    const { input, profile } = await fresh();
    for (const changed of [
      {
        startAtUtc: new Date(
          new Date(input.startAtUtc).getTime() + 60_000,
        ).toISOString(),
      },
      {
        endAtUtc: new Date(
          new Date(input.endAtUtc).getTime() + 60_000,
        ).toISOString(),
      },
      {
        startAtUtc: new Date().toISOString(),
        endAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
      },
      {
        startAtUtc: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        endAtUtc: new Date(
          Date.now() + 30 * 86_400_000 + 3_600_000,
        ).toISOString(),
      },
    ])
      await expect(
        createDemoReservation(world.runtime, parent.headers, {
          ...input,
          ...changed,
        }),
      ).rejects.toMatchObject({ status: 409 });
    await world.owner.db
      .delete(tutorAvailability)
      .where(eq(tutorAvailability.tutorId, profile.id));
    await expect(
      createDemoReservation(world.runtime, parent.headers, input),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects foreign learner, unrelated admin and anonymous access without disclosure", async () => {
    const { input } = await fresh();
    await expect(
      createDemoReservation(world.runtime, other.headers, input),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      createDemoReservation(world.runtime, parent.headers, {
        ...input,
        learnerId: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      createDemoReservation(world.runtime, admin.headers, input),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      createDemoReservation(world.runtime, new Headers(), input),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("rejects inactive/revoked learner and suspended/unverified/missing-role actor", async () => {
    const { input } = await fresh();
    for (const [change, restore] of [
      [
        "UPDATE learner_profiles SET status='inactive' WHERE id=$1",
        "UPDATE learner_profiles SET status='active' WHERE id=$1",
      ],
      [
        "UPDATE guardian_learner_links SET status='revoked' WHERE learner_id=$1",
        "UPDATE guardian_learner_links SET status='authorized' WHERE learner_id=$1",
      ],
    ]) {
      await world.owner.pool.query(change, [learnerId]);
      try {
        await expect(
          createDemoReservation(world.runtime, parent.headers, input),
        ).rejects.toMatchObject({ status: 404 });
      } finally {
        await world.owner.pool.query(restore, [learnerId]);
      }
    }
    await world.owner.pool.query(
      "UPDATE user_access SET status='suspended' WHERE user_id=$1",
      [parent.id],
    );
    try {
      await expect(
        createDemoReservation(world.runtime, parent.headers, input),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await world.owner.pool.query(
        "UPDATE user_access SET status='active' WHERE user_id=$1",
        [parent.id],
      );
    }
    await world.owner.pool.query(
      'UPDATE "user" SET email_verified=false WHERE id=$1',
      [parent.id],
    );
    try {
      await expect(
        createDemoReservation(world.runtime, parent.headers, input),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await world.owner.pool.query(
        'UPDATE "user" SET email_verified=true WHERE id=$1',
        [parent.id],
      );
    }
    await world.owner.pool.query(
      "DELETE FROM user_roles WHERE user_id=$1 AND role='parent'",
      [parent.id],
    );
    try {
      await expect(
        createDemoReservation(world.runtime, parent.headers, input),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await world.owner.pool.query(
        "INSERT INTO user_roles(user_id,role) VALUES ($1,'parent')",
        [parent.id],
      );
    }
  });
  it("rejects suspended/pending/unverified tutor, disabled subject and unsupported level", async () => {
    const { input, profile, ownerId } = await fresh();
    for (const state of ["suspended", "pending"]) {
      await world.owner.db
        .update(tutorProfiles)
        .set({ reviewStatus: state as "suspended" | "pending" })
        .where(eq(tutorProfiles.id, profile.id));
      await expect(
        createDemoReservation(world.runtime, parent.headers, input),
      ).rejects.toMatchObject({ status: 409 });
    }
    await world.owner.db
      .update(tutorProfiles)
      .set({ reviewStatus: "approved" })
      .where(eq(tutorProfiles.id, profile.id));
    await world.owner.pool.query(
      "UPDATE user_access SET status='suspended' WHERE user_id=$1",
      [ownerId],
    );
    await expect(
      createDemoReservation(world.runtime, parent.headers, input),
    ).rejects.toMatchObject({ status: 409 });
    await world.owner.pool.query(
      "UPDATE user_access SET status='active' WHERE user_id=$1",
      [ownerId],
    );
    await world.owner.pool.query(
      'UPDATE "user" SET email_verified=false WHERE id=$1',
      [ownerId],
    );
    await expect(
      createDemoReservation(world.runtime, parent.headers, input),
    ).rejects.toMatchObject({ status: 409 });
    await world.owner.pool.query(
      'UPDATE "user" SET email_verified=true WHERE id=$1',
      [ownerId],
    );
    await world.owner.db
      .update(subjects)
      .set({ isActive: false })
      .where(eq(subjects.id, subjectId));
    try {
      await expect(
        createDemoReservation(world.runtime, parent.headers, input),
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      await world.owner.db
        .update(subjects)
        .set({ isActive: true })
        .where(eq(subjects.id, subjectId));
    }
    await world.owner.pool.query(
      "UPDATE tutor_subjects SET levels=ARRAY['college_support'] WHERE tutor_id=$1",
      [profile.id],
    );
    await expect(
      createDemoReservation(world.runtime, parent.headers, input),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("materializes expiry, keeps history and never renews an expired retry", async () => {
    const { input, profile } = await fresh();
    const [old] = await world.owner.db
      .insert(bookings)
      .values({
        source: "local_simulation",
        tutorId: profile.id,
        learnerId,
        bookedByUserId: parent.id,
        subjectId,
        startAtUtc: new Date(input.startAtUtc),
        endAtUtc: new Date(input.endAtUtc),
        displayTimezone: input.displayTimezone,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: bookingFingerprint(input),
        state: "demo_reserved",
        createdAt: new Date(Date.now() - 1_200_000),
        expiresAt: new Date(Date.now() - 600_000),
      })
      .returning();
    await world.owner.db
      .insert(bookingEvents)
      .values({ bookingId: old.id, event: "demo_reserved" });
    const retry = await createDemoReservation(
      world.runtime,
      parent.headers,
      input,
    );
    expect(retry.id).toBe(old.id);
    expect(retry.state).toBe("demo_expired");
    const next = await createDemoReservation(world.runtime, parent.headers, {
      ...input,
      idempotencyKey: randomUUID(),
    });
    expect(next.id).not.toBe(old.id);
    expect(
      (
        await world.owner.db
          .select()
          .from(bookingEvents)
          .where(eq(bookingEvents.bookingId, old.id))
      )
        .map((row) => row.event)
        .sort(),
    ).toEqual(["demo_expired", "demo_reserved"]);
    expect(
      (await createDemoReservation(world.runtime, parent.headers, input)).state,
    ).toBe("demo_expired");
  });
  it("database exclusion protects concurrent raw inserts and permits adjacency", async () => {
    const { input, profile } = await fresh();
    const base = {
      source: "local_simulation" as const,
      tutorId: profile.id,
      learnerId,
      bookedByUserId: parent.id,
      subjectId,
      startAtUtc: new Date(input.startAtUtc),
      endAtUtc: new Date(input.endAtUtc),
      displayTimezone: "UTC",
      requestFingerprint: "a".repeat(64),
      state: "demo_reserved" as const,
      expiresAt: new Date(Date.now() + 600_000),
    };
    const outcomes = await Promise.allSettled([
      world.owner.db
        .insert(bookings)
        .values({ ...base, idempotencyKey: randomUUID() }),
      world.owner.db.insert(bookings).values({
        ...base,
        idempotencyKey: randomUUID(),
        startAtUtc: new Date(base.startAtUtc.getTime() + 1_800_000),
        endAtUtc: new Date(base.endAtUtc.getTime() + 1_800_000),
      }),
    ]);
    expect(outcomes.filter((row) => row.status === "fulfilled")).toHaveLength(
      1,
    );
    const [winner] = await world.owner.db
      .select()
      .from(bookings)
      .where(eq(bookings.tutorId, profile.id));
    await expect(
      world.owner.db.insert(bookings).values({
        ...base,
        idempotencyKey: randomUUID(),
        startAtUtc: winner.endAtUtc,
        endAtUtc: new Date(winner.endAtUtc.getTime() + 3_600_000),
      }),
    ).resolves.toBeDefined();
  });
  it("rolls back reservation when atomic history insert fails", async () => {
    const { input, profile } = await fresh();
    await world.owner.pool.query(
      "REVOKE INSERT ON booking_events FROM learli_app",
    );
    try {
      await expect(
        createDemoReservation(world.runtime, parent.headers, input),
      ).rejects.toBeDefined();
      expect(
        await world.owner.db
          .select()
          .from(bookings)
          .where(eq(bookings.tutorId, profile.id)),
      ).toEqual([]);
    } finally {
      await world.owner.pool.query(
        "GRANT INSERT ON booking_events TO learli_app",
      );
    }
    expect(
      (await createDemoReservation(world.runtime, parent.headers, input)).state,
    ).toBe("demo_reserved");
  });
  it("denies immutable rewrites, premature expiry, paid states and runtime deletions", async () => {
    const { input } = await fresh();
    const result = await createDemoReservation(
      world.runtime,
      parent.headers,
      input,
    );
    await expect(
      world.runtime.db
        .update(bookings)
        .set({ state: "demo_expired" })
        .where(eq(bookings.id, result.id)),
    ).rejects.toBeDefined();
    await expect(
      world.owner.pool.query(
        "UPDATE bookings SET start_at_utc=start_at_utc+interval '1 hour' WHERE id=$1",
        [result.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      world.runtime.db.delete(bookings).where(eq(bookings.id, result.id)),
    ).rejects.toBeDefined();
    await expect(
      world.owner.pool.query("UPDATE bookings SET state='paid' WHERE id=$1", [
        result.id,
      ]),
    ).rejects.toBeDefined();
  });
  it("stores same UTC instants despite viewer zone changes and real dated schedule", async () => {
    const { input } = await fresh(parent, learnerId, "America/New_York");
    const result = await createDemoReservation(
      world.runtime,
      parent.headers,
      input,
    );
    const retry = await createDemoReservation(
      world.runtime,
      parent.headers,
      input,
    );
    expect(retry.time.startAtUtc).toBe(result.time.startAtUtc);
    expect(result.tutorTime.zone).toMatch(/GMT-/);
  });
  it("same-origin bounded strict handler hides private details and applies no-store", async () => {
    const { input, choice } = await fresh();
    const response = await handleDemoBookingCreate(
      world.runtime,
      jsonRequest(world, "/api/bookings/demo", {
        body: input,
        cookie: parent.cookie,
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain(
      "private, no-store",
    );
    expect(
      (
        await handleDemoBookingCreate(
          world.runtime,
          jsonRequest(world, "/api/bookings/demo", {
            body: { ...input, state: "confirmed" },
            cookie: parent.cookie,
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handleDemoBookingCreate(
          world.runtime,
          jsonRequest(world, "/api/bookings/demo", {
            body: input,
            cookie: parent.cookie,
            origin: "https://attacker.test",
          }),
        )
      ).status,
    ).toBe(403);
    const read = await handleDemoCandidateRead(
      world.runtime,
      jsonRequest(
        world,
        `/api/bookings/demo/candidates?${new URLSearchParams(choice)}`,
        { method: "GET", cookie: other.cookie },
      ),
    );
    expect(read.status).toBe(404);
    expect(await read.text()).not.toContain(learnerId);
  });
});
