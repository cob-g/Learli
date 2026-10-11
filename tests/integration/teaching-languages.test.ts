import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { handleTutorProfileRequest } from "@/features/tutors/handler";
import { readOwnTutorProfile } from "@/features/tutors/service";
import {
  findEligibleTutor,
  listEligibleTutors,
} from "@/features/tutors/eligibility";
import { tutorProfiles, user, userAccess } from "@/lib/db/schema";
import { teachingLanguageCodes } from "@/features/tutors/teaching-languages";
import {
  openWorld,
  closeWorld,
  createAccount,
  jsonRequest,
  type World,
  type TestAccount,
} from "./support";

let world: World;
let subjectId: string;
function profile(
  teachingLanguages?: unknown,
  headline = "Synthetic language tutor",
) {
  return {
    headline,
    bio: "Fictional tutor for language tests",
    teachingBackground: "Synthetic background",
    timezone: "Asia/Manila",
    offerings: [{ subjectId, levels: ["elementary", "college_support"] }],
    ...(teachingLanguages === undefined ? {} : { teachingLanguages }),
  };
}
const save = (account: { cookie?: string }, body: unknown, origin?: string) =>
  handleTutorProfileRequest(
    world.runtime,
    jsonRequest(world, "/api/tutor/profile", {
      method: "PUT",
      body,
      cookie: account.cookie,
      origin,
    }),
  );
const read = (account: TestAccount) =>
  readOwnTutorProfile(world.runtime, account.headers);
async function approve(account: TestAccount) {
  await world.owner.db
    .update(tutorProfiles)
    .set({ reviewStatus: "approved" })
    .where(eq(tutorProfiles.userId, account.id));
}
beforeAll(() => {
  world = openWorld();
});
beforeEach(async () => {
  await world.owner.pool.query(
    'TRUNCATE TABLE "user", rate_limit, verification CASCADE',
  );
  const rows = await world.owner.pool.query<{ id: string }>(
    "SELECT id FROM subjects WHERE slug = 'math'",
  );
  subjectId = rows.rows[0].id;
});
afterAll(async () => {
  await closeWorld(world);
});

