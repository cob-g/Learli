import { sql } from "drizzle-orm";
import type { AuthRuntime } from "@/lib/auth-factory";
import { AccessError, type Identity } from "@/lib/permissions/access";
import { isLoopbackOrigin } from "@/lib/local-mode";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { assertPrivateWorkflowUnchanged } from "@/features/private-workflow/runtime";
import type { PrivateWorkflowPacket } from "@/features/private-workflow/config";
import {
  participantReadActor,
  participantLearnerAuthority,
} from "./read-authority";

/** Reauthorize an already provider-resolved identity; no provider request,
 * booking projection, learner labels or date formatting is needed for SSE. */
export async function readBookingUpdateAudience(
  runtime: AuthRuntime,
  identity: Pick<Identity, "userId" | "sessionId">,
  audience: "student" | "parent",
  packet: PrivateWorkflowPacket | null,
): Promise<string[]> {
  assertPrivateWorkflowUnchanged(runtime, packet);
  const localWorkflow = getLocalWorkflow(runtime) !== null;
  if (
    !localWorkflow &&
    !packet &&
    (!["development", "test"].includes(runtime.environment) ||
      !isLoopbackOrigin(runtime.origin))
  )
    throw new AccessError(503);
  const actor = {
    ...identity,
    localWorkflow,
    privateWorkflow: packet !== null,
    privatePacket: packet ?? undefined,
  };
  const scope = audience === "parent" ? "guardian" : "student";
  const result = await runtime.db.execute<{ learnerIds: string[] }>(sql`
    WITH booking_update_audience AS (${participantReadActor(actor, scope)})
    SELECT ARRAY(
      SELECT lp.id::text FROM learner_profiles lp
      WHERE ${participantLearnerAuthority(actor, scope)} ORDER BY lp.id
    ) AS "learnerIds"
    FROM booking_update_audience a`);
  // Check configuration continuity after a potentially waited query as well.
  assertPrivateWorkflowUnchanged(runtime, packet);
  if (!result.rows[0]) throw new AccessError(403);
  return result.rows[0].learnerIds;
}
