import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createCase, readCase } from "@/features/support/service";
import { readBookingForReport } from "@/features/support-bookings/service";
import { handleSupportRequest } from "@/features/support/handler";
import {
  assignFixtureCase,
  authorizeFixtureReviewer,
} from "@/features/support/fixture-tooling";
import {
  familyLearner,
  familyTutor,
  familyReservation,
} from "../support/family-fixtures";
import {
  openWorld,
  closeWorld,
  createAccount,
  jsonRequest,
  type World,
  type TestAccount,
} from "./support";

let world: World,
  requester: TestAccount,
  reviewer: TestAccount,
  otherReviewer: TestAccount,
  outsider: TestAccount;
let learnerId: string, tutorId: string, bookingId: string;
const values = (id = bookingId) => ({
  requestKey: randomUUID(),
  category: "general",
  subject: "Synthetic booking support",
  body: "Fictional reservation issue only",
  bookingId: id,
});
const read = (
  actor: TestAccount,
  id: string,
  scope: "requester" | "reviewer" = "requester",
) => readCase(world.runtime, actor.headers, id, scope);
async function linked() {
  return (await createCase(world.runtime, requester.headers, values())).id;
}
async function audits(id: string) {
  return (
    await world.owner.pool.query(
      "SELECT count(*)::int AS n FROM support_booking_access_events WHERE case_id=$1",
      [id],
    )
  ).rows[0].n as number;
}
async function waitForLock(fragment: string) {
  for (let i = 0; i < 100; i++) {
    const result = await world.owner.pool.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",
      [`%${fragment}%`],
    );
    if (result.rows[0].n > 0) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("Expected actual PostgreSQL lock wait");
}
beforeAll(async () => {
  world = openWorld();
  await world.owner.pool.query("UPDATE rate_limit SET count=0");
  reviewer = await createAccount(world, ["admin"]);
  otherReviewer = await createAccount(world, ["admin"]);
  outsider = await createAccount(world, ["admin"]);
  await authorizeFixtureReviewer(world.owner, reviewer.id);
  await authorizeFixtureReviewer(world.owner, otherReviewer.id);
}, 30000);
beforeEach(async () => {
  await world.owner.pool.query("UPDATE rate_limit SET count=0");
  requester = await createAccount(world, ["parent"]);
  learnerId = await familyLearner(
    world.owner.pool,
    requester.id,
    "guardian",
    "PRIVATE LEARNER OMITTED FROM SUPPORT",
  );
  tutorId = await familyTutor(world.owner.pool);
  bookingId = await familyReservation(world.owner.pool, {
    actorId: requester.id,
    learnerId,
    tutorId,
  });
}, 30000);
afterAll(() => closeWorld(world));

