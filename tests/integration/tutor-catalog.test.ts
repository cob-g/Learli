import { provisionScreeningAssignment } from "@/features/tutor-screening/fixture-tooling";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  subjects,
  tutorProfiles,
  tutorSubjects,
  user,
  userAccess,
  type ReviewStatus,
} from "@/lib/db/schema";
import {
  handleSubjectCreateRequest,
  handleSubjectStateRequest,
} from "@/features/subjects/handler";
import {
  findEligibleTutor,
  listEligibleTutors,
} from "@/features/tutors/eligibility";
import {
  handleTutorApplicationStart,
  handleTutorProfileRequest,
  handleTutorReviewRequest,
} from "@/features/tutors/handler";
import {
  listTutorApplications,
  readTutorApplication,
} from "@/features/tutors/review";
import { readOwnTutorProfile } from "@/features/tutors/service";
import {
  closeWorld,
  createAccount,
  jsonRequest,
  openWorld,
  type TestAccount,
  type World,
} from "./support";

let world: World;
let catalog: Record<string, string>;

function application(overrides: Record<string, unknown> = {}) {
  return {
    headline: "Synthetic algebra tutor",
    bio: "Fictional introduction for an automated test.",
    teachingBackground: "Fictional background for an automated test.",
    timezone: "Asia/Manila",
    offerings: [
      {
        subjectId: catalog.math,
        levels: ["high_school", "middle_school"],
        specialty: "Algebra",
      },
    ],
    ...overrides,
  };
}
function saveProfile(
  account: { cookie?: string },
  body: unknown,
  origin?: string,
) {
  return handleTutorProfileRequest(
    world.runtime,
    jsonRequest(world, "/api/tutor/profile", {
      method: "PUT",
      body,
      cookie: account.cookie,
      origin,
    }),
  );
}
function review(
  account: { cookie?: string },
  profileId: string,
  body: unknown,
  origin?: string,
) {
  return handleTutorReviewRequest(
    world.runtime,
    jsonRequest(world, `/api/admin/tutor-applications/${profileId}`, {
      body,
      cookie: account.cookie,
      origin,
    }),
    profileId,
  );
}
function addSubject(account: { cookie?: string }, body: unknown) {
  return handleSubjectCreateRequest(
    world.runtime,
    jsonRequest(world, "/api/admin/subjects", { body, cookie: account.cookie }),
  );
}
function setSubject(
  account: { cookie?: string },
  subjectId: string,
  body: unknown,
) {
  return handleSubjectStateRequest(
    world.runtime,
    jsonRequest(world, `/api/admin/subjects/${subjectId}`, {
      method: "PATCH",
      body,
      cookie: account.cookie,
    }),
    subjectId,
  );
}
async function profileOf(account: TestAccount) {
  const [profile] = await world.owner.db
    .select()
    .from(tutorProfiles)
    .where(eq(tutorProfiles.userId, account.id));
  return profile;
}
/** A tutor with a submitted application, optionally moved to a status by trusted setup. */
async function tutorWithApplication(status?: ReviewStatus, name?: string) {
  const tutor = await createAccount(world, ["tutor"], name);
  expect((await saveProfile(tutor, application())).status).toBe(200);
  if (status)
    await world.owner.db
      .update(tutorProfiles)
      .set({ reviewStatus: status })
      .where(eq(tutorProfiles.userId, tutor.id));
  return { ...tutor, profileId: (await profileOf(tutor)).id };
}
async function auditActions(targetUserId: string) {
  const result = await world.owner.pool.query<{
    action: string;
    actor_user_id: string | null;
  }>(
    "SELECT action, actor_user_id FROM audit_events WHERE target_user_id = $1 AND action LIKE 'tutor%' ORDER BY created_at, action",
    [targetUserId],
  );
  return result.rows;
}

