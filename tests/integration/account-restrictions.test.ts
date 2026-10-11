import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { handleAccountRestrictions } from "@/features/account-restrictions/handler";
import {
  listTargets,
  readTarget,
} from "@/features/account-restrictions/service";
import {
  provisionRestrictionTarget,
  authorizeRestrictionTarget,
  revokeRestrictionTarget,
} from "@/features/account-restrictions/fixture-tooling";
import { authorizeFixtureReviewer } from "@/features/support/fixture-tooling";
import { findEligibleTutor } from "@/features/tutors/eligibility";
import { handleTutorProfileRequest } from "@/features/tutors/handler";
import { handleLearnerRequest } from "@/features/learners/handler";
import { handleAccountRequest } from "@/features/account/handler";
import { handleBookingRead } from "@/features/bookings/read-handler";
import {
  readDemoCandidates,
  createDemoReservation,
} from "@/features/bookings/service";
import { handleDemoBookingCreate } from "@/features/bookings/handler";
import { handleAuthRequest } from "@/lib/auth-handler";
import {
  bookings,
  bookingEvents,
  learnerProfiles,
  session,
  tutorProfiles,
  tutorAvailability,
  tutorSubjects,
  userRoles,
  subjects,
} from "@/lib/db/schema";
import {
  closeWorld,
  createAccount,
  jsonRequest,
  openWorld,
  password,
  type TestAccount,
  type World,
} from "./support";
let world: World;
const change = (staff: TestAccount, target: string, body: unknown) =>
  handleAccountRestrictions(
    world.runtime,
    jsonRequest(world, `/api/admin/accounts/${target}`, {
      method: "PATCH",
      cookie: staff.cookie,
      body,
    }),
    target,
  );
const read = (staff: TestAccount, target?: string) =>
  handleAccountRestrictions(
    world.runtime,
    jsonRequest(world, `/api/admin/accounts${target ? "/" + target : ""}`, {
      method: "GET",
      cookie: staff.cookie,
    }),
    target,
  );
