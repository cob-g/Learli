// Node-only service: imported by server routes/pages and isolated database tests.
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import type { Database } from "@/lib/db/connection";
import { learnerProfiles } from "@/lib/db/schema/learners";
import { AccessError, requireIdentity } from "@/lib/permissions/access";
import { isLoopbackOrigin, syntheticEmail } from "@/lib/local-mode";
import { RuleError } from "@/lib/rule-error";
import { learnerInput, createLearnerInput } from "./input";

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
  grade: learnerProfiles.grade,
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
  // Older clients omit grade; validate the resulting profile without discarding it.
  learnerInput.parse({
    ...values,
    grade: values.grade === undefined ? profile.grade : values.grade,
  });
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

/** Synthetic creation context only; existing GET/PATCH contract stays unchanged. */
export async function readLearnerCreationContext(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const identity = await requireLearnerActor(runtime, headers);
  const current = await runtime.auth.api.getSession({ headers });
  if (!current || !syntheticEmail(current.user.email))
    throw new AccessError(403);
  const learners = await listMyLearners(runtime, headers);
  return {
    timezone: current.user.timezone,
    modes: [
      ...(identity.roles.includes("parent") ? ["guardian" as const] : []),
      ...(identity.roles.includes("student") &&
      !learners.some((profile) => profile.management === "self")
        ? ["self" as const]
        : []),
    ],
  };
}

export async function createMyLearner(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
) {
  const identity = await requireLearnerActor(runtime, headers);
  const current = await runtime.auth.api.getSession({ headers });
  if (!current || !syntheticEmail(current.user.email))
    throw new AccessError(403);
  const values = createLearnerInput.parse(input);
  if (
    !identity.roles.includes(
      values.management === "guardian" ? "parent" : "student",
    )
  )
    throw new AccessError(403);
  if (values.management === "self" && values.level !== "college_support")
    throw new RuleError(
      400,
      "This local profile uses College Support. Keep that level and try again.",
    );
  return runtime.db.transaction(
    async (tx) => {
      const result = await tx.execute<{
        outcome: string;
        learner_id: string | null;
      }>(sql`
      SELECT * FROM public.create_local_learner_with_grade(${identity.userId}, ${identity.sessionId},
        ${values.requestId}::uuid, ${values.management}, ${values.displayName}, ${values.level}, ${values.timezone}, ${values.grade ?? null}::integer)
    `);
      const row = result.rows[0];
      if (row?.outcome === "forbidden") throw new AccessError(403);
      if (row?.outcome === "conflict")
        throw new RuleError(
          409,
          "This request already used different fields. Return to your learners and start a new profile.",
        );
      if (row?.outcome === "exists")
        throw new RuleError(
          409,
          "Your local self-managed profile already exists. Return to your learners to edit it.",
        );
      if (row?.outcome === "capacity")
        throw new RuleError(
          409,
          "This account has reached the local demonstration creation limit. Return to your learners.",
        );
      if (row?.outcome === "invalid")
        throw new RuleError(400, "Check the learner fields and try again.");
      if (!row?.learner_id || !["created", "replayed"].includes(row.outcome))
        throw new AccessError(503);
      // A replay does not restore inactive profiles or revoked links. Same minimal DTO.
      return readAuthorizedLearner(tx, identity.userId, row.learner_id);
    },
    { isolationLevel: "read committed" },
  );
}
