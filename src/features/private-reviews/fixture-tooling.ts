// Owner-only; runtime pages/routes never import this module.
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { createDatabase } from "@/lib/db/connection";
import {
  reviewModerators,
  reviewModeratorGrants,
  reviewProvisioningEvents,
} from "@/lib/db/schema";
type Owner = ReturnType<typeof createDatabase>;
type Tx = Parameters<Parameters<Owner["db"]["transaction"]>[0]>[0];
export async function requireReviewOwner(owner: Owner) {
  if (
    owner.pool.options.user !== "learli_owner" ||
    owner.pool.options.host !== "127.0.0.1" ||
    !["learli_dev", "learli_test"].includes(String(owner.pool.options.database))
  )
    throw new Error("Owned loopback fixture connection required.");
  const r = await owner.pool.query("SELECT current_user AS name");
  if (r.rows[0]?.name !== "learli_owner") throw new Error("Owner required.");
}
async function eligibleModerator(tx: Tx, userId: string) {
  const r = await tx.execute(
    sql`SELECT u.id FROM public."user" u JOIN public.user_access a ON a.user_id=u.id AND a.status='active' JOIN public.user_roles r ON r.user_id=u.id AND r.role='admin' WHERE u.id=${userId} AND u.email_verified AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$'`,
  );
  if (!r.rows.length)
    throw new Error("Active verified synthetic admin required.");
}
export async function provisionReviewModerator(
  owner: Owner,
  userId: string,
  status: "authorized" | "revoked",
) {
  await requireReviewOwner(owner);
  return owner.db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`review-moderator:${userId}`},0))`,
    );
    if (status === "authorized") await eligibleModerator(tx, userId);
    const r = await tx.execute<{ status: string }>(
      sql`SELECT status FROM public.review_moderators WHERE user_id=${userId}`,
    );
    if (r.rows[0]?.status === status) return;
    if (status === "revoked" && !r.rows.length)
      throw new Error("Existing capability required.");
    await tx
      .insert(reviewModerators)
      .values({ userId, status })
      .onConflictDoUpdate({ target: reviewModerators.userId, set: { status } });
    await tx
      .insert(reviewProvisioningEvents)
      .values({ moderatorUserId: userId, status });
  });
}
export async function provisionReviewGrant(
  owner: Owner,
  userId: string,
  reviewId: string,
  status: "authorized" | "revoked",
) {
  await requireReviewOwner(owner);
  z.uuid().parse(reviewId);
  return owner.db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT tp.id FROM public.tutor_profiles tp JOIN public.bookings b ON b.tutor_id=tp.id JOIN public.private_booking_reviews v ON v.booking_id=b.id WHERE v.id=${reviewId}::uuid FOR UPDATE OF tp`,
    );
    await tx.execute(
      sql`SELECT root.id FROM public.bookings root JOIN public.private_booking_reviews v ON v.logical_booking_id=root.id WHERE v.id=${reviewId}::uuid FOR NO KEY UPDATE OF root`,
    );
    const r = await tx.execute<{ author: string; tutor: string }>(
      sql`SELECT v.author_user_id AS author,tp.user_id AS tutor FROM public.private_booking_reviews v JOIN public.bookings b ON b.id=v.booking_id JOIN public.tutor_profiles tp ON tp.id=b.tutor_id WHERE v.id=${reviewId}::uuid AND v.source='local_synthetic' FOR UPDATE OF v`,
    );
    if (
      !r.rows.length ||
      r.rows[0].author === userId ||
      r.rows[0].tutor === userId
    )
      throw new Error("Exact review unavailable for this moderator.");
    if (status === "authorized") {
      await eligibleModerator(tx, userId);
      const c = await tx.execute(
        sql`SELECT user_id FROM public.review_moderators WHERE user_id=${userId} AND source='local_fixture' AND status='authorized'`,
      );
      if (!c.rows.length) throw new Error("Capability required.");
    }
    const existing = await tx.execute<{ status: string }>(
      sql`SELECT status FROM public.review_moderator_grants WHERE review_id=${reviewId}::uuid AND moderator_user_id=${userId}`,
    );
    if (existing.rows[0]?.status === status) return;
    if (status === "revoked" && !existing.rows.length)
      throw new Error("Existing exact grant required.");
    await tx
      .insert(reviewModeratorGrants)
      .values({ reviewId, moderatorUserId: userId, status })
      .onConflictDoUpdate({
        target: [
          reviewModeratorGrants.reviewId,
          reviewModeratorGrants.moderatorUserId,
        ],
        set: { status },
      });
    await tx
      .insert(reviewProvisioningEvents)
      .values({ reviewId, moderatorUserId: userId, status });
  });
}