describe("stored tutor language declarations", () => {
  it("saves, reads, preserves omission and explicitly clears optional declarations", async () => {
    const tutor = await createAccount(world, ["tutor"]);
    expect((await save(tutor, profile())).status).toBe(200);
    expect((await read(tutor))?.teachingLanguages).toEqual([]);
    expect((await save(tutor, profile(["fil", "en"]))).status).toBe(200);
    expect((await read(tutor))?.teachingLanguages).toEqual(["en", "fil"]);
    expect((await save(tutor, profile())).status).toBe(200);
    expect((await read(tutor))?.teachingLanguages).toEqual(["en", "fil"]);
    await approve(tutor);
    expect((await save(tutor, profile([]))).status).toBe(200);
    const current = await read(tutor);
    expect(current?.teachingLanguages).toEqual([]);
    expect(current?.reviewStatus).toBe("approved");
    expect(
      await findEligibleTutor(world.runtime.db, current!.slug),
    ).toMatchObject({ teachingLanguages: [] });
  });

  it("refuses invalid/malicious codes and forged ownership without altering either tutor", async () => {
    const a = await createAccount(world, ["tutor"]);
    const b = await createAccount(world, ["tutor"]);
    expect((await save(a, profile(["en"]))).status).toBe(200);
    expect((await save(b, profile(["fil"]))).status).toBe(200);
    const target = await read(b);
    for (const body of [
      profile(["en", "en"]),
      profile(["<script>alert(1)</script>"]),
      profile(["English"]),
      profile(null),
      profile(Array(13).fill("en")),
      { ...profile(["es"]), userId: b.id },
      { ...profile(["es"]), id: target!.id },
      { ...profile(["es"]), reviewStatus: "approved" },
    ]) {
      expect((await save(a, body)).status).toBe(400);
    }
    expect((await read(a))?.teachingLanguages).toEqual(["en"]);
    expect((await read(b))?.teachingLanguages).toEqual(["fil"]);
    // Legitimate edits affect only the signed-in account, never the other tutor.
    expect((await save(a, profile(["ja"]))).status).toBe(200);
    expect((await read(b))?.teachingLanguages).toEqual(["fil"]);
  });

  it("denies anonymous, role-less, unverified, suspended and cross-origin saves", async () => {
    expect((await save({}, profile(["en"]))).status).toBe(401);
    const visitor = await createAccount(world);
    expect((await save(visitor, profile(["en"]))).status).toBe(403);
    const tutor = await createAccount(world, ["tutor"]);
    expect(
      (await save(tutor, profile(["en"]), "https://attacker.test")).status,
    ).toBe(403);
    expect((await save(tutor, profile(["en"]))).status).toBe(200);
    await world.owner.db
      .update(user)
      .set({ emailVerified: false })
      .where(eq(user.id, tutor.id));
    expect((await save(tutor, profile(["fil"]))).status).toBe(403);
    await world.owner.db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, tutor.id));
    await world.owner.db
      .update(userAccess)
      .set({ status: "suspended" })
      .where(eq(userAccess.userId, tutor.id));
    expect((await save(tutor, profile(["fil"]))).status).toBe(403);
    await world.owner.db
      .update(userAccess)
      .set({ status: "active" })
      .where(eq(userAccess.userId, tutor.id));
    await world.owner.db
      .update(tutorProfiles)
      .set({ reviewStatus: "suspended" })
      .where(eq(tutorProfiles.userId, tutor.id));
    expect((await save(tutor, profile(["fil"]))).status).toBe(409);
    expect((await read(tutor))?.teachingLanguages).toEqual(["en"]);
  });

  it("filters genuine declarations, keeps subject+level composition and excludes every ineligible profile", async () => {
    const approved = await createAccount(
      world,
      ["tutor"],
      "Approved synthetic tutor",
    );
    expect((await save(approved, profile(["en", "fil"]))).status).toBe(200);
    await approve(approved);
    const pending = await createAccount(world, ["tutor"]);
    expect((await save(pending, profile(["en"]))).status).toBe(200);
    const missing = await createAccount(world, ["tutor"]);
    expect((await save(missing, profile())).status).toBe(200);
    await approve(missing);
    const filters = {
      subject: "math",
      level: "college_support" as const,
      language: "en" as const,
    };
    expect(await listEligibleTutors(world.runtime.db, filters)).toMatchObject([
      { displayName: approved.name, teachingLanguages: ["en", "fil"] },
    ]);
    expect(
      await listEligibleTutors(world.runtime.db, {
        ...filters,
        level: "high_school",
      }),
    ).toEqual([]);
    expect(
      await listEligibleTutors(world.runtime.db, { language: "es" }),
    ).toEqual([]);
    expect(await listEligibleTutors(world.runtime.db)).toHaveLength(2);
    const slug = (await read(approved))!.slug;
    for (const status of ["rejected", "suspended"] as const) {
      await world.owner.db
        .update(tutorProfiles)
        .set({ reviewStatus: status })
        .where(eq(tutorProfiles.userId, approved.id));
      expect(
        await listEligibleTutors(world.runtime.db, { language: "en" }),
      ).toEqual([]);
      expect(await findEligibleTutor(world.runtime.db, slug)).toBeNull();
    }
    await approve(approved);
    await world.owner.db
      .update(userAccess)
      .set({ status: "suspended" })
      .where(eq(userAccess.userId, approved.id));
    expect(
      await listEligibleTutors(world.runtime.db, { language: "en" }),
    ).toEqual([]);
  });

  it("enforces known unique codes, tutor FK, bounded vocabulary and restricted schema grants", async () => {
    const tutor = await createAccount(world, ["tutor"]);
    expect(
      (await save(tutor, profile([...teachingLanguageCodes]))).status,
    ).toBe(200);
    const id = (await read(tutor))!.id;
    await expect(
      world.owner.pool.query(
        "INSERT INTO tutor_teaching_languages VALUES ($1, 'en')",
        [id],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      world.owner.pool.query(
        "INSERT INTO tutor_teaching_languages VALUES ($1, 'unknown')",
        [id],
      ),
    ).rejects.toMatchObject({ code: "22P02" });
    await expect(
      world.owner.pool.query(
        "INSERT INTO tutor_teaching_languages VALUES ($1, 'en')",
        [randomUUID()],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      world.runtime.pool.query(
        "ALTER TABLE tutor_teaching_languages ADD COLUMN attacker text",
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      world.runtime.pool.query(
        "UPDATE tutor_teaching_languages SET language_code = 'es'",
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("rolls back profile and declarations together if a later audit write fails", async () => {
    const tutor = await createAccount(world, ["tutor"]);
    expect((await save(tutor, profile(["en"]))).status).toBe(200);
    await world.owner.pool.query(
      "REVOKE INSERT ON audit_events FROM learli_app",
    );
    try {
      expect(
        (await save(tutor, profile(["es"], "Unsaved synthetic change"))).status,
      ).toBe(503);
    } finally {
      await world.owner.pool.query(
        "GRANT INSERT ON audit_events TO learli_app",
      );
    }
    expect(await read(tutor)).toMatchObject({
      headline: "Synthetic language tutor",
      teachingLanguages: ["en"],
    });
  });

  it("serializes concurrent profile edits without mixing declaration sets", async () => {
    const tutor = await createAccount(world, ["tutor"]);
    expect((await save(tutor, profile(["en"]))).status).toBe(200);
    const results = await Promise.all([
      save(tutor, profile(["en", "fil"], "First synthetic edit")),
      save(tutor, profile(["es", "fr"], "Second synthetic edit")),
    ]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    const stored = await read(tutor);
    expect(stored?.teachingLanguages).toEqual(
      stored?.headline === "First synthetic edit"
        ? ["en", "fil"]
        : ["fr", "es"],
    );
    expect(["First synthetic edit", "Second synthetic edit"]).toContain(
      stored?.headline,
    );
  });
});
