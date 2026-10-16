import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  listTutorApplications,
  readTutorApplication,
  reviewTutorApplication,
} from "@/features/tutors/review";
import { saveOwnTutorProfile } from "@/features/tutors/service";
import { provisionScreeningAssignment } from "@/features/tutor-screening/fixture-tooling";
import { privateAdminFixture } from "../support/private-admin-fixtures";
import { createAccount } from "./support";
import { observedLock } from "./screening-fixtures";
import { PrivateWorkflowError } from "@/features/private-workflow/config";

let f: Awaited<ReturnType<typeof privateAdminFixture>>;
let legacyId: string;
beforeAll(async () => {
  f = await privateAdminFixture();
  const legacy = await createAccount(
    f.world,
    ["tutor"],
    "Fictional outside packet legacy Tutor",
  );
  const subject = (
    await f.world.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
  ).rows[0].id;
  await saveOwnTutorProfile(f.world.runtime, legacy.headers, {
    headline: "Fictional legacy application",
    bio: "Fictional test only.",
    teachingBackground: "Fictional test background.",
    timezone: "UTC",
    offerings: [{ subjectId: subject, levels: ["college_support"] }],
  });
  legacyId = (
    await f.world.owner.pool.query(
      "SELECT id FROM tutor_profiles WHERE user_id=$1",
      [legacy.id],
    )
  ).rows[0].id;
  await provisionScreeningAssignment(
    f.world.owner,
    legacyId,
    f.reviewer.id,
    "local_fixture",
    new Date(Date.now() + 3600000),
  );
  f.activate();
}, 60000);
afterAll(async () => {
  await f?.close();
});

describe("private Tutor reviews cannot inherit retained local fixture assignments", () => {
  it("excludes a granted outside-packet legacy Tutor from the private queue", async () => {
    const page = await listTutorApplications(
      f.world.runtime,
      f.reviewer.headers,
    );
    expect(page.applications.map((item) => item.id)).toEqual([
      f.fixture.profile.id,
    ]);
    expect(page.total).toBe(1);
  });
  it("does not disclose that legacy application through direct detail lookup", async () => {
    await expect(
      readTutorApplication(f.world.runtime, f.reviewer.headers, legacyId),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("refuses the legacy mutation with its profile and audit unchanged", async () => {
    const snapshot = async () =>
      (
        await f.world.owner.pool.query(
          "SELECT row_to_json(t) profile,(SELECT jsonb_agg(a ORDER BY a.created_at) FROM audit_events a WHERE a.target_user_id=t.user_id) audit FROM tutor_profiles t WHERE t.id=$1",
          [legacyId],
        )
      ).rows;
    const before = await snapshot();
    await expect(
      reviewTutorApplication(f.world.runtime, f.reviewer.headers, legacyId, {
        action: "approve",
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await snapshot()).toEqual(before);
  });
  it("preserves the exact no-packet legacy assignment path", async () => {
    f.disable();
    try {
      const current = await readTutorApplication(
        f.world.runtime,
        f.reviewer.headers,
        legacyId,
      );
      const alreadyApproved = current.reviewStatus === "approved";
      await reviewTutorApplication(
        f.world.runtime,
        f.reviewer.headers,
        legacyId,
        { action: alreadyApproved ? "suspend" : "approve" },
      );
      expect(
        (
          await readTutorApplication(
            f.world.runtime,
            f.reviewer.headers,
            legacyId,
          )
        ).reviewStatus,
      ).toBe(alreadyApproved ? "suspended" : "approved");
    } finally {
      f.activate();
    }
  });
  it("keeps current assigned private screening visible and excludes role-only staff", async () => {
    expect(
      (
        await readTutorApplication(
          f.world.runtime,
          f.reviewer.headers,
          f.fixture.profile.id,
        )
      ).screening?.state,
    ).toBe("approved");
    expect(
      (await listTutorApplications(f.world.runtime, f.unassigned.headers))
        .applications,
    ).toEqual([]);
    await expect(
      readTutorApplication(
        f.world.runtime,
        f.unassigned.headers,
        f.fixture.profile.id,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      readTutorApplication(f.world.runtime, f.reviewer.headers, randomUUID()),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("rolls back an otherwise valid waited legacy mutation when private mode is enabled", async () => {
    f.disable();
    const snapshot = async () =>
      (
        await f.world.owner.pool.query(
          "SELECT row_to_json(t) profile,(SELECT jsonb_agg(a ORDER BY a.created_at) FROM audit_events a WHERE a.target_user_id=t.user_id) audit FROM tutor_profiles t WHERE t.id=$1",
          [legacyId],
        )
      ).rows;
    const before = await snapshot();
    const blocker = await f.world.owner.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
        [legacyId],
      );
      pending = reviewTutorApplication(
        f.world.runtime,
        f.reviewer.headers,
        legacyId,
        { action: "suspend" },
      ).catch((error: unknown) => error);
      await observedLock(f.world, "review_local_tutor_application");
      f.activate();
      await blocker.query("COMMIT");
      expect(await pending).toBeInstanceOf(PrivateWorkflowError);
      expect(await snapshot()).toEqual(before);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      await pending;
      f.activate();
    }
  });
});