describe("booking-linked case permissions and atomicity on PostgreSQL", () => {
  it("participant saves linked case, exact reviewer reads minimal context and audit", async () => {
    const id = await linked();
    await assignFixtureCase(world.owner, id, reviewer.id);
    const own = await read(requester, id);
    expect(own.booking).toMatchObject({
      available: true,
      subjectName: "Math",
      state: "demo_reserved",
    });
    expect(await audits(id)).toBe(0);
    const detail = await read(reviewer, id, "reviewer");
    expect(detail.booking).toEqual(own.booking);
    expect(await audits(id)).toBe(1);
    expect(Object.keys(detail.booking!).sort()).toEqual([
      "available",
      "events",
      "state",
      "subjectName",
      "time",
      "tutorName",
    ]);
    for (const secret of [
      learnerId,
      requester.id,
      bookingId,
      "PRIVATE LEARNER",
      "meeting",
      "notification",
    ])
      expect(JSON.stringify(detail.booking)).not.toContain(secret);
    const event = (
      await world.owner.pool.query(
        "SELECT case_id,booking_id,actor_user_id,action FROM support_booking_access_events WHERE case_id=$1",
        [id],
      )
    ).rows[0];
    expect(event).toEqual({
      case_id: id,
      booking_id: bookingId,
      actor_user_id: reviewer.id,
      action: "booking_context_read",
    });
  });
  it("concurrent identical retries produce one case, association and creation event", async () => {
    const input = values();
    const result = await Promise.all(
      Array.from({ length: 4 }, () =>
        createCase(world.runtime, requester.headers, input),
      ),
    );
    expect(new Set(result.map((r) => r.id)).size).toBe(1);
    const counts = (
      await world.owner.pool.query(
        "SELECT (SELECT count(*)::int FROM support_cases WHERE requester_user_id=$1) AS cases,(SELECT count(*)::int FROM support_case_bookings WHERE case_id=$2) AS links,(SELECT count(*)::int FROM support_case_events WHERE case_id=$2) AS events",
        [requester.id, result[0].id],
      )
    ).rows[0];
    expect(counts).toEqual({ cases: 1, links: 1, events: 1 });
  });
  it("idempotency cannot attach, detach or retarget a saved report", async () => {
    const input = values();
    await createCase(world.runtime, requester.headers, input);
    const { bookingId: omitted, ...plain } = input;
    void omitted;
    for (const patch of [plain, { ...input, bookingId: randomUUID() }])
      await expect(
        createCase(world.runtime, requester.headers, patch),
      ).rejects.toMatchObject({ status: 409 });
    const standalone = { ...plain, requestKey: randomUUID() };
    const created = await createCase(
      world.runtime,
      requester.headers,
      standalone,
    );
    expect(await read(requester, created.id)).not.toHaveProperty("booking");
    await expect(
      createCase(world.runtime, requester.headers, {
        ...standalone,
        bookingId,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("wrong participant and guessed ID create no case or association", async () => {
    for (const input of [values(), values(randomUUID())])
      await expect(
        createCase(world.runtime, outsider.headers, input),
      ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await world.owner.pool.query(
          "SELECT count(*)::int AS n FROM support_cases WHERE requester_user_id=$1",
          [outsider.id],
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it("eligible independent college learner can report without guardian", async () => {
    const student = await createAccount(world, ["student"]);
    const self = await familyLearner(
      world.owner.pool,
      student.id,
      "self",
      "PRIVATE COLLEGE LEARNER",
    );
    const id = await familyReservation(world.owner.pool, {
      actorId: student.id,
      learnerId: self,
      tutorId: await familyTutor(world.owner.pool),
    });
    const report = await createCase(world.runtime, student.headers, values(id));
    expect((await read(student, report.id)).booking?.available).toBe(true);
    await world.owner.pool.query(
      "DELETE FROM user_roles WHERE user_id=$1 AND role='student'",
      [student.id],
    );
    expect((await read(student, report.id)).booking).toEqual({
      available: false,
    });
  });
  it("assigned tutor can report, foreign tutor cannot, suspension removes live context", async () => {
    const tutor = await createAccount(world, ["tutor"]);
    const profile = (
      await world.owner.pool.query(
        "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES ($1,$2,'Synthetic','Synthetic only','Synthetic only','Asia/Manila','approved') RETURNING id",
        [tutor.id, `support-${randomUUID()}`],
      )
    ).rows[0].id;
    const b = await familyReservation(world.owner.pool, {
      actorId: requester.id,
      learnerId,
      tutorId: profile,
    });
    const report = await createCase(world.runtime, tutor.headers, values(b));
    expect((await read(tutor, report.id)).booking?.available).toBe(true);
    await expect(
      readBookingForReport(world.runtime, tutor.headers, bookingId),
    ).rejects.toMatchObject({ status: 404 });
    await world.owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
      [profile],
    );
    expect((await read(tutor, report.id)).booking).toEqual({
      available: false,
    });
  });
  it("guardian revocation retains case but removes context from both requester/reviewer", async () => {
    const input = values();
    const id = (await createCase(world.runtime, requester.headers, input)).id;
    await assignFixtureCase(world.owner, id, reviewer.id);
    await world.owner.pool.query(
      "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1 AND learner_id=$2",
      [requester.id, learnerId],
    );
    for (const [account, scope] of [
      [requester, "requester"],
      [reviewer, "reviewer"],
    ] as const)
      expect((await read(account, id, scope)).booking).toEqual({
        available: false,
      });
    expect(await audits(id)).toBe(0);
    await expect(
      createCase(world.runtime, requester.headers, input),
    ).rejects.toMatchObject({ status: 404 });
  });
  it.each(["account", "verification", "role", "learner"])(
    "requester %s revocation removes reviewer context",
    async (kind) => {
      const id = await linked();
      await assignFixtureCase(world.owner, id, reviewer.id);
      if (kind === "account")
        await world.owner.pool.query(
          "UPDATE user_access SET status='suspended' WHERE user_id=$1",
          [requester.id],
        );
      if (kind === "verification")
        await world.owner.pool.query(
          'UPDATE "user" SET email_verified=false WHERE id=$1',
          [requester.id],
        );
      if (kind === "role")
        await world.owner.pool.query(
          "DELETE FROM user_roles WHERE user_id=$1 AND role='parent'",
          [requester.id],
        );
      if (kind === "learner")
        await world.owner.pool.query(
          "UPDATE learner_profiles SET status='inactive' WHERE id=$1",
          [learnerId],
        );
      expect((await read(reviewer, id, "reviewer")).booking).toEqual({
        available: false,
      });
      expect(await audits(id)).toBe(0);
    },
  );
  it("capability/admin-without-capability/wrong-assignment and cross-owner deny without audit", async () => {
    const id = await linked();
    await assignFixtureCase(world.owner, id, reviewer.id);
    await expect(read(otherReviewer, id, "reviewer")).rejects.toMatchObject({
      status: 404,
    });
    await expect(read(outsider, id, "reviewer")).rejects.toMatchObject({
      status: 403,
    });
    await expect(read(outsider, id)).rejects.toMatchObject({ status: 404 });
    expect(await audits(id)).toBe(0);
  });
  it("real reassignment lock wait denies stale reviewer without read audit", async () => {
    const id = await linked();
    await assignFixtureCase(world.owner, id, reviewer.id);
    const blocker = await world.owner.pool.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT id FROM support_cases WHERE id=$1 FOR UPDATE",
        [id],
      );
      const pending = read(reviewer, id, "reviewer").then(
        () => ({ status: 200 }),
        (error) => error,
      );
      await waitForLock("support_cases");
      await blocker.query(
        "UPDATE support_case_assignments SET reviewer_user_id=$1 WHERE case_id=$2",
        [otherReviewer.id, id],
      );
      await blocker.query("COMMIT");
      expect(await pending).toMatchObject({ status: 404 });
      expect(await audits(id)).toBe(0);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
    }
  });
  it("guardian revoked while submission waits is denied with no partial case", async () => {
    const blocker = await world.owner.pool.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [`support:${requester.id}`],
      );
      const pending = createCase(
        world.runtime,
        requester.headers,
        values(),
      ).then(
        () => ({ status: 200 }),
        (error) => error,
      );
      await waitForLock("pg_advisory_xact_lock");
      await blocker.query(
        "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1 AND learner_id=$2",
        [requester.id, learnerId],
      );
      await blocker.query("COMMIT");
      expect(await pending).toMatchObject({ status: 404 });
      expect(
        (
          await world.owner.pool.query(
            "SELECT count(*)::int AS n FROM support_cases WHERE requester_user_id=$1",
            [requester.id],
          )
        ).rows[0].n,
      ).toBe(0);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
    }
  });
  it("association write failure rolls back the case and creation event", async () => {
    await world.owner.pool.query(
      "REVOKE INSERT ON support_case_bookings FROM learli_app",
    );
    try {
      await expect(
        createCase(world.runtime, requester.headers, values()),
      ).rejects.toThrow();
      expect(
        (
          await world.owner.pool.query(
            "SELECT count(*)::int AS n FROM support_cases WHERE requester_user_id=$1",
            [requester.id],
          )
        ).rows[0].n,
      ).toBe(0);
    } finally {
      await world.owner.pool.query(
        "GRANT INSERT ON support_case_bookings TO learli_app",
      );
    }
  });
  it("storage refuses late attachment and runtime retarget/delete/audit reads", async () => {
    const { bookingId: unused, ...plain } = values();
    void unused;
    const standalone = await createCase(
      world.runtime,
      requester.headers,
      plain,
    );
    await expect(
      world.runtime.pool.query(
        "INSERT INTO support_case_bookings(case_id,booking_id) VALUES ($1,$2)",
        [standalone.id, bookingId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    const id = await linked();
    for (const statement of [
      "UPDATE support_case_bookings SET booking_id=booking_id WHERE case_id=$1",
      "DELETE FROM support_case_bookings WHERE case_id=$1",
      "SELECT * FROM support_booking_access_events WHERE case_id=$1",
    ])
      await expect(
        world.runtime.pool.query(statement, [id]),
      ).rejects.toMatchObject({ code: "42501" });
    await expect(
      world.owner.pool.query(
        "UPDATE support_case_bookings SET booking_id=booking_id WHERE case_id=$1",
        [id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it.each(["status", "timestamp"])(
    "older standalone case cannot attach after legitimate runtime %s update in same transaction",
    async (kind) => {
      const { bookingId: unused, ...plain } = values();
      void unused;
      const standalone = await createCase(
        world.runtime,
        requester.headers,
        plain,
      );
      const connection = await world.runtime.pool.connect();
      try {
        await connection.query("BEGIN");
        await connection.query(
          kind === "status"
            ? "UPDATE support_cases SET status='in_review',revision=1,updated_at=now() WHERE id=$1"
            : "UPDATE support_cases SET updated_at=now() WHERE id=$1",
          [standalone.id],
        );
        await expect(
          connection.query(
            "INSERT INTO support_case_bookings(case_id,booking_id) VALUES ($1,$2)",
            [standalone.id, bookingId],
          ),
        ).rejects.toMatchObject({ code: "23514" });
      } finally {
        await connection.query("ROLLBACK");
        connection.release();
      }
      expect(await read(requester, standalone.id)).not.toHaveProperty(
        "booking",
      );
    },
  );
  it("elapsed TTL projects expiry without fabricating saved events or mutating booking", async () => {
    const old = await familyReservation(world.owner.pool, {
      actorId: requester.id,
      learnerId,
      tutorId: await familyTutor(world.owner.pool),
      expired: true,
    });
    const id = (await createCase(world.runtime, requester.headers, values(old)))
      .id;
    const detail = await read(requester, id);
    expect(detail.booking).toMatchObject({
      state: "demo_expired",
      events: [{ event: "demo_reserved" }],
    });
    expect(
      (
        await world.owner.pool.query("SELECT state FROM bookings WHERE id=$1", [
          old,
        ])
      ).rows[0].state,
    ).toBe("demo_reserved");
  });
  it("viewer timezone is current and private boundary refuses cross-origin/anonymous", async () => {
    const id = await linked();
    await assignFixtureCase(world.owner, id, reviewer.id);
    await world.owner.pool.query('UPDATE "user" SET timezone=$1 WHERE id=$2', [
      "America/Los_Angeles",
      reviewer.id,
    ]);
    const detail = await read(reviewer, id, "reviewer");
    expect(detail.booking?.available && detail.booking.time.zone).toContain(
      "Pacific",
    );
    const response = await handleSupportRequest(
      world.runtime,
      jsonRequest(world, `/api/support/${id}`, {
        method: "GET",
        cookie: requester.cookie,
      }),
      "requester",
      id,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain(
      "private, no-store",
    );
    expect(
      (
        await handleSupportRequest(
          world.runtime,
          jsonRequest(world, "/api/support", {
            body: values(),
            cookie: requester.cookie,
            origin: "https://foreign.test",
          }),
          "requester",
        )
      ).status,
    ).toBe(403);
    await expect(
      readBookingForReport(world.runtime, new Headers(), bookingId),
    ).rejects.toMatchObject({ status: 401 });
  });
});
