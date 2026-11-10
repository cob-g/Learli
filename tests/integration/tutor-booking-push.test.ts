import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createLocalAuth } from "@/lib/auth-factory";
import {
  subscribeStudentBookings,
  subscribeTutorBookings,
} from "@/features/tutors/booking-notification-server";
import { GET as events } from "@/app/api/tutor/bookings/events/route";
import { GET as studentEvents } from "@/app/api/student/bookings/events/route";
import { GET as parentEvents } from "@/app/api/parent/bookings/events/route";
import { closeWorld, createAccount, openWorld, type World } from "./support";

vi.mock("server-only", () => ({}));
const routeRuntime = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock("@/lib/auth", () => ({
  getDomainAuthRuntime: async () => routeRuntime.value,
}));
let world: World;
let secondRuntime: ReturnType<typeof createLocalAuth>;
let tutorId: string;
let otherTutorId: string;
let ownerId: string;
let learnerId: string;
let subjectId: string;
let tutorCookie: string;
let tutorUserId: string;
let parentCookie: string;
let studentCookie: string;
let studentUserId: string;
let selfLearnerId: string;
const stops: (() => void)[] = [];

beforeAll(async () => {
  world = openWorld();
  secondRuntime = createLocalAuth(process.env);
  const tutor = await createAccount(world, ["tutor"]);
  const other = await createAccount(world, ["tutor"]);
  const guardian = await createAccount(world, ["parent"]);
  const student = await createAccount(world, ["student", "parent"]);
  tutorCookie = tutor.cookie;
  tutorUserId = tutor.id;
  parentCookie = guardian.cookie;
  studentCookie = student.cookie;
  studentUserId = student.id;
  routeRuntime.value = world.runtime;
  ownerId = guardian.id;
  const profile = async (userId: string) =>
    (
      await world.owner.pool.query<{ id: string }>(
        "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Synthetic','Synthetic biography','Synthetic background','Etc/UTC','approved') RETURNING id",
        [userId, `push-${randomUUID()}`],
      )
    ).rows[0].id;
  tutorId = await profile(tutor.id);
  otherTutorId = await profile(other.id);
  learnerId = (
    await world.owner.pool.query<{ id: string }>(
      "INSERT INTO learner_profiles(fixture_key,source,management,display_name,level,timezone) VALUES($1,'local_fixture','guardian','Synthetic learner','elementary','Etc/UTC') RETURNING id",
      [randomUUID()],
    )
  ).rows[0].id;
  selfLearnerId = (
    await world.owner.pool.query<{ id: string }>(
      "INSERT INTO learner_profiles(fixture_key,source,management,user_id,display_name,level,timezone) VALUES($1,'local_fixture','self',$2,'Synthetic student','college_support','Etc/UTC') RETURNING id",
      [randomUUID(), student.id],
    )
  ).rows[0].id;
  await world.owner.pool.query(
    "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
    [student.id, learnerId],
  );
  subjectId = (
    await world.owner.pool.query<{ id: string }>(
      "SELECT id FROM subjects WHERE slug='math'",
    )
  ).rows[0].id;
}, 60_000);
afterAll(async () => {
  for (const stop of stops) stop();
  await secondRuntime?.pool.end();
  await closeWorld(world);
});