beforeAll(() => {
  world = openWorld();
});
beforeEach(async () => {
  // Dedicated synthetic test database only; openWorld refuses anything else.
  await world.owner.pool.query(
    'TRUNCATE TABLE "user", rate_limit, verification CASCADE',
  );
  await world.owner.pool.query(
    "DELETE FROM subjects WHERE category = 'specialized'",
  );
  await world.owner.pool.query("UPDATE subjects SET is_active = true");
  const rows = await world.owner.db
    .select({ slug: subjects.slug, id: subjects.id })
    .from(subjects);
  catalog = Object.fromEntries(rows.map((row) => [row.slug, row.id]));
});
afterAll(async () => {
  // Leave the shared test catalog as the migration created it.
  await world.owner.pool.query("UPDATE subjects SET is_active = true");
  await closeWorld(world);
});

function startApplication(
  account: { cookie?: string },
  body: unknown = {},
  origin?: string,
) {
  return handleTutorApplicationStart(
    world.runtime,
    jsonRequest(world, "/api/tutor/application", {
      body,
      cookie: account.cookie,
      origin,
    }),
  );
}
async function rolesOf(userId: string) {
  const result = await world.owner.pool.query<{ role: string }>(
    "SELECT role FROM user_roles WHERE user_id = $1 ORDER BY role",
    [userId],
  );
  return result.rows.map((row) => row.role);
}

