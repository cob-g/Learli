import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  subjects,
  user,
  userAccess,
  userRoles,
  tutorProfiles,
  tutorSubjects,
  learnerProfiles,
  bookings,
  bookingEvents,
} from "@/lib/db/schema";
import { handleSubjectRenameRequest } from "@/features/subjects/handler";
import {
  createSpecializedSubject,
  listSubjects,
  setSubjectActive,
} from "@/features/subjects/service";
import {
  listEligibleTutors,
  findEligibleTutor,
} from "@/features/tutors/eligibility";
import { resolveMatch } from "@/features/matching/match";
import {
  closeWorld,
  createAccount,
  jsonRequest,
  openWorld,
  type World,
  type TestAccount,
} from "./support";

let world: World, admin: TestAccount, other: TestAccount;
beforeAll(async () => {
  world = openWorld();
  admin = await createAccount(world, ["admin"]);
  other = await createAccount(world, ["tutor", "parent", "student"]);
});
afterAll(async () => {
  await closeWorld(world);
});

async function fresh() {
  return createSpecializedSubject(world.runtime, admin.headers, {
    name: `Synthetic ${randomUUID()}`,
  });
}
function rename(
  id: string,
  name: string,
  expectedRevision = 0,
  actor = admin,
  extra = {},
) {
  return handleSubjectRenameRequest(
    world.runtime,
    jsonRequest(world, `/api/admin/subjects/${id}/name`, {
      method: "PATCH",
      cookie: actor.cookie,
      body: { name, expectedRevision, ...extra },
    }),
    id,
  );
}
async function row(id: string) {
  const [result] = await world.owner.db
    .select()
    .from(subjects)
    .where(eq(subjects.id, id));
  return result;
}
async function auditCount(id: string) {
  const result = await world.owner.pool.query(
    "SELECT count(*)::int AS n FROM audit_events WHERE target_subject_id=$1 AND action='subject.renamed'",
    [id],
  );
  return result.rows[0].n;
}
async function waited() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await world.owner.pool.query(
      "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%subjects%') AS waiting",
    );
    if (result.rows[0].waiting) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Expected an actual PostgreSQL subject lock wait.");
}
describe("specialized subject rename on isolated PostgreSQL", () => {
  it("normalizes a real rename, fixes references and records one actor audit", async () => {
    const subject = await fresh();
    const before = await row(subject.id);
    const name = `Corrected ${randomUUID()}`;
    const response = await rename(subject.id, `  ${name}  `);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const after = await row(subject.id);
    expect(after).toMatchObject({
      id: before.id,
      slug: before.slug,
      category: before.category,
      isActive: before.isActive,
      createdAt: before.createdAt,
      name,
      nameRevision: 1,
    });
    const result = await world.owner.pool.query(
      "SELECT actor_user_id=$2 AS correct_actor FROM audit_events WHERE target_subject_id=$1 AND action='subject.renamed'",
      [subject.id, admin.id],
    );
    expect(result.rows).toEqual([{ correct_actor: true }]);
  });
  it("identical requests and concurrent identical retries do not duplicate audit or revision", async () => {
    const subject = await fresh();
    const before = await row(subject.id);
    expect((await rename(subject.id, ` ${subject.name} `)).status).toBe(200);
    expect((await row(subject.id)).updatedAt).toEqual(before.updatedAt);
    expect(await auditCount(subject.id)).toBe(0);
    const name = `Corrected ${randomUUID()}`;
    expect(
      (
        await Promise.all([rename(subject.id, name), rename(subject.id, name)])
      ).map((r) => r.status),
    ).toEqual([200, 200]);
    expect((await rename(subject.id, name)).status).toBe(200);
    expect((await row(subject.id)).nameRevision).toBe(1);
    expect(await auditCount(subject.id)).toBe(1);
  });
  it("has one winner for different concurrent names and rejects stale and ABA edits", async () => {
    const subject = await fresh();
    const a = `Alpha ${randomUUID()}`,
      b = `Beta ${randomUUID()}`;
    const results = await Promise.all([
      rename(subject.id, a),
      rename(subject.id, b),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await rename(subject.id, `Stale ${randomUUID()}`)).status).toBe(
      409,
    );
    expect((await rename(subject.id, subject.name, 1)).status).toBe(200);
    expect((await rename(subject.id, a, 0)).status).toBe(409);
    expect((await row(subject.id)).nameRevision).toBe(2);
    expect(await auditCount(subject.id)).toBe(2);
  });
  it("rejects duplicate names case-insensitively, including simultaneous duplicates", async () => {
    const a = await fresh(),
      b = await fresh();
    expect((await rename(a.id, b.name.toUpperCase())).status).toBe(409);
    const name = `Shared ${randomUUID()}`;
    expect(
      (await Promise.all([rename(a.id, name), rename(b.id, name)]))
        .map((r) => r.status)
        .sort(),
    ).toEqual([200, 409]);
    expect((await auditCount(a.id)) + (await auditCount(b.id))).toBe(1);
  });
  it("rejects malformed names, revisions and every fixed client field without writes", async () => {
    const subject = await fresh();
    const before = await row(subject.id);
    for (const body of [
      { name: "A", expectedRevision: 0 },
      { name: "<script>", expectedRevision: 0 },
      { name: "x".repeat(61), expectedRevision: 0 },
      { name: "Valid name" },
      { name: "Valid name", expectedRevision: "0" },
      { name: "Valid name", expectedRevision: -1 },
      ...["category", "slug", "isActive", "status", "id", "role"].map(
        (key) => ({ name: "Valid name", expectedRevision: 0, [key]: "forged" }),
      ),
    ]) {
      const request = jsonRequest(
        world,
        `/api/admin/subjects/${subject.id}/name`,
        { method: "PATCH", cookie: admin.cookie, body },
      );
      expect(
        (await handleSubjectRenameRequest(world.runtime, request, subject.id))
          .status,
      ).toBe(400);
    }
    expect(await row(subject.id)).toEqual(before);
    expect(await auditCount(subject.id)).toBe(0);
  });
  it("keeps all eight launch subjects fixed, including an identical attempted rename", async () => {
    const core = (await listSubjects(world.runtime.db)).filter(
      (s) => s.category !== "specialized",
    );
    expect(core).toHaveLength(8);
    for (const subject of core) {
      expect((await rename(subject.id, `Renamed ${subject.name}`)).status).toBe(
        403,
      );
      expect((await rename(subject.id, subject.name)).status).toBe(403);
      expect(await auditCount(subject.id)).toBe(0);
    }
  });
  it("denies anonymous, wrong-role, unverified and suspended administrators", async () => {
    const subject = await fresh();
    const request = jsonRequest(
      world,
      `/api/admin/subjects/${subject.id}/name`,
      { method: "PATCH", body: { name: "Correction", expectedRevision: 0 } },
    );
    expect(
      (await handleSubjectRenameRequest(world.runtime, request, subject.id))
        .status,
    ).toBe(401);
    expect((await rename(subject.id, "Correction", 0, other)).status).toBe(403);
    await world.owner.db
      .update(user)
      .set({ emailVerified: false })
      .where(eq(user.id, admin.id));
    try {
      expect((await rename(subject.id, "Correction")).status).toBe(403);
    } finally {
      await world.owner.db
        .update(user)
        .set({ emailVerified: true })
        .where(eq(user.id, admin.id));
    }
    await world.owner.db
      .update(userAccess)
      .set({ status: "suspended" })
      .where(eq(userAccess.userId, admin.id));
    try {
      expect((await rename(subject.id, "Correction")).status).toBe(403);
    } finally {
      await world.owner.db
        .update(userAccess)
        .set({ status: "active" })
        .where(eq(userAccess.userId, admin.id));
    }
    expect(await auditCount(subject.id)).toBe(0);
  });
  it.each(["role", "verification", "suspension", "session", "expiry"])(
    "rechecks %s after a genuine domain-lock wait",
    async (change) => {
      const actor = await createAccount(world, ["admin"]);
      const subject = await fresh();
      const lock = await world.owner.pool.connect();
      await lock.query("BEGIN");
      await lock.query("SELECT id FROM subjects WHERE id=$1 FOR UPDATE", [
        subject.id,
      ]);
      const pending = rename(subject.id, `Queued ${randomUUID()}`, 0, actor);
      try {
        await waited();
        if (change === "role")
          await world.owner.db
            .delete(userRoles)
            .where(eq(userRoles.userId, actor.id));
        if (change === "verification")
          await world.owner.db
            .update(user)
            .set({ emailVerified: false })
            .where(eq(user.id, actor.id));
        if (change === "suspension")
          await world.owner.db
            .update(userAccess)
            .set({ status: "suspended" })
            .where(eq(userAccess.userId, actor.id));
        if (change === "session")
          await world.owner.pool.query("DELETE FROM session WHERE user_id=$1", [
            actor.id,
          ]);
        if (change === "expiry")
          await world.owner.pool.query(
            "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
            [actor.id],
          );
        await lock.query("COMMIT");
        expect((await pending).status).toBe(403);
        expect((await row(subject.id)).name).toBe(subject.name);
        expect(await auditCount(subject.id)).toBe(0);
      } finally {
        await lock.query("ROLLBACK");
        lock.release();
        await pending;
      }
    },
  );
  it("rolls name, revision and timestamp back when atomic audit insertion fails", async () => {
    const subject = await fresh();
    const before = await row(subject.id);
    await world.owner.pool.query(
      "REVOKE INSERT ON audit_events FROM learli_app",
    );
    try {
      expect(
        (await rename(subject.id, `Rollback ${randomUUID()}`)).status,
      ).toBe(503);
    } finally {
      await world.owner.pool.query(
        "GRANT INSERT ON audit_events TO learli_app",
      );
    }
    expect(await row(subject.id)).toEqual(before);
    expect(await auditCount(subject.id)).toBe(0);
  });
  it("retains activation through concurrent rename and inactive rename", async () => {
    const subject = await fresh();
    const name = `Concurrent ${randomUUID()}`;
    await Promise.all([
      setSubjectActive(world.runtime, admin.headers, subject.id, {
        isActive: false,
      }),
      rename(subject.id, name),
    ]);
    expect(await row(subject.id)).toMatchObject({
      name,
      nameRevision: 1,
      isActive: false,
    });
    expect(
      (await rename(subject.id, `Inactive ${randomUUID()}`, 1)).status,
    ).toBe(200);
    await setSubjectActive(world.runtime, admin.headers, subject.id, {
      isActive: true,
    });
    expect((await row(subject.id)).nameRevision).toBe(2);
  });
  it("preserves offerings and immutable booking/history snapshots while discovery and matching read the new label", async () => {
    const subject = await fresh();
    const tutor = await createAccount(world, ["tutor"]);
    const student = await createAccount(world, ["student"]);
    const [profile] = await world.owner.db
      .insert(tutorProfiles)
      .values({
        userId: tutor.id,
        slug: `subject-${randomUUID()}`,
        headline: "Synthetic specialist",
        bio: "Local fixture only.",
        teachingBackground: "Local fixture only.",
        timezone: "UTC",
        reviewStatus: "approved",
      })
      .returning();
    await world.owner.db.insert(tutorSubjects).values({
      tutorId: profile.id,
      subjectId: subject.id,
      levels: ["college_support"],
      specialty: "Original declaration",
    });
    const [learner] = await world.owner.db
      .insert(learnerProfiles)
      .values({
        fixtureKey: randomUUID(),
        source: "local_fixture",
        management: "self",
        userId: student.id,
        displayName: "Synthetic learner",
        level: "college_support",
        timezone: "UTC",
      })
      .returning();
    const start = new Date(Date.now() + 86400000);
    const [booking] = await world.owner.db
      .insert(bookings)
      .values({
        source: "local_simulation",
        tutorId: profile.id,
        learnerId: learner.id,
        bookedByUserId: student.id,
        subjectId: subject.id,
        startAtUtc: start,
        endAtUtc: new Date(+start + 3600000),
        displayTimezone: "UTC",
        idempotencyKey: randomUUID(),
        requestFingerprint: "a".repeat(64),
        state: "demo_reserved",
        expiresAt: new Date(Date.now() + 600000),
      })
      .returning();
    await world.owner.db
      .insert(bookingEvents)
      .values({ bookingId: booking.id, event: "demo_reserved" });
    const snapshot = async () =>
      (
        await world.owner.pool.query(
          "SELECT row_to_json(b)::text AS booking, (SELECT json_agg(t)::text FROM tutor_subjects t WHERE t.subject_id=$1) AS offerings, (SELECT json_agg(e)::text FROM booking_events e WHERE e.booking_id=b.id) AS events, (SELECT json_agg(n)::text FROM booking_notification_deliveries n WHERE n.event_id IN (SELECT e.id FROM booking_events e WHERE e.booking_id=b.id)) AS notices FROM bookings b WHERE b.id=$2",
          [subject.id, booking.id],
        )
      ).rows;
    const before = JSON.stringify(await snapshot());
    const name = `Corrected ${randomUUID()}`;
    expect((await rename(subject.id, name)).status).toBe(200);
    expect(JSON.stringify(await snapshot()) === before).toBe(true);
    const tutors = await listEligibleTutors(world.runtime.db, {
      subject: subject.slug,
      level: "college_support",
    });
    expect(
      tutors.find((t) => t.slug === profile.slug)?.offerings[0].subjectName,
    ).toBe(name);
    expect(
      (await findEligibleTutor(world.runtime.db, profile.slug))?.offerings[0]
        .subjectSlug,
    ).toBe(subject.slug);
    const match = resolveMatch(
      {
        level: "college_support",
        subject: subject.slug,
        when: "any",
        timezone: "UTC",
      },
      await listSubjects(world.runtime.db, true),
      tutors,
    );
    expect(match).toMatchObject({
      step: "ready",
      subject: { name, slug: subject.slug },
    });
    expect(
      await listEligibleTutors(world.runtime.db, {
        subject: subject.slug,
        level: "elementary",
      }),
    ).toEqual([]);
    await setSubjectActive(world.runtime, admin.headers, subject.id, {
      isActive: false,
    });
    expect(await findEligibleTutor(world.runtime.db, profile.slug)).toBeNull();
    expect(JSON.stringify(await snapshot()) === before).toBe(true);
  });
  it("retains method, bounded JSON, origin, unavailable and not-found protections", async () => {
    const subject = await fresh();
    const make = (patch = {}) =>
      jsonRequest(world, `/api/admin/subjects/${subject.id}/name`, {
        method: "PATCH",
        cookie: admin.cookie,
        body: { name: "Correction", expectedRevision: 0 },
        ...patch,
      });
    expect(
      (
        await handleSubjectRenameRequest(
          world.runtime,
          make({ method: "POST" }),
          subject.id,
        )
      ).status,
    ).toBe(405);
    expect(
      (
        await handleSubjectRenameRequest(
          world.runtime,
          make({ origin: "https://untrusted.test" }),
          subject.id,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handleSubjectRenameRequest(
          world.runtime,
          make({ body: { name: "x".repeat(1100), expectedRevision: 0 } }),
          subject.id,
        )
      ).status,
    ).toBe(400);
    expect(
      (await handleSubjectRenameRequest(null, make(), subject.id)).status,
    ).toBe(503);
    expect((await rename("malformed", "Correction")).status).toBe(404);
    expect((await rename(randomUUID(), "Correction")).status).toBe(404);
    expect(await auditCount(subject.id)).toBe(0);
  });
  it("database trigger and runtime grants protect fixed references, revision and core names", async () => {
    const subject = await fresh();
    for (const column of ["id", "slug", "category", "name_revision"])
      expect(
        (
          await world.runtime.pool.query(
            "SELECT has_column_privilege(current_user,'subjects',$1,'UPDATE') AS allowed",
            [column],
          )
        ).rows[0].allowed,
      ).toBe(false);
    const core = (await listSubjects(world.runtime.db)).find(
      (s) => s.slug === "math",
    )!;
    await expect(
      world.runtime.pool.query(
        "UPDATE subjects SET name='Different math' WHERE id=$1",
        [core.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      world.owner.pool.query(
        "UPDATE subjects SET name_revision=1 WHERE id=$1",
        [subject.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      world.owner.pool.query("UPDATE subjects SET slug='changed' WHERE id=$1", [
        subject.id,
      ]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      world.runtime.pool.query("DELETE FROM subjects WHERE id=$1", [
        subject.id,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
