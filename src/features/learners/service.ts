// Node-only service: imported by server routes/pages and isolated database tests.
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import type { Database } from "@/lib/db/connection";
import { learnerProfiles } from "@/lib/db/schema/learners";
import { AccessError, requireIdentity } from "@/lib/permissions/access";
import { isLoopbackOrigin } from "@/lib/local-mode";
import { RuleError } from "@/lib/rule-error";
import { learnerInput } from "./input";

async function requireLearnerActor(runtime: AuthRuntime, headers: Headers) {
  if (
    !["development", "test"].includes(runtime.environment) ||
    !isLoopbackOrigin(runtime.origin)
  )
    throw new AccessError(503);
  const identity = await requireIdentity(runtime, headers);
  if (!identity.roles.some((role) => role === "parent" || role === "student"))
    throw new AccessError(403);
  return identity;
}

/** Reused inside reads AND writes; never authorize with client-supplied role/owner. */
function authorizedProfile(userId: string) {
  return and(
    eq(learnerProfiles.source, "local_fixture"),
    eq(learnerProfiles.status, "active"),
    sql`EXISTS (SELECT 1 FROM "user" u JOIN user_access a ON a.user_id = u.id WHERE u.id = ${userId} AND u.email_verified = true AND a.status = 'active')`,
    sql`(
      (${learnerProfiles.management} = 'self' AND ${learnerProfiles.userId} = ${userId} AND ${learnerProfiles.level} = 'college_support'
       AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = ${userId} AND r.role = 'student'))
      OR
      (${learnerProfiles.management} = 'guardian' AND ${learnerProfiles.userId} IS NULL
       AND EXISTS (SELECT 1 FROM user_roles r JOIN guardian_learner_links g ON g.guardian_user_id = r.user_id
         WHERE r.user_id = ${userId} AND r.role = 'parent' AND g.learner_id = ${learnerProfiles.id}
         AND g.status = 'authorized' AND g.source = 'local_fixture'))
    )`,
  );
}

const privateProfile = {
  id: learnerProfiles.id,
  displayName: learnerProfiles.displayName,
  level: learnerProfiles.level,
  timezone: learnerProfiles.timezone,
  management: learnerProfiles.management,
};

export async function listMyLearners(runtime: AuthRuntime, headers: Headers) {
  const identity = await requireLearnerActor(runtime, headers);
  return runtime.db
    .select(privateProfile)
    .from(learnerProfiles)
    .where(authorizedProfile(identity.userId))
    .orderBy(asc(learnerProfiles.createdAt), asc(learnerProfiles.id));
}

export async function readMyLearner(
  runtime: AuthRuntime,
  headers: Headers,
  learnerId: string,
) {
  const identity = await requireLearnerActor(runtime, headers);
  if (!z.uuid().safeParse(learnerId).success) throw new AccessError(404);
  return readAuthorizedLearner(runtime.db, identity.userId, learnerId);
}

/** Same predicate inside booking transactions, including current account and roles. */
export async function readAuthorizedLearner(
  db: Pick<Database, "select">,
  userId: string,
  learnerId: string,
  lock = false,
) {
  const query = db
    .select(privateProfile)
    .from(learnerProfiles)
    .where(and(eq(learnerProfiles.id, learnerId), authorizedProfile(userId)));
  const [profile] = await (lock ? query.for("share") : query);
  if (!profile) throw new AccessError(404);
  return profile;
}
export type PrivateLearner = Awaited<ReturnType<typeof readMyLearner>>;

export async function updateMyLearner(
  runtime: AuthRuntime,
  headers: Headers,
  learnerId: string,
  input: unknown,
) {
  // Establish ownership before giving field feedback; foreign and missing IDs match.
  const profile = await readMyLearner(runtime, headers, learnerId);
  const values = learnerInput.parse(input);
  if (profile.management === "self" && values.level !== "college_support")
    throw new RuleError(
      400,
      "This local profile uses College Support. Keep that level and try again.",
    );
  const identity = await requireLearnerActor(runtime, headers);
  const [updated] = await runtime.db
    .update(learnerProfiles)
    .set({ ...values, updatedAt: new Date() })
    .where(
      and(
        eq(learnerProfiles.id, learnerId),
        authorizedProfile(identity.userId),
      ),
    )
    .returning(privateProfile);
  if (!updated) throw new AccessError(404);
  return updated;
}