describe("tutor application entry", () => {
  it("gives a verified account the tutor role once, audited, and nothing more", async () => {
    const account = await createAccount(world);
    expect((await saveProfile(account, application())).status).toBe(403);
    const started = await startApplication(account);
    expect(started.status).toBe(200);
    expect(await started.json()).toEqual({ granted: true });
    expect(await rolesOf(account.id)).toEqual(["tutor"]);
    // Repeating it changes nothing and is not audited again.
    expect(await (await startApplication(account)).json()).toEqual({
      granted: false,
    });
    const audit = await world.owner.pool.query(
      "SELECT actor_user_id FROM audit_events WHERE target_user_id = $1 AND action = 'tutor_role.self_granted'",
      [account.id],
    );
    expect(audit.rows).toEqual([{ actor_user_id: account.id }]);
    // The role lets them apply; it does not make them public.
    expect((await saveProfile(account, application())).status).toBe(200);
    expect((await profileOf(account)).reviewStatus).toBe("pending");
    expect(await listEligibleTutors(world.runtime.db)).toEqual([]);
  });

  it("refuses signed-out, suspended, cross-origin and forged requests", async () => {
    expect((await startApplication({})).status).toBe(401);
    const account = await createAccount(world);
    expect(
      (await startApplication(account, {}, "https://attacker.test")).status,
    ).toBe(403);
    for (const body of [
      { role: "admin" },
      { userId: "someone-else" },
      { roles: ["admin", "tutor"] },
    ])
      expect((await startApplication(account, body)).status).toBe(400);
    await world.owner.db
      .update(userAccess)
      .set({ status: "suspended" })
      .where(eq(userAccess.userId, account.id));
    expect((await startApplication(account)).status).toBe(403);
    expect(await rolesOf(account.id)).toEqual([]);
  });

  it("keeps every other role out of the runtime's reach", async () => {
    const account = await createAccount(world, ["parent"]);
    const runtime = world.runtime.pool;
    for (const role of ["admin", "tutor", "student"])
      await expect(
        runtime.query(
          "INSERT INTO user_roles (user_id, role) VALUES ($1, $2)",
          [account.id, role],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    await expect(
      runtime.query("DELETE FROM user_roles WHERE user_id = $1", [account.id]),
    ).rejects.toMatchObject({ code: "42501" });
    // The function takes a user and nothing else, so tutor is all it can add.
    await runtime.query("SELECT grant_tutor_role($1)", [account.id]);
    expect(await rolesOf(account.id)).toEqual(["parent", "tutor"]);
    const signature = await world.owner.pool.query(
      "SELECT pg_get_function_identity_arguments(oid) AS args, prosecdef FROM pg_proc WHERE proname = 'grant_tutor_role'",
    );
    expect(signature.rows).toEqual([
      { args: "target_user_id text", prosecdef: true },
    ]);
  });
});

describe("tutor application", () => {
  it("submits a pending application, then edits it without changing its status", async () => {
    const tutor = await createAccount(world, ["tutor"]);
    expect(await readOwnTutorProfile(world.runtime, tutor.headers)).toBeNull();
    const created = await saveProfile(tutor, application());
    expect(created.status).toBe(200);
    expect(created.headers.get("cache-control")).toContain("no-store");
    expect(await created.json()).toEqual({
      submitted: true,
      reviewStatus: "pending",
    });
    const saved = await readOwnTutorProfile(world.runtime, tutor.headers);
    expect(saved).toMatchObject({
      headline: "Synthetic algebra tutor",
      timezone: "Asia/Manila",
      reviewStatus: "pending",
      offerings: [
        {
          name: "Math",
          levels: ["middle_school", "high_school"],
          specialty: "Algebra",
        },
      ],
    });
    const edited = await saveProfile(
      tutor,
      application({
        headline: "Synthetic science tutor",
        offerings: [{ subjectId: catalog.science, levels: ["elementary"] }],
      }),
    );
    expect(await edited.json()).toEqual({
      submitted: false,
      reviewStatus: "pending",
    });
    expect(
      await readOwnTutorProfile(world.runtime, tutor.headers),
    ).toMatchObject({
      id: saved!.id,
      headline: "Synthetic science tutor",
      reviewStatus: "pending",
      offerings: [{ name: "Science", levels: ["elementary"], specialty: null }],
    });
    expect(await auditActions(tutor.id)).toEqual([
      { action: "tutor_profile.submitted", actor_user_id: tutor.id },
      { action: "tutor_profile.updated", actor_user_id: tutor.id },
    ]);
  });

  it("keeps an approved status when the tutor edits, and never takes it from input", async () => {
    const tutor = await tutorWithApplication("approved");
    const forged = { reviewStatus: "approved", userId: "x", id: randomUUID() };
    for (const [key, value] of Object.entries(forged))
      expect(
        (await saveProfile(tutor, application({ [key]: value }))).status,
      ).toBe(400);
    expect(
      (await saveProfile(tutor, application({ headline: "Edited" }))).status,
    ).toBe(200);
    expect(await profileOf(tutor)).toMatchObject({
      headline: "Edited",
      reviewStatus: "approved",
    });

    const applicant = await createAccount(world, ["tutor"]);
    const response = await saveProfile(
      applicant,
      application({ reviewStatus: "approved" }),
    );
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toContain("approved");
    expect(await profileOf(applicant)).toBeUndefined();
  });

  it("denies anonymous, role-less, unverified, suspended and cross-origin callers", async () => {
    expect((await saveProfile({}, application())).status).toBe(401);
    const visitor = await createAccount(world);
    expect((await saveProfile(visitor, application())).status).toBe(403);
    const admin = await createAccount(world, ["admin"]);
    expect((await saveProfile(admin, application())).status).toBe(403);
    const tutor = await createAccount(world, ["tutor"]);
    expect(
      (await saveProfile(tutor, application(), "https://attacker.test")).status,
    ).toBe(403);
    await world.owner.db
      .update(user)
      .set({ emailVerified: false })
      .where(eq(user.id, tutor.id));
    expect((await saveProfile(tutor, application())).status).toBe(403);
    await world.owner.db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, tutor.id));
    await world.owner.db
      .update(userAccess)
      .set({ status: "suspended" })
      .where(eq(userAccess.userId, tutor.id));
    expect((await saveProfile(tutor, application())).status).toBe(403);
    await expect(
      readOwnTutorProfile(world.runtime, visitor.headers),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (await world.owner.pool.query("SELECT count(*) FROM tutor_profiles"))
        .rows[0].count,
    ).toBe("0");
  });

  it("never lets one tutor read or change another tutor's profile", async () => {
    const a = await tutorWithApplication(undefined, "Synthetic tutor A");
    const b = await tutorWithApplication(undefined, "Synthetic tutor B");
    expect(
      (
        await saveProfile(
          a,
          application({
            headline: "Changed by A",
            userId: b.id,
            id: b.profileId,
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await saveProfile(a, application({ headline: "Changed by A" }))).status,
    ).toBe(200);
    expect(await profileOf(a)).toMatchObject({ headline: "Changed by A" });
    expect(await profileOf(b)).toMatchObject({
      id: b.profileId,
      headline: "Synthetic algebra tutor",
    });
    expect((await readOwnTutorProfile(world.runtime, a.headers))!.id).toBe(
      a.profileId,
    );
    // Admin-only lookups stay closed to a tutor who guesses a profile id.
    await expect(
      readTutorApplication(world.runtime, a.headers, b.profileId),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("accepts only active catalog subjects, known levels and real time zones", async () => {
    const tutor = await createAccount(world, ["tutor"]);
    await world.owner.db
      .update(subjects)
      .set({ isActive: false })
      .where(eq(subjects.id, catalog.act));
    for (const patch of [
      { offerings: [{ subjectId: randomUUID(), levels: ["elementary"] }] },
      { offerings: [{ subjectId: catalog.act, levels: ["elementary"] }] },
      { offerings: [{ subjectId: catalog.math, levels: ["graduate"] }] },
      { offerings: [{ subjectId: catalog.math, levels: [] }] },
      { offerings: [] },
      { timezone: "+08:00" },
      { headline: "x".repeat(101) },
    ])
      expect((await saveProfile(tutor, application(patch))).status).toBe(400);
    expect(await profileOf(tutor)).toBeUndefined();
    const invalid = await saveProfile(tutor, application({ headline: " " }));
    expect(await invalid.json()).toMatchObject({
      fields: { headline: expect.stringContaining("headline") },
    });
  });

  it("is read-only while suspended", async () => {
    const tutor = await tutorWithApplication("suspended");
    const response = await saveProfile(
      tutor,
      application({ headline: "Edited after the decision" }),
    );
    expect(response.status).toBe(409);
    expect(await profileOf(tutor)).toMatchObject({
      headline: "Synthetic algebra tutor",
      reviewStatus: "suspended",
    });
  });

  it("lets a rejected tutor submit again, which only returns them to pending", async () => {
    const tutor = await tutorWithApplication("rejected");
    const forged = await saveProfile(
      tutor,
      application({ reviewStatus: "approved" }),
    );
    expect(forged.status).toBe(400);
    expect((await profileOf(tutor)).reviewStatus).toBe("rejected");
    const again = await saveProfile(
      tutor,
      application({ headline: "Revised application" }),
    );
    expect(await again.json()).toEqual({
      submitted: true,
      reviewStatus: "pending",
    });
    expect(await profileOf(tutor)).toMatchObject({
      id: tutor.profileId,
      headline: "Revised application",
      reviewStatus: "pending",
    });
    expect((await auditActions(tutor.id)).map((row) => row.action)).toEqual([
      "tutor_profile.submitted",
      "tutor_profile.submitted",
    ]);
    // Still not publicly eligible until an admin approves it.
    expect(await listEligibleTutors(world.runtime.db)).toEqual([]);
  });

  it("holds its rules in PostgreSQL, below the application", async () => {
    const tutor = await tutorWithApplication();
    const owner = world.owner.pool;
    await expect(
      owner.query(
        "UPDATE tutor_profiles SET review_status = 'verified' WHERE id = $1",
        [tutor.profileId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      owner.query("UPDATE tutor_profiles SET headline = $2 WHERE id = $1", [
        tutor.profileId,
        "x".repeat(101),
      ]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      owner.query(
        "INSERT INTO tutor_profiles (user_id, slug, headline, bio, teaching_background, timezone) VALUES ($1, 'second-profile', 'h', 'b', 't', 'UTC')",
        [tutor.id],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    for (const levels of ["{}", "{graduate}", "{elementary,graduate}"])
      await expect(
        owner.query(
          "INSERT INTO tutor_subjects (tutor_id, subject_id, levels) VALUES ($1, $2, $3)",
          [tutor.profileId, catalog.english, levels],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    // A subject a tutor offers and an account with a profile cannot be deleted.
    await expect(
      owner.query("DELETE FROM subjects WHERE id = $1", [catalog.math]),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      owner.query('DELETE FROM "user" WHERE id = $1', [tutor.id]),
    ).rejects.toMatchObject({ code: "23503" });
    // The runtime role may not delete tutors or subjects, or rewrite history.
    const runtime = world.runtime.pool;
    for (const statement of [
      "DELETE FROM tutor_profiles",
      "DELETE FROM subjects",
      "SELECT * FROM audit_events",
      "INSERT INTO user_roles (user_id, role) VALUES ('x', 'tutor')",
    ])
      await expect(runtime.query(statement)).rejects.toMatchObject({
        code: "42501",
      });
  });
});

async function exactReview(admin: TestAccount, profileId: string) {
  await provisionScreeningAssignment(
    world.owner,
    profileId,
    admin.id,
    "local_fixture",
    new Date(Date.now() + 3600000),
  );
}

describe("admin review", () => {
  it("moves an application through every allowed transition and audits each", async () => {
    const admin = await createAccount(world, ["admin"]);
    const tutor = await tutorWithApplication();
    await exactReview(admin, tutor.profileId);
    const status = async () => (await profileOf(tutor)).reviewStatus;
    for (const [action, expected] of [
      ["approve", "approved"],
      ["suspend", "suspended"],
      ["reinstate", "approved"],
    ] as const) {
      const response = await review(admin, tutor.profileId, { action });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ reviewStatus: expected });
      expect(await status()).toBe(expected);
    }
    const second = await tutorWithApplication();
    await exactReview(admin, second.profileId);
    expect(
      (await review(admin, second.profileId, { action: "reject" })).status,
    ).toBe(200);
    expect(
      (await review(admin, second.profileId, { action: "reopen" })).status,
    ).toBe(200);
    expect((await profileOf(second)).reviewStatus).toBe("pending");
    expect(
      (await auditActions(tutor.id)).filter((row) =>
        row.action.startsWith("tutor_review"),
      ),
    ).toEqual(
      ["approved", "suspended", "reinstated"].map((suffix) => ({
        action: `tutor_review.${suffix}`,
        actor_user_id: admin.id,
      })),
    );
    expect((await auditActions(second.id)).map((row) => row.action)).toEqual([
      "tutor_profile.submitted",
      "tutor_review.rejected",
      "tutor_review.reopened",
    ]);
  });

  it("refuses illegal transitions, unknown applications and forged input", async () => {
    const admin = await createAccount(world, ["admin"]);
    const pending = await tutorWithApplication();
    await exactReview(admin, pending.profileId);
    for (const action of ["suspend", "reinstate", "reopen"])
      expect((await review(admin, pending.profileId, { action })).status).toBe(
        409,
      );
    const approved = await tutorWithApplication("approved");
    await exactReview(admin, approved.profileId);
    for (const action of ["approve", "reject", "reinstate", "reopen"])
      expect((await review(admin, approved.profileId, { action })).status).toBe(
        409,
      );
    for (const body of [
      { action: "verify" },
      { action: "approve", reviewStatus: "approved" },
      { reviewStatus: "approved" },
      {},
    ])
      expect((await review(admin, pending.profileId, body)).status).toBe(400);
    expect(
      (await review(admin, randomUUID(), { action: "approve" })).status,
    ).toBe(404);
    expect(
      (await review(admin, "not-a-uuid", { action: "approve" })).status,
    ).toBe(404);
    expect((await profileOf(pending)).reviewStatus).toBe("pending");
    expect((await profileOf(approved)).reviewStatus).toBe("approved");
    expect((await auditActions(pending.id)).map((row) => row.action)).toEqual([
      "tutor_profile.submitted",
    ]);
  });

  it("lets only admins review, and never their own application", async () => {
    const tutor = await tutorWithApplication();
    const other = await createAccount(world, ["tutor"]);
    const visitor = await createAccount(world);
    const admin = await createAccount(world, ["admin"]);
    const approve = { action: "approve" };
    expect((await review({}, tutor.profileId, approve)).status).toBe(401);
    for (const account of [tutor, other, visitor])
      expect((await review(account, tutor.profileId, approve)).status).toBe(
        403,
      );
    expect(
      (await review(admin, tutor.profileId, approve, "https://attacker.test"))
        .status,
    ).toBe(403);
    // Holding both roles is legitimate; deciding your own application is not.
    const both = await createAccount(world, ["admin", "tutor"]);
    expect((await saveProfile(both, application())).status).toBe(200);
    const ownId = (await profileOf(both)).id;
    const self = await review(both, ownId, approve);
    expect(self.status).toBe(404);
    await expect(
      readTutorApplication(world.runtime, both.headers, ownId),
    ).rejects.toMatchObject({ status: 404 });
    expect((await profileOf(both)).reviewStatus).toBe("pending");
    expect((await profileOf(tutor)).reviewStatus).toBe("pending");
    // A different admin needs the exact trusted assignment.
    await exactReview(admin, ownId);
    expect((await review(admin, ownId, approve)).status).toBe(200);
  });

  it("lets exactly one of two simultaneous decisions succeed", async () => {
    const first = await createAccount(world, ["admin"]);
    const tutor = await tutorWithApplication();
    await exactReview(first, tutor.profileId);
    const responses = await Promise.all([
      review(first, tutor.profileId, { action: "approve" }),
      review(first, tutor.profileId, { action: "reject" }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const winner = responses.findIndex((response) => response.status === 200);
    expect((await profileOf(tutor)).reviewStatus).toBe(
      ["approved", "rejected"][winner],
    );
    expect(
      (await auditActions(tutor.id)).filter((row) =>
        row.action.startsWith("tutor_review"),
      ),
    ).toHaveLength(1);
  });

  it("shows the queue and one application to admins only, without account data", async () => {
    const admin = await createAccount(world, ["admin"]);
    const pending = await tutorWithApplication(undefined, "Pending person");
    const approved = await tutorWithApplication("approved", "Approved person");
    await exactReview(admin, pending.profileId);
    await exactReview(admin, approved.profileId);
    const queue = await listTutorApplications(
      world.runtime,
      admin.headers,
      "pending",
    );
    expect(queue.total).toBe(1);
    expect(queue.applications).toEqual([
      {
        id: pending.profileId,
        displayName: "Pending person",
        headline: "Synthetic algebra tutor",
        reviewStatus: "pending",
        createdAt: expect.any(Date),
      },
    ]);
    expect(
      (await listTutorApplications(world.runtime, admin.headers)).total,
    ).toBe(2);
    const detail = await readTutorApplication(
      world.runtime,
      admin.headers,
      approved.profileId,
    );
    expect(detail).toMatchObject({
      displayName: "Approved person",
      reviewStatus: "approved",
      ownedByReviewer: false,
    });
    const exposed = JSON.stringify([queue, detail]);
    for (const secret of [pending.email, approved.email, approved.id])
      expect(exposed).not.toContain(secret);
    await expect(
      listTutorApplications(world.runtime, pending.headers),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      readTutorApplication(world.runtime, admin.headers, randomUUID()),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("subject catalog", () => {
  it("ships the agreed launch catalog, active, with no specialized subject", async () => {
    const rows = await world.owner.pool.query(
      "SELECT slug, name, category, is_active FROM subjects ORDER BY category, name",
    );
    expect(rows.rows).toEqual(
      [
        ["english", "English", "academic_core"],
        ["math", "Math", "academic_core"],
        ["science", "Science", "academic_core"],
        ["homework-help", "Homework help", "academic_support"],
        ["study-skills", "Study skills", "academic_support"],
        ["act", "ACT", "test_prep"],
        ["entrance-exams", "Entrance exams", "test_prep"],
        ["sat", "SAT", "test_prep"],
      ].map(([slug, name, category]) => ({
        slug,
        name,
        category,
        is_active: true,
      })),
    );
  });

  it("lets an admin add one specialized subject and toggle it, auditing each change", async () => {
    const admin = await createAccount(world, ["admin"]);
    const created = await addSubject(admin, { name: "  Organic Chemistry " });
    expect(created.status).toBe(200);
    const subject = (await created.json()) as { id: string };
    expect(subject).toMatchObject({
      name: "Organic Chemistry",
      category: "specialized",
      isActive: true,
    });
    expect(
      (await addSubject(admin, { name: "organic chemistry" })).status,
    ).toBe(409);
    expect((await addSubject(admin, { name: "MATH" })).status).toBe(409);
    for (const body of [
      { name: "A" },
      { name: "<script>" },
      { name: "Law", category: "academic_core" },
      { name: "Law", isActive: false },
      {},
    ])
      expect((await addSubject(admin, body)).status).toBe(400);
    // Same slug, different name: both rows exist with distinct slugs.
    expect(
      (await addSubject(admin, { name: "Organic-Chemistry" })).status,
    ).toBe(200);
    const off = await setSubject(admin, subject.id, { isActive: false });
    expect(await off.json()).toMatchObject({ isActive: false });
    // Repeating the same request is not an error and is not audited twice.
    expect(
      (await setSubject(admin, subject.id, { isActive: false })).status,
    ).toBe(200);
    expect(
      await (await setSubject(admin, subject.id, { isActive: true })).json(),
    ).toMatchObject({ isActive: true });
    expect(
      (await setSubject(admin, randomUUID(), { isActive: false })).status,
    ).toBe(404);
    expect(
      (await setSubject(admin, "not-a-uuid", { isActive: false })).status,
    ).toBe(404);
    expect(
      (await setSubject(admin, subject.id, { isActive: "no" })).status,
    ).toBe(400);
    const audit = await world.owner.pool.query(
      "SELECT action, actor_user_id FROM audit_events WHERE target_subject_id = $1 ORDER BY created_at",
      [subject.id],
    );
    expect(audit.rows).toEqual(
      ["subject.created", "subject.deactivated", "subject.activated"].map(
        (action) => ({ action, actor_user_id: admin.id }),
      ),
    );
  });

  it("keeps the catalog closed to everyone but admins", async () => {
    const tutor = await createAccount(world, ["tutor"]);
    expect((await addSubject({}, { name: "Robotics" })).status).toBe(401);
    expect((await addSubject(tutor, { name: "Robotics" })).status).toBe(403);
    expect(
      (await setSubject(tutor, catalog.math, { isActive: false })).status,
    ).toBe(403);
    expect(
      (await setSubject({}, catalog.math, { isActive: false })).status,
    ).toBe(401);
    const rows = await world.owner.pool.query(
      "SELECT count(*) FILTER (WHERE NOT is_active) AS inactive, count(*) AS total FROM subjects",
    );
    expect(rows.rows[0]).toEqual({ inactive: "0", total: "8" });
  });

  it("keeps a tutor's offering when its subject is deactivated, but stops new use", async () => {
    const admin = await createAccount(world, ["admin"]);
    const tutor = await tutorWithApplication();
    expect(
      (await setSubject(admin, catalog.math, { isActive: false })).status,
    ).toBe(200);
    expect(
      (await readOwnTutorProfile(world.runtime, tutor.headers))!.offerings,
    ).toMatchObject([{ name: "Math", isActive: false }]);
    expect((await saveProfile(tutor, application())).status).toBe(400);
    expect(
      (
        await world.owner.db
          .select()
          .from(tutorSubjects)
          .where(eq(tutorSubjects.tutorId, tutor.profileId))
      ).length,
    ).toBe(1);
  });
});

describe("public eligibility", () => {
  it("lists only approved tutors on active, verified accounts with an active subject", async () => {
    const listed = await tutorWithApplication("approved", "Listed tutor");
    await saveProfile(
      listed,
      application({
        offerings: [
          { subjectId: catalog.math, levels: ["high_school"] },
          { subjectId: catalog.sat, levels: ["high_school"] },
        ],
      }),
    );
    await tutorWithApplication(undefined, "Pending tutor");
    await tutorWithApplication("rejected", "Rejected tutor");
    await tutorWithApplication("suspended", "Suspended tutor");
    const blocked = await tutorWithApplication("approved", "Blocked account");
    await world.owner.db
      .update(userAccess)
      .set({ status: "suspended" })
      .where(eq(userAccess.userId, blocked.id));
    const unverified = await tutorWithApplication("approved", "Unverified");
    await world.owner.db
      .update(user)
      .set({ emailVerified: false })
      .where(eq(user.id, unverified.id));
    const orphaned = await tutorWithApplication(
      "approved",
      "No active subject",
    );
    await saveProfile(
      orphaned,
      application({
        offerings: [{ subjectId: catalog.act, levels: ["high_school"] }],
      }),
    );
    for (const slug of ["act", "sat"])
      await world.owner.db
        .update(subjects)
        .set({ isActive: false })
        .where(eq(subjects.id, catalog[slug]));

    const eligible = await listEligibleTutors(world.runtime.db);
    const slug = (await profileOf(listed)).slug;
    expect(slug).toMatch(/^listed-tutor-[a-f0-9]{8}$/);
    // Exactly the public fields: no account id, email, time zone or status.
    expect(eligible).toEqual([
      {
        slug,
        displayName: "Listed tutor",
        headline: "Synthetic algebra tutor",
        bio: "Fictional introduction for an automated test.",
        teachingBackground: "Fictional background for an automated test.",
        teachingLanguages: [],
        offerings: [
          {
            subjectSlug: "math",
            subjectName: "Math",
            levels: ["high_school"],
            specialty: null,
          },
        ],
      },
    ]);
    const exposed = JSON.stringify(eligible);
    for (const secret of ["@", listed.id, "Asia/Manila", "approved"])
      expect(exposed).not.toContain(secret);
    // A direct address reaches only an eligible tutor.
    expect(await findEligibleTutor(world.runtime.db, slug)).toEqual(
      eligible[0],
    );
    for (const hidden of [blocked, unverified, orphaned])
      expect(
        await findEligibleTutor(
          world.runtime.db,
          (await profileOf(hidden)).slug,
        ),
      ).toBeNull();
    for (const bad of ["missing-tutor", "Not A Slug", "'; DROP TABLE x;--"])
      expect(await findEligibleTutor(world.runtime.db, bad)).toBeNull();
  });

  it("filters by subject and level within the same offering", async () => {
    const math = await tutorWithApplication("approved", "Aaa math tutor");
    const english = await tutorWithApplication("approved", "Bbb english tutor");
    await saveProfile(
      english,
      application({
        offerings: [
          { subjectId: catalog.english, levels: ["elementary"] },
          { subjectId: catalog.science, levels: ["college_support"] },
        ],
      }),
    );
    const names = async (filters: Parameters<typeof listEligibleTutors>[1]) =>
      (await listEligibleTutors(world.runtime.db, filters)).map(
        (tutor) => tutor.displayName,
      );
    expect(await names({})).toEqual(["Aaa math tutor", "Bbb english tutor"]);
    expect(await names({ subject: "math" })).toEqual(["Aaa math tutor"]);
    expect(await names({ level: "elementary" })).toEqual(["Bbb english tutor"]);
    expect(
      await names({ subject: "science", level: "college_support" }),
    ).toEqual(["Bbb english tutor"]);
    // English at elementary and Science at college do not make English at college.
    expect(
      await names({ subject: "english", level: "college_support" }),
    ).toEqual([]);
    expect(await names({ subject: "act" })).toEqual([]);
    expect((await profileOf(math)).slug).not.toBe(
      (await profileOf(english)).slug,
    );
  });
});