describe("transactional Student booking notifications", () => {
  it("delivers only committed changes to subscribers for the corresponding learner", async () => {
    const own = vi.fn();
    const child = vi.fn();
    stops.push(
      await subscribeStudentBookings(
        world.runtime,
        studentUserId,
        [selfLearnerId],
        own,
        vi.fn(),
      ),
    );
    stops.push(
      await subscribeStudentBookings(
        world.runtime,
        "synthetic-child-subscriber",
        [learnerId],
        child,
        vi.fn(),
      ),
    );
    const client = await world.owner.pool.connect();
    const insert = (learner: string, day: number) =>
      client.query(
        "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) VALUES($1,'local_simulation',$2,$3,$4,$5,date_trunc('hour',clock_timestamp()) + ($6 * interval '1 day'),date_trunc('hour',clock_timestamp()) + ($6 * interval '1 day') + interval '1 hour','Etc/UTC',$7,$8,'demo_reserved',clock_timestamp(),clock_timestamp()+interval '10 minutes')",
        [
          randomUUID(),
          tutorId,
          learner,
          studentUserId,
          subjectId,
          day,
          randomUUID(),
          "b".repeat(64),
        ],
      );
    try {
      await client.query("BEGIN");
      await insert(selfLearnerId, 8);
      await client.query("ROLLBACK");
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(own).not.toHaveBeenCalled();
      await insert(learnerId, 9);
      await insert(selfLearnerId, 10);
      await expect.poll(() => own.mock.calls.length).toBe(1);
      await expect.poll(() => child.mock.calls.length).toBe(1);
    } finally {
      client.release();
    }
  });

  it("scopes the Parent stream to authorized children and closes after authority is revoked", async () => {
    const request = (cookie?: string, extra: Record<string, string> = {}) =>
      new Request(`${world.runtime.origin}/api/parent/bookings/events`, {
        headers: { ...(cookie ? { cookie } : {}), ...extra },
      });
    expect((await parentEvents(request())).status).toBe(401);
    expect((await parentEvents(request(parentCookie))).status).toBe(404);
    expect(
      (
        await parentEvents(
          request(studentCookie, { "sec-fetch-site": "cross-site" }),
        )
      ).status,
    ).toBe(403);
    const response = await parentEvents(request(studentCookie));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      "event: changed",
    );
    await world.owner.pool.query(
      "SELECT pg_notify('learli_student_booking',$1)",
      [selfLearnerId],
    );
    const pending = reader.read();
    let received = false;
    void pending.then(() => {
      received = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(received).toBe(false);
    await world.owner.pool.query(
      "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1 AND learner_id=$2",
      [studentUserId, learnerId],
    );
    await world.owner.pool.query(
      "SELECT pg_notify('learli_student_booking',$1)",
      [learnerId],
    );
    const closed = await Promise.race([
      pending,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Revoked Parent stream did not close")),
          3_000,
        ),
      ),
    ]);
    expect(closed.done).toBe(true);
  });

  it("rejects unrelated or cross-origin requests and closes a revoked Student stream", async () => {
    const request = (cookie?: string, extra: Record<string, string> = {}) =>
      new Request(`${world.runtime.origin}/api/student/bookings/events`, {
        headers: { ...(cookie ? { cookie } : {}), ...extra },
      });
    expect((await studentEvents(request())).status).toBe(401);
    expect((await studentEvents(request(parentCookie))).status).toBe(403);
    expect(
      (
        await studentEvents(
          request(studentCookie, { "sec-fetch-site": "cross-site" }),
        )
      ).status,
    ).toBe(403);
    const response = await studentEvents(request(studentCookie));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
    const reader = response.body!.getReader();
    const initial = await reader.read();
    expect(new TextDecoder().decode(initial.value)).toContain("event: changed");
    await world.owner.pool.query(
      "DELETE FROM user_roles WHERE user_id=$1 AND role='student'",
      [studentUserId],
    );
    await world.owner.pool.query(
      "SELECT pg_notify('learli_student_booking',$1)",
      [selfLearnerId],
    );
    const result = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Revoked stream did not close")),
          3_000,
        ),
      ),
    ]);
    expect(result.done).toBe(true);
  });
});

it("closes an expired Parent session on heartbeat without a booking event or provider refetch", async () => {
  await world.owner.pool.query(
    "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
    [ownerId, learnerId],
  );
  const sessions = await world.owner.pool.query<{
    id: string;
    expires_at: Date;
  }>("SELECT id,expires_at FROM session WHERE user_id=$1", [ownerId]);
  const interval = vi.spyOn(globalThis, "setInterval");
  const controller = new AbortController();
  try {
    const response = await parentEvents(
      new Request(`${world.runtime.origin}/api/parent/bookings/events`, {
        headers: { cookie: parentCookie },
        signal: controller.signal,
      }),
    );
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      "event: changed",
    );
    const heartbeat = interval.mock.calls.find(
      (call) => call[1] === 25000,
    )?.[0];
    if (typeof heartbeat !== "function")
      throw new Error("Expected authorization heartbeat");
    const provider = vi.spyOn(world.runtime.auth.api, "getSession");
    try {
      await world.owner.pool.query(
        "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
        [ownerId],
      );
      heartbeat();
      const result = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(new Error("Expired stream did not close on heartbeat")),
            3000,
          ),
        ),
      ]);
      expect(result.done).toBe(true);
      expect(provider).not.toHaveBeenCalled();
    } finally {
      provider.mockRestore();
    }
  } finally {
    controller.abort();
    interval.mockRestore();
    for (const session of sessions.rows)
      await world.owner.pool.query(
        "UPDATE session SET expires_at=$2 WHERE id=$1",
        [session.id, session.expires_at],
      );
  }
});

