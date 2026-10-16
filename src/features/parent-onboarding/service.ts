import { sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { AccessError, requireIdentity } from "@/lib/permissions/access";

export const parentOnboardingInput = z.strictObject({});

/** Workspace enrollment never grants authority over a learner. */
export async function enrollParentWorkspace(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
) {
  parentOnboardingInput.parse(input);
  const identity = await requireIdentity(runtime, headers);
  return runtime.db.transaction(
    async (tx) => {
      const result = await tx.execute<{ outcome: string }>(sql`
        SELECT public.enroll_parent_workspace(${identity.userId}, ${identity.sessionId}) AS outcome
      `);
      const outcome = result.rows[0]?.outcome;
      if (outcome === "forbidden") throw new AccessError(403);
      if (outcome !== "granted" && outcome !== "existing")
        throw new AccessError(503);
      return { ready: true, granted: outcome === "granted" };
    },
    { isolationLevel: "read committed" },
  );
}
