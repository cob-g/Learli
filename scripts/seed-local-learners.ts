// Run after db:seed. No public endpoint grants learner ownership or eligibility.
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createDatabase } from "../src/lib/db/connection";
import { parseServerEnv } from "../src/lib/env/schema";
import { user, userRoles } from "../src/lib/db/schema";
import {
  guardianLearnerLinks,
  learnerProfiles,
} from "../src/lib/db/schema/learners";

process.loadEnvFile(".env.local");
const env = parseServerEnv(process.env);
if (env.APP_ENV !== "development" || env.AUTH_MODE !== "local")
  throw new Error("Learner fixtures are local-development only.");
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "");
try {
  if (owner.pool.options.database !== "learli_dev") throw new Error();
  const manifest = z
    .array(z.object({ email: z.string(), userId: z.string() }))
    .parse(JSON.parse(readFileSync(".local/fixtures.json", "utf8")));
  for (const definition of [
    {
      label: "parent",
      role: "parent" as const,
      management: "guardian" as const,
      count: 2,
    },
    {
      label: "multi",
      role: "parent" as const,
      management: "guardian" as const,
      count: 1,
    },
    {
      label: "student",
      role: "student" as const,
      management: "self" as const,
      count: 1,
    },
  ]) {
    const fixture = manifest.find(
      (entry) => entry.email === `${definition.label}@fixtures.learli.test`,
    );
    if (!fixture) throw new Error();
    await owner.db.transaction(async (tx) => {
      const [account] = await tx
        .select({ id: user.id })
        .from(user)
        .innerJoin(userRoles, eq(user.id, userRoles.userId))
        .where(
          and(
            eq(user.id, fixture.userId),
            eq(user.email, fixture.email),
            eq(user.emailVerified, true),
            eq(userRoles.role, definition.role),
          ),
        );
      if (!account) throw new Error();
      for (let ordinal = 1; ordinal <= definition.count; ordinal++) {
        const fixtureKey = `m4-4:${fixture.userId}:${ordinal}`;
        const [existing] = await tx
          .select()
          .from(learnerProfiles)
          .where(eq(learnerProfiles.fixtureKey, fixtureKey));
        if (existing) {
          // Never adopt another record, reset edits, or reactivate revoked access.
          if (
            existing.source !== "local_fixture" ||
            existing.management !== definition.management ||
            existing.userId !==
              (definition.management === "self" ? fixture.userId : null)
          )
            throw new Error();
          if (definition.management === "guardian") {
            const links = await tx
              .select()
              .from(guardianLearnerLinks)
              .where(eq(guardianLearnerLinks.learnerId, existing.id));
            if (
              links.length !== 1 ||
              links[0].guardianUserId !== fixture.userId ||
              links[0].source !== "local_fixture"
            )
              throw new Error();
          }
          continue;
        }
        const [profile] = await tx
          .insert(learnerProfiles)
          .values({
            fixtureKey,
            source: "local_fixture",
            management: definition.management,
            userId: definition.management === "self" ? fixture.userId : null,
            displayName:
              definition.management === "self"
                ? "Synthetic college learner"
                : `Synthetic ${definition.label} learner ${ordinal}`,
            level:
              definition.management === "self"
                ? "college_support"
                : ordinal === 1
                  ? "elementary"
                  : "high_school",
            timezone: "Asia/Manila",
          })
          .returning({ id: learnerProfiles.id });
        if (definition.management === "guardian")
          await tx.insert(guardianLearnerLinks).values({
            guardianUserId: fixture.userId,
            learnerId: profile.id,
            source: "local_fixture",
            status: "authorized",
          });
      }
    });
  }
  console.log(
    "Local synthetic learner fixtures ready. Existing profile edits and revoked links preserved.",
  );
} catch {
  console.error(
    "Learner fixture setup stopped safely. Check the private account manifest; no unrelated records were adopted.",
  );
  process.exitCode = 1;
} finally {
  await owner.pool.end();
}
