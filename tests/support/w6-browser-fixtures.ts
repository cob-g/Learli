import {
  assertOwnedReadinessDatabase,
  screeningMirrorOrigin,
} from "./readiness-placement";
import type { BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { createDatabase } from "../../src/lib/db/connection";
import { provisionScreeningAssignment } from "../../src/features/tutor-screening/fixture-tooling";
/** Run after ordinary global fixture reset. Provision only exact task metadata;
 * profile, screening evidence/decision and schedule use real production handlers. */
export async function restoreW6BrowserTutor(
  owner: ReturnType<typeof createDatabase>,
  tutor: BrowserContext,
  reviewer: BrowserContext,
  fixture: {
    origin: string;
    reviewer: { id: string };
    tutor: { id: string; profileId: string; slug: string };
  },
) {
  assertOwnedReadinessDatabase(process.cwd());
  if (fixture.origin !== screeningMirrorOrigin)
    throw new Error("Owned W6 browser fixture required.");
  const existing = await owner.pool.query(
    "SELECT id,slug FROM tutor_profiles WHERE user_id=$1",
    [fixture.tutor.id],
  );
  if (existing.rows.length) {
    // Another project may have recreated the same owned tutor after global reset.
    fixture.tutor.profileId = existing.rows[0].id;
    fixture.tutor.slug = existing.rows[0].slug;
    return;
  }
  const subject = (
    await owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
  ).rows[0].id;
  const profile = await tutor.request.put("/api/tutor/profile", {
    headers: { origin: fixture.origin },
    data: {
      headline: "Fictional readiness tutor",
      bio: "Fictional acceptance introduction.",
      teachingBackground: "Fictional acceptance background.",
      timezone: "Asia/Manila",
      offerings: [
        { subjectId: subject, levels: ["high_school", "college_support"] },
      ],
    },
  });
  if (!profile.ok())
    throw new Error("Own actual tutor profile request refused.");
  const row = (
    await owner.pool.query(
      "SELECT id,slug,availability_version FROM tutor_profiles WHERE user_id=$1",
      [fixture.tutor.id],
    )
  ).rows[0];
  if (!row) throw new Error();
  fixture.tutor.profileId = row.id;
  fixture.tutor.slug = row.slug;
  const request = await tutor.request.post("/api/tutor/screening/" + row.id, {
    headers: { origin: fixture.origin },
    data: { requestKey: randomUUID() },
  });
  if (!request.ok()) throw new Error("Own actual screening request refused.");
  await provisionScreeningAssignment(
    owner,
    row.id,
    fixture.reviewer.id,
    "synthetic_readiness",
    new Date(Date.now() + 2 * 3600000),
  );
  for (const [revision, code] of [
    "synthetic_check_a",
    "synthetic_check_b",
  ].entries()) {
    const check = await reviewer.request.post(
      `/api/admin/tutor-applications/${row.id}/screening/checks`,
      {
        headers: { origin: fixture.origin },
        data: {
          revision,
          code,
          requestKey: randomUUID(),
          outcome: "passed",
          reference: `screening:${randomUUID()}`,
          checkedAt: new Date(Date.now() - 60000).toISOString(),
          expiresAt: new Date(Date.now() + 2 * 3600000).toISOString(),
        },
      },
    );
    if (!check.ok()) throw new Error("Own actual screening check refused.");
  }
  const approved = await reviewer.request.post(
    `/api/admin/tutor-applications/${row.id}/screening/decision`,
    {
      headers: { origin: fixture.origin },
      data: { revision: 2, requestKey: randomUUID(), action: "approve" },
    },
  );
  if (!approved.ok()) throw new Error("Own actual screening decision refused.");
  const schedule = await tutor.request.put("/api/tutor/availability", {
    headers: { origin: fixture.origin },
    data: {
      version: row.availability_version,
      timezone: "Asia/Manila",
      windows: Array.from({ length: 7 }, (_, i) => ({
        isoWeekday: i + 1,
        startMinute: 0,
        endMinute: 1440,
      })),
    },
  });
  if (!schedule.ok()) throw new Error("Own actual schedule request refused.");
}
