import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { createLocalAuth } from "../src/lib/auth-factory";
import { createDatabase } from "../src/lib/db/connection";
import {
  user,
  userRoles,
  auditEvents,
  subjects,
  tutorProfiles,
  tutorSubjects,
  type Role,
} from "../src/lib/db/schema";

process.loadEnvFile(".env.local");
if (process.env.APP_ENV !== "development")
  throw new Error("Fixtures are development-only.");
const runtime = createLocalAuth(process.env);
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "");
const file = ".local/fixtures.json";
type Fixture = {
  email: string;
  password: string;
  userId: string;
  roles: Role[];
};
const saved: Fixture[] = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : [];
try {
  if (
    runtime.pool.options.database !== "learli_dev" ||
    owner.pool.options.database !== "learli_dev"
  )
    throw new Error();
  const definitions: { label: string; roles: Role[] }[] = [
    { label: "student", roles: ["student"] },
    { label: "parent", roles: ["parent"] },
    { label: "tutor", roles: ["tutor"] },
    { label: "admin", roles: ["admin"] },
    { label: "support-reviewer", roles: ["admin"] },
    { label: "support-escalation", roles: ["admin"] },
    { label: "review-moderator", roles: ["admin"] },
    { label: "multi", roles: ["parent", "tutor"] },
  ];
  for (const definition of definitions) {
    const email = `${definition.label}@fixtures.learli.test`;
    let fixture = saved.find((item) => item.email === email);
    const [existing] = await owner.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    if (existing && existing.id !== fixture?.userId)
      throw new Error(
        "Refusing to grant roles to an account not owned by the fixture manifest.",
      );
    if (!fixture) {
      if (existing) throw new Error();
      const password = randomBytes(24).toString("base64url");
      const result = await runtime.auth.api.signUpEmail({
        body: { email, password, name: `Test ${definition.label}` },
      });
      fixture = {
        email,
        password,
        userId: result.user.id,
        roles: definition.roles,
      };
      saved.push(fixture);
      writeFileSync(file, JSON.stringify(saved, null, 2), { mode: 0o600 });
    }
    if (
      !existing &&
      saved.includes(fixture) &&
      !(await owner.db.select().from(user).where(eq(user.id, fixture.userId)))
        .length
    )
      throw new Error(
        "Fixture record missing; no destructive reset performed.",
      );
    await owner.db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({ emailVerified: true })
        .where(eq(user.id, fixture.userId));
      const granted = await tx
        .insert(userRoles)
        .values(
          definition.roles.map((role) => ({ userId: fixture.userId, role })),
        )
        .onConflictDoNothing()
        .returning();
      if (granted.length)
        await tx.insert(auditEvents).values({
          targetUserId: fixture.userId,
          action: "fixture.roles_granted",
        });
    });
  }
  // One fictional pending application so the review queue has something to show.
  const tutor = saved.find((item) => item.roles.join() === "tutor");
  const [math] = await owner.db
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.slug, "math"));
  if (tutor && math)
    await owner.db.transaction(async (tx) => {
      const [profile] = await tx
        .insert(tutorProfiles)
        .values({
          userId: tutor.userId,
          slug: `test-tutor-${randomBytes(4).toString("hex")}`,
          headline: "Synthetic math tutor for local testing",
          bio: "Fictional profile created by the local fixture script. Not a real tutor.",
          teachingBackground: "Fictional background for local testing only.",
          timezone: "Asia/Manila",
        })
        .onConflictDoNothing()
        .returning({ id: tutorProfiles.id });
      if (!profile) return;
      await tx.insert(tutorSubjects).values({
        tutorId: profile.id,
        subjectId: math.id,
        levels: ["middle_school", "high_school"],
        specialty: "Algebra",
      });
      await tx.insert(auditEvents).values({
        targetUserId: tutor.userId,
        action: "tutor_profile.submitted",
      });
    });
  const rows = saved
    .map(
      (fixture) =>
        `<tr><td>${fixture.roles.join(", ")}</td><td>${fixture.email}</td><td><code>${fixture.password}</code></td></tr>`,
    )
    .join("");
  writeFileSync(
    ".local/fixtures.html",
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Learli local fixtures</title><h1>Local test accounts</h1><p>Synthetic accounts only. Never reuse these passwords elsewhere.</p><table><thead><tr><th>Roles</th><th>Email</th><th>Password</th></tr></thead><tbody>${rows}</tbody></table></html>`,
    { mode: 0o600 },
  );
  console.log(
    "Local synthetic accounts ready. Use npm run fixtures:open to view their private credentials.",
  );
} catch {
  console.error(
    "Fixture setup stopped safely. Check the private fixture manifest; existing accounts were not overwritten.",
  );
  process.exitCode = 1;
} finally {
  await runtime.pool.end();
  await owner.pool.end();
}
