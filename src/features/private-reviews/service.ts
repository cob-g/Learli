import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { recheckAdminAssurance } from "@/features/admin-security/assurance";
// Node-only reusable service; every protected projection rechecks current identity.
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { isLoopbackOrigin } from "@/lib/local-mode";
import { AccessError, requireIdentity } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import { moderationInput, submissionInput } from "./input";
import { queryAuthorReview, queryModeratorReviews } from "./query";
async function actor(runtime: AuthRuntime, headers: Headers) {
  if (
    getLocalWorkflow(runtime) ||
    !["development", "test"].includes(runtime.environment) ||
    !isLoopbackOrigin(runtime.origin)
  )
    throw new AccessError(503);
  return requireIdentity(runtime, headers);
}
function id(value: string) {
  if (!z.uuid().safeParse(value).success) throw new AccessError(404);
  return value;
}
function translate(error: unknown): never {
  const e = error as { code?: string; cause?: { code?: string } };
  const code = e?.cause?.code ?? e?.code;
  if (code === "P0002") throw new AccessError(404);
  if (code === "40001" || code === "23505")
    throw new RuleError(
      409,
      "This review changed or a review was already saved. Reload before trying again.",
    );
  if (code === "23514")
    throw new RuleError(400, "That local review change is unavailable.");
  throw error;
}
export async function readAuthorReview(
  runtime: AuthRuntime,
  headers: Headers,
  bookingId: string,
) {
  const a = await actor(runtime, headers);
  const row = await queryAuthorReview(runtime.db, a, id(bookingId));
  if (!row) throw new AccessError(404);
  return row;
}
export async function listModeratorReviews(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const a = await actor(runtime, headers);
  if (!a.roles.includes("admin")) throw new AccessError(403);
  await recheckAdminAssurance(runtime.db, a);
  const rows = await queryModeratorReviews(runtime.db, a);
  return {
    reviews: rows
      .slice(0, 20)
      .map(({ id, state, revision }) => ({ id, state, revision })),
    hasMore: rows.length > 20,
  };
}
export async function readModeratorReview(
  runtime: AuthRuntime,
  headers: Headers,
  reviewId: string,
) {
  const a = await actor(runtime, headers);
  const [row] = await queryModeratorReviews(runtime.db, a, id(reviewId));
  if (!row) throw new AccessError(404);
  return row;
}
export async function submitReview(
  runtime: AuthRuntime,
  headers: Headers,
  bookingId: string,
  input: unknown,
) {
  const a = await actor(runtime, headers);
  const v = submissionInput.parse(input);
  try {
    const r = await runtime.db.execute<{ id: string; revision: number }>(
      sql`SELECT * FROM public.submit_private_review(${a.userId},${a.sessionId},${id(bookingId)}::uuid,${v.expectedRevision},${v.requestId}::uuid,${v.rating},${v.comment})`,
    );
    return r.rows[0];
  } catch (e) {
    translate(e);
  }
}
export async function moderateReview(
  runtime: AuthRuntime,
  headers: Headers,
  reviewId: string,
  input: unknown,
) {
  const a = await actor(runtime, headers);
  const v = moderationInput.parse(input);
  try {
    const r = await runtime.db.execute<{ id: string; revision: number }>(
      sql`SELECT * FROM public.moderate_private_review(${a.userId},${a.sessionId},${id(reviewId)}::uuid,${v.expectedRevision},${v.requestId}::uuid,${v.state})`,
    );
    return r.rows[0];
  } catch (e) {
    translate(e);
  }
}
