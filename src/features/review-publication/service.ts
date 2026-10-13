import { sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { AccessError, requireIdentity } from "@/lib/permissions/access";
import { requireAdminAssurance } from "@/features/admin-security/assurance";
import { pgErrorCode } from "@/lib/db/errors";
import { RuleError } from "@/lib/rule-error";
import { isLoopbackOrigin } from "@/lib/local-mode";
import { publicationDecision, publicationSubmission } from "./input";
import {
  validatePublicationCapability,
  type PublicationCapability,
  type EnabledPublicationPolicy,
} from "./policy";
import {
  queryAuthorPublication,
  queryModeratorPublications,
  queryPublicReviewProjection,
} from "./query";
export type PublicationContext = {
  runtime: AuthRuntime;
  publication: PublicationCapability;
};
export function requirePublicationPolicy(
  c: PublicationContext,
): EnabledPublicationPolicy {
  const policy = validatePublicationCapability(
    c.publication,
    c.runtime.environment,
  );
  if (policy.authority === "disabled" || !isLoopbackOrigin(c.runtime.origin))
    throw new AccessError(503);
  return policy;
}
function id(value: string) {
  if (!z.uuid().safeParse(value).success) throw new AccessError(404);
  return value;
}
function translate(error: unknown): never {
  const code = pgErrorCode(error);
  if (code === "P0002" || code === "42501") throw new AccessError(404);
  if (code === "40001" || code === "23505")
    throw new RuleError(
      409,
      "This review changed or a review was already saved. Reload before trying again.",
    );
  if (code === "23514")
    throw new RuleError(
      400,
      "That review change is unavailable. Check the fields and reload.",
    );
  throw error;
}
export async function readAuthorPublication(
  c: PublicationContext,
  headers: Headers,
  bookingId: string,
) {
  const p = requirePublicationPolicy(c),
    a = await requireIdentity(c.runtime, headers);
  const row = await queryAuthorPublication(
    c.runtime.db,
    a,
    id(bookingId),
    p.policyId,
  );
  if (!row) throw new AccessError(404);
  return row;
}
export async function listModeratorPublications(
  c: PublicationContext,
  headers: Headers,
) {
  const p = requirePublicationPolicy(c),
    a = await requireAdminAssurance(c.runtime, headers);
  const rows = await queryModeratorPublications(c.runtime.db, a, p.policyId);
  return {
    reviews: rows
      .slice(0, 20)
      .map(({ id, state, revision }) => ({ id, state, revision })),
    hasMore: rows.length > 20,
  };
}
export async function readModeratorPublication(
  c: PublicationContext,
  headers: Headers,
  reviewId: string,
) {
  const p = requirePublicationPolicy(c),
    a = await requireAdminAssurance(c.runtime, headers);
  const [row] = await queryModeratorPublications(
    c.runtime.db,
    a,
    p.policyId,
    id(reviewId),
  );
  if (!row) throw new AccessError(404);
  return row;
}
export async function submitPublication(
  c: PublicationContext,
  headers: Headers,
  bookingId: string,
  input: unknown,
) {
  const p = requirePublicationPolicy(c),
    a = await requireIdentity(c.runtime, headers),
    v = publicationSubmission.parse(input);
  try {
    return await c.runtime.db.transaction(
      async (tx) => {
        const r = await tx.execute<{ id: string }>(
          sql`SELECT public.submit_publication_review(${a.userId},${a.sessionId},${id(bookingId)}::uuid,${v.completionEventId}::uuid,${v.bookingRevision},${p.policyId}::uuid,${v.requestId}::uuid,${v.rating},${v.comment}) AS id`,
        );
        const row = await queryAuthorPublication(tx, a, bookingId, p.policyId);
        if (!row?.review || row.review.id !== r.rows[0]?.id)
          throw new AccessError(404);
        return row.review;
      },
      { isolationLevel: "read committed" },
    );
  } catch (e) {
    translate(e);
  }
}
export async function decidePublication(
  c: PublicationContext,
  headers: Headers,
  reviewId: string,
  input: unknown,
) {
  const p = requirePublicationPolicy(c),
    a = await requireAdminAssurance(c.runtime, headers),
    v = publicationDecision.parse(input);
  try {
    return await c.runtime.db.transaction(
      async (tx) => {
        await tx.execute(
          sql`SELECT public.decide_publication_review(${a.userId},${a.sessionId},${id(reviewId)}::uuid,${p.policyId}::uuid,${v.expectedRevision},${v.requestId}::uuid,${v.state},${v.privacyChecked})`,
        );
        const [row] = await queryModeratorPublications(
          tx,
          a,
          p.policyId,
          reviewId,
        );
        if (!row) throw new AccessError(404);
        return row;
      },
      { isolationLevel: "read committed" },
    );
  } catch (e) {
    translate(e);
  }
}
export async function readPublicReviews(c: PublicationContext, slug: string) {
  const p = requirePublicationPolicy(c);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80)
    throw new AccessError(404);
  return queryPublicReviewProjection(c.runtime.db, slug, p.policyId);
}