const payload = (
  revision = 0,
  status = "suspended",
  reason = status === "active" ? "local_restore_test" : "local_access_test",
) => ({ revision, status, reason, requestKey: randomUUID() });
async function setup() {
  const staff = await createAccount(
      world,
      ["admin"],
      "Synthetic authorized staff",
    ),
    target = await createAccount(world, ["student"], "Synthetic target");
  await provisionRestrictionTarget(world.owner, target.id);
  await authorizeRestrictionTarget(world.owner, staff.id, target.id);
  return { staff, target };
}
async function history(target: string) {
  return (
    await world.owner.pool.query(
      "SELECT * FROM account_restriction_events WHERE target_user_id=$1 ORDER BY revision",
      [target],
    )
  ).rows;
}
async function waitForFunction() {
  for (let i = 0; i < 100; i++) {
    const r = await world.owner.pool.query(
      "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%change_local_account_access%'",
    );
    if (r.rows[0].count > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(
    "Expected restriction function to wait on controlled database lock.",
  );
}
async function bookingFixture() {
  const { staff, target: student } = await setup(),
    tutor = await createAccount(
      world,
      ["tutor"],
      "Synthetic restriction tutor",
    );
  await provisionRestrictionTarget(world.owner, tutor.id);
  await authorizeRestrictionTarget(world.owner, staff.id, tutor.id);
  const [learner] = await world.owner.db
    .insert(learnerProfiles)
    .values({
      fixtureKey: randomUUID(),
      source: "local_fixture",
      management: "self",
      userId: student.id,
      displayName: "Private synthetic learner label",
      level: "college_support",
      timezone: "UTC",
    })
    .returning();
  const [math] = await world.owner.db
    .select()
    .from(subjects)
    .where(eq(subjects.slug, "math"));
  const [profile] = await world.owner.db
    .insert(tutorProfiles)
    .values({
      userId: tutor.id,
      slug: `restriction-${randomUUID()}`,
      headline: "Synthetic account boundary tutor",
      bio: "Local synthetic fixture only.",
      teachingBackground: "Fictional test fixture.",
      timezone: "UTC",
      reviewStatus: "approved",
    })
    .returning();
  await world.owner.db.insert(tutorSubjects).values({
    tutorId: profile.id,
    subjectId: math.id,
    levels: ["college_support"],
  });
  await world.owner.db.insert(tutorAvailability).values(
    Array.from({ length: 7 }, (_, i) => ({
      tutorId: profile.id,
      isoWeekday: i + 1,
      startMinute: 0,
      endMinute: 1440,
    })),
  );
  const choice = {
    learnerId: learner.id,
    tutorSlug: profile.slug,
    subjectSlug: "math",
    displayTimezone: "UTC",
  };
  const candidates = await readDemoCandidates(
    world.runtime,
    student.headers,
    choice,
  );
  const input = {
    ...choice,
    startAtUtc: candidates.times[0].startAtUtc,
    endAtUtc: candidates.times[0].endAtUtc,
    idempotencyKey: randomUUID(),
  };
  const booking = await createDemoReservation(
    world.runtime,
    student.headers,
    input,
  );
  return { staff, student, tutor, learner, profile, input, booking };
}
describe("scoped local account restriction boundary against real PostgreSQL", () => {
  beforeAll(() => {
    world = openWorld();
  });
  beforeEach(() => world.owner.pool.query("UPDATE rate_limit SET count=0"));
  afterAll(async () => {
    await world.owner.pool.query("UPDATE rate_limit SET count=0");
    await closeWorld(world);
  });
  it("exact authorize/suspend/restore saves minimal history atomically and retains sessions", async () => {
    const { staff, target } = await setup();
    const sessions = await world.owner.db
      .select()
      .from(session)
      .where(eq(session.userId, target.id));
    expect((await read(staff)).status).toBe(200);
    expect(
      (await listTargets(world.runtime, staff.headers)).targets.map(
        (t) => t.id,
      ),
    ).toContain(target.id);
    const first = payload();
    expect((await change(staff, target.id, first)).status).toBe(200);
    expect(
      (await readTarget(world.runtime, staff.headers, target.id)).status,
    ).toBe("suspended");
    expect((await change(staff, target.id, payload(1, "active"))).status).toBe(
      200,
    );
    const detail = await readTarget(world.runtime, staff.headers, target.id);
    expect(detail.revision).toBe(2);
    expect(detail.history.map((e) => e.nextStatus)).toEqual([
      "active",
      "suspended",
    ]);
    const events = await history(target.id);
    expect(events).toHaveLength(2);
    expect(events[0].actor_user_id).toBe(staff.id);
    expect(events[0].previous_status).toBe("active");
    expect(events[1].reason).toBe("local_restore_test");
    expect(
      await world.owner.db
        .select()
        .from(session)
        .where(eq(session.userId, target.id)),
    ).toEqual(sessions);
  });
  it("support capability and admin role alone never grant target authority; foreign/missing/admin/self match", async () => {
    const { staff, target } = await setup(),
      other = await createAccount(world, ["admin", "parent"]),
      plain = await createAccount(world, ["student"]);
    await authorizeFixtureReviewer(world.owner, other.id);
    for (const id of [target.id, staff.id, other.id, "missing"]) {
      const denied = await read(other, id);
      expect(denied.status).toBe(404);
      expect(await denied.json()).toEqual({
        message: "This account is not available.",
      });
      expect((await change(other, id, payload())).status).toBe(404);
    }
    expect((await read(plain, target.id)).status).toBe(403);
    expect((await listTargets(world.runtime, other.headers)).targets).toEqual(
      [],
    );
    await expect(
      provisionRestrictionTarget(world.owner, other.id),
    ).rejects.toThrow();
    await expect(
      authorizeRestrictionTarget(world.owner, staff.id, staff.id),
    ).rejects.toThrow();
    expect(await history(target.id)).toHaveLength(0);
  });
  it("an unprovisioned .test account is never a restriction target", async () => {
    const { staff } = await setup(),
      target = await createAccount(world);
    expect((await change(staff, target.id, payload())).status).toBe(404);
    await expect(
      authorizeRestrictionTarget(world.owner, staff.id, target.id),
    ).rejects.toThrow("Provision");
  });
  it("new admin target role excludes even a previously authorized fixture", async () => {
    const { staff, target } = await setup();
    await world.owner.db
      .insert(userRoles)
      .values({ userId: target.id, role: "admin" });
    expect((await read(staff, target.id)).status).toBe(404);
    expect((await change(staff, target.id, payload())).status).toBe(404);
    expect(
      (await listTargets(world.runtime, staff.headers)).targets.map(
        (t) => t.id,
      ),
    ).not.toContain(target.id);
  });
  it("owner grant/revoke is idempotent, runtime cannot provision or mutate grant/status/history", async () => {
    const { staff, target } = await setup();
    await authorizeRestrictionTarget(world.owner, staff.id, target.id);
    for (const query of [
      "UPDATE user_access SET status='suspended' WHERE user_id=$1",
      "UPDATE account_restriction_targets SET revision=2 WHERE user_id=$1",
      "UPDATE account_restriction_grants SET status='revoked' WHERE target_user_id=$1",
      "DELETE FROM account_restriction_events WHERE target_user_id=$1",
      "INSERT INTO account_restriction_targets(user_id,source) VALUES($1,'local_fixture')",
      "INSERT INTO account_restriction_grant_events(staff_user_id,target_user_id,action) VALUES($1,$1,'authorized')",
    ])
      await expect(
        world.runtime.pool.query(query, [target.id]),
      ).rejects.toMatchObject({ code: "42501" });
    await revokeRestrictionTarget(world.owner, staff.id, target.id);
    await revokeRestrictionTarget(world.owner, staff.id, target.id);
    expect((await read(staff, target.id)).status).toBe(404);
    expect((await change(staff, target.id, payload())).status).toBe(404);
    await expect(
      authorizeRestrictionTarget(world.owner, staff.id, target.id),
    ).rejects.toThrow("revoked");
    expect(
      (
        await world.owner.pool.query(
          "SELECT action FROM account_restriction_grant_events WHERE staff_user_id=$1 AND target_user_id=$2 ORDER BY created_at",
          [staff.id, target.id],
        )
      ).rows.map((r) => r.action),
    ).toEqual(["authorized", "revoked"]);
  });
  it("stale racing edits allow one transition, exact racing replay creates one event", async () => {
    const { staff, target } = await setup();
    const a = payload(),
      b = payload(0, "suspended", "local_review_test");
    const replies = await Promise.all([
      change(staff, target.id, a),
      change(staff, target.id, b),
    ]);
    expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await history(target.id)).toHaveLength(1);
    const restore = payload(1, "active");
    const duplicate = await Promise.all([
      change(staff, target.id, restore),
      change(staff, target.id, restore),
    ]);
    expect(duplicate.map((r) => r.status)).toEqual([200, 200]);
    expect(
      (await Promise.all(duplicate.map((r) => r.json())))
        .map((r) => r.replayed)
        .sort(),
    ).toEqual([false, true]);
    expect(await history(target.id)).toHaveLength(2);
    expect(
      (
        await change(staff, target.id, {
          ...restore,
          reason: "local_access_test",
          status: "suspended",
        })
      ).status,
    ).toBe(409);
  });
  it("a replay returns the old recorded result after restoration without reviving the old state", async () => {
    const { staff, target } = await setup(),
      first = payload();
    await change(staff, target.id, first);
    await change(staff, target.id, payload(1, "active"));
    const replay = await change(staff, target.id, first);
    expect(await replay.json()).toEqual({
      status: "suspended",
      revision: 1,
      replayed: true,
    });
    expect(
      (await readTarget(world.runtime, staff.headers, target.id)).status,
    ).toBe("active");
    expect(await history(target.id)).toHaveLength(2);
  });
  it("same actor/key racing across targets conflicts instead of duplicate history", async () => {
    const { staff, target } = await setup(),
      other = await createAccount(world);
    await provisionRestrictionTarget(world.owner, other.id);
    await authorizeRestrictionTarget(world.owner, staff.id, other.id);
    const input = payload();
    const responses = await Promise.all([
      change(staff, target.id, input),
      change(staff, other.id, input),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (await history(target.id)).length + (await history(other.id)).length,
    ).toBe(1);
  });
  for (const kind of [
    "grant",
    "actor_role",
    "actor_status",
    "actor_verified",
    "session",
    "target_admin",
  ] as const)
    it(`fresh checks deny ${kind} revocation committed during target lock wait`, async () => {
      const { staff, target } = await setup();
      const blocker = await world.owner.pool.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          "SELECT user_id FROM account_restriction_targets WHERE user_id=$1 FOR UPDATE",
          [target.id],
        );
        const pending = change(staff, target.id, payload());
        await waitForFunction();
        if (kind === "grant")
          await blocker.query(
            "UPDATE account_restriction_grants SET status='revoked' WHERE staff_user_id=$1 AND target_user_id=$2",
            [staff.id, target.id],
          );
        if (kind === "actor_role")
          await blocker.query(
            "DELETE FROM user_roles WHERE user_id=$1 AND role='admin'",
            [staff.id],
          );
        if (kind === "actor_status")
          await blocker.query(
            "UPDATE user_access SET status='suspended' WHERE user_id=$1",
            [staff.id],
          );
        if (kind === "actor_verified")
          await blocker.query(
            'UPDATE "user" SET email_verified=false WHERE id=$1',
            [staff.id],
          );
        if (kind === "session")
          await blocker.query("DELETE FROM session WHERE user_id=$1", [
            staff.id,
          ]);
        if (kind === "target_admin")
          await blocker.query(
            "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
            [target.id],
          );
        await blocker.query("COMMIT");
        expect((await pending).status).toBe(
          kind === "grant" || kind === "target_admin" ? 404 : 403,
        );
        expect(await history(target.id)).toHaveLength(0);
        expect(
          (
            await world.owner.pool.query(
              "SELECT status FROM user_access WHERE user_id=$1",
              [target.id],
            )
          ).rows[0].status,
        ).toBe("active");
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
      }
    });
  it("mutation/audit rollback is atomic and both histories are immutable", async () => {
    const { staff, target } = await setup();
    const current = await world.runtime.auth.api.getSession({
      headers: staff.headers,
    });
    if (!current) throw Error();
    const tx = await world.owner.pool.connect();
    try {
      await tx.query("BEGIN");
      const r = await tx.query(
        "SELECT * FROM public.change_local_account_access($1,$2,$3,0,'suspended','local_access_test',$4)",
        [staff.id, current.session.id, target.id, randomUUID()],
      );
      expect(r.rows[0].outcome).toBe("saved");
      await tx.query("ROLLBACK");
    } finally {
      tx.release();
    }
    expect(
      (await readTarget(world.runtime, staff.headers, target.id)).revision,
    ).toBe(0);
    expect(await history(target.id)).toHaveLength(0);
    await change(staff, target.id, payload());
    for (const table of [
      "account_restriction_events",
      "account_restriction_grant_events",
    ]) {
      await expect(
        world.owner.pool.query(
          `UPDATE ${table} SET created_at=now() WHERE target_user_id=$1`,
          [target.id],
        ),
      ).rejects.toMatchObject({ code: "55000" });
      await expect(
        world.owner.pool.query(`DELETE FROM ${table} WHERE target_user_id=$1`, [
          target.id,
        ]),
      ).rejects.toMatchObject({ code: "55000" });
    }
  });
  it("installed function has fixed search path, no PUBLIC execute and no forged session authority", async () => {
    const { staff, target } = await setup();
    const config = await world.owner.pool.query(
      "SELECT prosecdef,proconfig,NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(proacl,acldefault('f',proowner))) WHERE grantee=0 AND privilege_type='EXECUTE') AS private FROM pg_proc WHERE oid='public.change_local_account_access(text,text,text,integer,text,text,uuid)'::regprocedure",
    );
    expect(config.rows[0]).toEqual({
      prosecdef: true,
      proconfig: ["search_path=pg_catalog"],
      private: true,
    });
    const result = await world.runtime.pool.query(
      "SELECT * FROM public.change_local_account_access($1,'forged',$2,0,'suspended','local_access_test',$3)",
      [staff.id, target.id, randomUUID()],
    );
    expect(result.rows[0].outcome).toBe("forbidden");
  });
  it("stored cookies lose current Learli booking/read/profile access, while history and sessions remain; restore preserves other gates", async () => {
    const f = await bookingFixture();
    const before = await world.owner.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, f.booking.id));
    const events = await world.owner.db
      .select()
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, f.booking.id));
    const sessions = await world.owner.db
      .select()
      .from(session)
      .where(eq(session.userId, f.student.id));
    const learnerBefore = (
      await world.owner.db
        .select()
        .from(learnerProfiles)
        .where(eq(learnerProfiles.id, f.learner.id))
    )[0];
    const accountBefore = (
      await world.owner.pool.query(
        'SELECT name,timezone FROM "user" WHERE id=$1',
        [f.student.id],
      )
    ).rows[0];
    expect(
      (
        await handleBookingRead(
          world.runtime,
          jsonRequest(world, `/api/bookings/${f.booking.id}?scope=student`, {
            method: "GET",
            cookie: f.student.cookie,
          }),
          f.booking.id,
        )
      ).status,
    ).toBe(200);
    await change(f.staff, f.student.id, payload());
    expect(
      (
        await handleDemoBookingCreate(
          world.runtime,
          jsonRequest(world, "/api/bookings/demo", {
            cookie: f.student.cookie,
            body: { ...f.input, idempotencyKey: randomUUID() },
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handleBookingRead(
          world.runtime,
          jsonRequest(world, `/api/bookings/${f.booking.id}?scope=student`, {
            method: "GET",
            cookie: f.student.cookie,
          }),
          f.booking.id,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await handleLearnerRequest(
          world.runtime,
          jsonRequest(world, `/api/learners/${f.learner.id}`, {
            method: "PATCH",
            cookie: f.student.cookie,
            body: {
              displayName: "Changed",
              level: "college_support",
              timezone: "UTC",
            },
          }),
          f.learner.id,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handleAccountRequest(
          world.runtime,
          jsonRequest(world, `/api/account/${f.student.id}`, {
            method: "PATCH",
            cookie: f.student.cookie,
            body: { name: "Changed", timezone: "UTC" },
          }),
          f.student.id,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await world.owner.db
          .select()
          .from(learnerProfiles)
          .where(eq(learnerProfiles.id, f.learner.id))
      )[0],
    ).toEqual(learnerBefore);
    expect(
      (
        await world.owner.pool.query(
          'SELECT name,timezone FROM "user" WHERE id=$1',
          [f.student.id],
        )
      ).rows[0],
    ).toEqual(accountBefore);
    const signIn = await handleAuthRequest(
      world.runtime,
      jsonRequest(world, "/api/auth/sign-in/email", {
        body: { email: f.student.email, password },
      }),
    );
    expect(signIn.status).not.toBe(200);
    expect(
      await world.owner.db
        .select()
        .from(session)
        .where(eq(session.userId, f.student.id)),
    ).toEqual(sessions);
    expect(
      await world.owner.db
        .select()
        .from(bookings)
        .where(eq(bookings.id, f.booking.id)),
    ).toEqual(before);
    expect(
      await world.owner.db
        .select()
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, f.booking.id)),
    ).toEqual(events);
    await change(f.staff, f.student.id, payload(1, "active"));
    expect(
      (
        await handleBookingRead(
          world.runtime,
          jsonRequest(world, `/api/bookings/${f.booking.id}?scope=student`, {
            method: "GET",
            cookie: f.student.cookie,
          }),
          f.booking.id,
        )
      ).status,
    ).toBe(200);
    await change(f.staff, f.tutor.id, payload());
    expect(
      (
        await handleBookingRead(
          world.runtime,
          jsonRequest(world, `/api/bookings/${f.booking.id}?scope=tutor`, {
            method: "GET",
            cookie: f.tutor.cookie,
          }),
          f.booking.id,
        )
      ).status,
    ).toBe(404);
    expect(
      await findEligibleTutor(world.runtime.db, f.profile.slug),
    ).toBeNull();
    expect(
      (
        await handleTutorProfileRequest(
          world.runtime,
          jsonRequest(world, "/api/tutor/profile", {
            method: "PUT",
            cookie: f.tutor.cookie,
            body: {},
          }),
        )
      ).status,
    ).toBe(403);
    await expect(
      readDemoCandidates(world.runtime, f.student.headers, {
        learnerId: f.learner.id,
        tutorSlug: f.profile.slug,
        subjectSlug: "math",
        displayTimezone: "UTC",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await world.owner.db
      .update(tutorProfiles)
      .set({ reviewStatus: "suspended" })
      .where(eq(tutorProfiles.id, f.profile.id));
    const oldCreated = new Date(Date.now() - 1_200_000);
    const oldExpiry = new Date(Date.now() - 600_000);
    const [expired] = await world.owner.db
      .insert(bookings)
      .values({
        ...before[0],
        id: randomUUID(),
        idempotencyKey: randomUUID(),
        startAtUtc: new Date(before[0].startAtUtc.getTime() + 86_400_000),
        endAtUtc: new Date(before[0].endAtUtc.getTime() + 86_400_000),
        createdAt: oldCreated,
        expiresAt: oldExpiry,
        state: "demo_reserved",
      })
      .returning();
    await world.owner.db.insert(bookingEvents).values({
      bookingId: expired.id,
      event: "demo_reserved",
      createdAt: oldCreated,
    });
    await world.owner.db
      .update(bookings)
      .set({ state: "demo_expired" })
      .where(eq(bookings.id, expired.id));
    await world.owner.db.insert(bookingEvents).values({
      bookingId: expired.id,
      event: "demo_expired",
      createdAt: new Date(),
    });
    const expiredHistory = await world.owner.db
      .select()
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, expired.id));
    await change(f.staff, f.tutor.id, payload(1, "active"));
    expect(
      await findEligibleTutor(world.runtime.db, f.profile.slug),
    ).toBeNull();
    expect(
      (
        await world.owner.db
          .select()
          .from(bookings)
          .where(eq(bookings.id, expired.id))
      )[0].state,
    ).toBe("demo_expired");
    expect(
      await world.owner.db
        .select()
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, expired.id)),
    ).toEqual(expiredHistory);
    expect(
      await world.owner.db
        .select()
        .from(bookings)
        .where(eq(bookings.id, f.booking.id)),
    ).toEqual(before);
    expect(
      (
        await world.owner.db
          .select()
          .from(tutorProfiles)
          .where(eq(tutorProfiles.id, f.profile.id))
      )[0].reviewStatus,
    ).toBe("suspended");
  });
  it("origin/method/body/identity/privacy boundaries refuse malicious input safely", async () => {
    const { staff, target } = await setup();
    const body = payload();
    for (const bad of [
      { ...body, userId: target.id },
      { ...body, actorUserId: staff.id },
      { ...body, reason: "real_misconduct" },
      { ...body, revision: -1 },
      { ...body, requestKey: "bad" },
      { ...body, status: "active" },
      { ...body, note: "Sensitive text" },
    ])
      expect((await change(staff, target.id, bad)).status).toBe(400);
    expect(
      (
        await handleAccountRestrictions(
          world.runtime,
          jsonRequest(world, `/api/admin/accounts/${target.id}`, {
            method: "PATCH",
            cookie: staff.cookie,
            body,
            origin: "https://foreign.test",
          }),
          target.id,
        )
      ).status,
    ).toBe(403);
    for (const suffix of [
      "?page=1&page=2",
      "?actorUserId=" + staff.id,
      "?page=1001",
    ]) {
      expect(
        (
          await handleAccountRestrictions(
            world.runtime,
            jsonRequest(world, "/api/admin/accounts" + suffix, {
              method: "GET",
              cookie: staff.cookie,
            }),
          )
        ).status,
      ).toBe(400);
    }
    const anonymous = await handleAccountRestrictions(
      world.runtime,
      jsonRequest(world, "/api/admin/accounts", { method: "GET" }),
    );
    expect(anonymous.status).toBe(401);
    expect(
      (
        await handleAccountRestrictions(
          world.runtime,
          jsonRequest(world, "/api/admin/accounts", {
            method: "POST",
            cookie: staff.cookie,
            body,
          }),
        )
      ).status,
    ).toBe(405);
    const response = await read(staff, target.id);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    const text = await response.text();
    for (const privateValue of [
      staff.email,
      target.email,
      staff.id,
      staff.cookie,
      target.cookie,
    ])
      expect(text.includes(privateValue)).toBe(false);
    expect(
      (
        await handleAccountRestrictions(
          null,
          jsonRequest(world, "/api/admin/accounts", { method: "GET" }),
        )
      ).status,
    ).toBe(503);
  });
});