describe("transactional Tutor booking notifications", () => {
  it("delivers committed changes across separate runtime pools and filters unrelated tutors", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const unrelated = vi.fn();
    stops.push(
      await subscribeTutorBookings(
        world.runtime,
        "synthetic-a",
        tutorId,
        first,
        vi.fn(),
      ),
    );
    stops.push(
      await subscribeTutorBookings(
        secondRuntime,
        "synthetic-a",
        tutorId,
        second,
        vi.fn(),
      ),
    );
    stops.push(
      await subscribeTutorBookings(
        world.runtime,
        "synthetic-b",
        otherTutorId,
        unrelated,
        vi.fn(),
      ),
    );

    const client = await world.owner.pool.connect();
    const insert = async () =>
      client.query(
        "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) VALUES($1,'local_simulation',$2,$3,$4,$5,date_trunc('hour',clock_timestamp()) + interval '2 days',date_trunc('hour',clock_timestamp()) + interval '2 days 1 hour','Etc/UTC',$6,$7,'demo_reserved',clock_timestamp(),clock_timestamp()+interval '10 minutes')",
        [
          randomUUID(),
          tutorId,
          learnerId,
          ownerId,
          subjectId,
          randomUUID(),
          "a".repeat(64),
        ],
      );
    try {
      await client.query("BEGIN");
      await insert();
      await client.query("ROLLBACK");
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(first).not.toHaveBeenCalled();
      expect(second).not.toHaveBeenCalled();
      await client.query("BEGIN");
      await insert();
      expect(first).not.toHaveBeenCalled();
      await client.query("COMMIT");
      await expect.poll(() => first.mock.calls.length).toBe(1);
      await expect.poll(() => second.mock.calls.length).toBe(1);
      expect(unrelated).not.toHaveBeenCalled();
    } finally {
      client.release();
    }
  });

  it("rejects unrelated or cross-origin requests and terminates a revoked Tutor stream", async () => {
    const request = (cookie?: string, extra: Record<string, string> = {}) =>
      new Request(`${world.runtime.origin}/api/tutor/bookings/events`, {
        headers: { ...(cookie ? { cookie } : {}), ...extra },
      });
    expect((await events(request())).status).toBe(401);
    expect((await events(request(parentCookie))).status).toBe(403);
    expect(
      (await events(request(tutorCookie, { "sec-fetch-site": "cross-site" })))
        .status,
    ).toBe(403);
    const response = await events(request(tutorCookie));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
    const reader = response.body!.getReader();
    const initial = await reader.read();
    expect(new TextDecoder().decode(initial.value)).toContain("event: changed");
    await world.owner.pool.query(
      "DELETE FROM user_roles WHERE user_id=$1 AND role='tutor'",
      [tutorUserId],
    );
    await world.owner.pool.query(
      "SELECT pg_notify('learli_tutor_booking',$1)",
      [tutorId],
    );
    const result = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Revoked stream did not close")),
          3_000,
        ),
      ),
    ]);
    expect(result.done).toBe(true);
  });

  it("closes streams after listener failure and re-subscribes on recovery", async () => {
    const disconnected = vi.fn();
    const change = vi.fn();
    stops.push(
      await subscribeTutorBookings(
        secondRuntime,
        "synthetic-reconnect",
        tutorId,
        change,
        disconnected,
      ),
    );
    const result = await world.owner.pool.query<{ terminated: boolean }>(
      "SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity WHERE usename='learli_app' AND state='idle' AND query LIKE 'SELECT count(*)::int AS count FROM pg_catalog.pg_trigger%' AND pid<>pg_backend_pid()",
    );
    expect(result.rows.length).toBeGreaterThan(0);
    await expect.poll(() => disconnected.mock.calls.length).toBe(1);
    const newChange = vi.fn();
    stops.push(
      await subscribeTutorBookings(
        secondRuntime,
        "synthetic-reconnect",
        tutorId,
        newChange,
        vi.fn(),
      ),
    );
    await world.owner.pool.query(
      "SELECT pg_notify('learli_tutor_booking',$1)",
      [tutorId],
    );
    await expect.poll(() => newChange.mock.calls.length).toBe(1);
    expect(change).not.toHaveBeenCalled();
  });
});
