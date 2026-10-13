import { sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/connection";
import type { Identity } from "@/lib/permissions/access";
import { AccessError } from "@/lib/permissions/access";
import type { PrivateLearner } from "@/features/learners/service";
export type CurrentLearnerAuthorityInput = {
  userId: string | SQL;
  sessionId: string | SQL;
  learnerId: string | SQL;
  policyId: string | SQL;
};
/** Always compose into the final SQL statement; a previous true result is no grant. */
export function currentLearnerAuthorityPredicate(
  input: CurrentLearnerAuthorityInput,
): SQL {
  return sql`public.has_current_learner_authority(${input.userId},${input.sessionId},${input.learnerId}::uuid,${input.policyId}::uuid)`;
}
export async function readCurrentAuthorizedLearner(
  db: Pick<Database, "execute">,
  identity: Pick<Identity, "userId" | "sessionId">,
  learnerId: string,
  policyId: string,
): Promise<PrivateLearner> {
  const result =
    await db.execute<PrivateLearner>(sql`SELECT l.id,l.display_name AS "displayName",l.level,l.timezone,l.management FROM public.learner_profiles l
    WHERE l.id=${learnerId}::uuid AND ${currentLearnerAuthorityPredicate({ ...identity, learnerId, policyId })}`);
  const row = result.rows[0];
  if (!row) throw new AccessError(404);
  return row;
}