import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { completeHistoricalDemoFixture } from "@/features/bookings/fixture-tooling";
import { bookings, bookingEvents } from "@/lib/db/schema";
const historicalInput = z.strictObject({
  familyLabel: z.string().regex(/^[a-z0-9-]+$/),
  tutorLabel: z.string().regex(/^[a-z0-9-]+$/),
  learnerId: z.uuid(),
  subjectSlug: z.string().regex(/^[a-z0-9-]+$/),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  requestId: z.uuid(),
});
export async function prepareHistoricalReviewFixture(
  owner: Owner,
  input: unknown,
  testing = false,
) {
  await requireReviewOwner(owner);
  const v = historicalInput.parse(input);
  if (testing && owner.pool.options.database !== "learli_test")
    throw new Error("Test-only manifest requires owned test database.");
  const manifest = z
    .array(
      z.object({
        email: z.string(),
        userId: z.string(),
        roles: z.array(z.string()),
      }),
    )
    .parse(
      JSON.parse(
        readFileSync(
          testing
            ? ".local/private-review-fixtures.test.json"
            : ".local/fixtures.json",
          "utf8",
        ),
      ),
    );
  const family = manifest.find(
      (e) =>
        e.email === `${v.familyLabel}@fixtures.learli.test` &&
        (e.roles.includes("parent") || e.roles.includes("student")),
    ),
    tutor = manifest.find(
      (e) =>
        e.email === `${v.tutorLabel}@fixtures.learli.test` &&
        e.roles.includes("tutor"),
    );
  if (!family || !tutor || family.userId === tutor.userId)
    throw new Error("Exact owned family and tutor fixtures required.");
  const start = new Date(v.start),
    end = new Date(v.end);
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end.getTime() - start.getTime() !== 3600000
  )
    throw new Error("Real historical60minute fixture required.");
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        familyId: family.userId,
        tutorId: tutor.userId,
        learnerId: v.learnerId,
        subjectSlug: v.subjectSlug,
        start: start.toISOString(),
        end: end.toISOString(),
        purpose: "private-review-historical-v1",
      }),
    )
    .digest("hex");
  const prepared = await owner.db.transaction(async (tx) => {
    const p = await tx.execute<{ id: string }>(
      sql`SELECT tp.id FROM public.tutor_profiles tp JOIN public."user" tu ON tu.id=tp.user_id AND tu.email=${tutor.email} AND tu.email_verified JOIN public.user_access ta ON ta.user_id=tu.id AND ta.status='active' JOIN public.user_roles tr ON tr.user_id=tu.id AND tr.role='tutor' WHERE tp.user_id=${tutor.userId} AND tp.review_status='approved' FOR UPDATE OF tp`,
    );
    if (!p.rows.length)
      throw new Error("Owned eligible tutor fixture required.");
    // Serialize the same family's request across different tutors as well.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`review-history:${family.userId}:${v.requestId}`},0))`,
    );
    const allowed = await tx.execute<{ subjectId: string }>(
      sql`SELECT s.id AS "subjectId" FROM public."user" u JOIN public.user_access a ON a.user_id=u.id AND a.status='active' JOIN public.learner_profiles l ON l.id=${v.learnerId}::uuid AND l.status='active' AND l.source='local_fixture' JOIN public.subjects s ON s.slug=${v.subjectSlug} AND s.is_active JOIN public.tutor_subjects ts ON ts.tutor_id=${p.rows[0].id}::uuid AND ts.subject_id=s.id AND l.level=ANY(ts.levels) JOIN public.tutor_profiles tp ON tp.id=ts.tutor_id AND tp.review_status='approved' JOIN public."user" tu ON tu.id=tp.user_id AND tu.id=${tutor.userId} AND tu.email=${tutor.email} AND tu.email_verified JOIN public.user_access ta ON ta.user_id=tu.id AND ta.status='active' WHERE EXISTS(SELECT 1 FROM public.user_roles tr WHERE tr.user_id=tu.id AND tr.role='tutor') AND u.id=${family.userId} AND u.email=${family.email} AND u.email_verified AND ${end}::timestamptz<=clock_timestamp() AND ((l.management='self' AND l.user_id=u.id AND l.level='college_support' AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='student')) OR (l.management='guardian' AND l.user_id IS NULL AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='parent') AND EXISTS(SELECT 1 FROM public.guardian_learner_links g WHERE g.learner_id=l.id AND g.guardian_user_id=u.id AND g.source='local_fixture' AND g.status='authorized')))`,
    );
    if (!allowed.rows.length)
      throw new Error(
        "Current owned family/learner/offering and ended fixture required.",
      );
    const prior = await tx.execute<{ id: string; requestFingerprint: string }>(
      sql`SELECT id,request_fingerprint AS "requestFingerprint" FROM public.bookings WHERE booked_by_user_id=${family.userId} AND idempotency_key=${v.requestId}::uuid`,
    );
    if (prior.rows.length) {
      if (prior.rows[0].requestFingerprint !== fingerprint)
        throw new Error("Historical request key already has different input.");
      return prior.rows[0].id;
    }
    const clock = await tx.execute<{ now: string }>(
        sql`SELECT clock_timestamp()::text AS now`,
      ),
      createdAt = new Date(clock.rows[0].now);
    const id = randomUUID();
    await tx.insert(bookings).values({
      id,
      logicalBookingId: id,
      source: "local_simulation",
      tutorId: p.rows[0].id,
      learnerId: v.learnerId,
      bookedByUserId: family.userId,
      subjectId: allowed.rows[0].subjectId,
      startAtUtc: start,
      endAtUtc: end,
      displayTimezone: "UTC",
      idempotencyKey: v.requestId,
      requestFingerprint: fingerprint,
      state: "demo_reserved",
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 600000),
    });
    await tx
      .insert(bookingEvents)
      .values({ bookingId: id, event: "demo_reserved", createdAt });
    return id;
  });
  // Preparation is committed before the accepted helper acquires its own tutor lock.
  // On uncertainty, the exact request reuses this row; no date or deadline is rewritten.
  try {
    await completeHistoricalDemoFixture(owner, prepared);
    return { id: prepared, completed: true };
  } catch {
    return { id: prepared, completed: false };
  }
}
