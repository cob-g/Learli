import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  openWorld,
  closeWorld,
  createAccount,
  password,
  type World,
  type TestAccount,
} from "./support";
import { refreshTestAdmin } from "../support/admin-mfa";
import { workflowFixture } from "../support/booking-workflows-fixtures";
import {
  provisionPublicationPolicy,
  grantPublication,
  completedPublicationBooking,
} from "../support/review-publication-fixtures";
import {
  readAuthorPublication,
  submitPublication,
  decidePublication,
  readPublicReviews,
  readModeratorPublication,
  type PublicationContext,
} from "@/features/review-publication/service";
import {
  readAssignedAdmission,
  mutateAdmissionReview,
} from "@/features/learner-admission/service";
import { observedLock } from "./screening-fixtures";
let w: World,
  moderator: TestAccount,
  outsider: TestAccount,
  f: Awaited<ReturnType<typeof workflowFixture>>,
  c: PublicationContext,
  booking: Awaited<ReturnType<typeof completedPublicationBooking>>;
beforeAll(async () => {
  w = openWorld();
  moderator = await createAccount(w, ["admin"]);
  outsider = await createAccount(w, ["admin"]);
}, 60000);
beforeEach(async () => {
  await refreshTestAdmin(w.runtime, moderator, password);
  f = await workflowFixture(w, moderator);
  c = { runtime: w.runtime, publication: await provisionPublicationPolicy(w) };
  booking = await completedPublicationBooking(w, f, moderator);
}, 60000);
afterAll(async () => {
  await w.owner.pool.query(
    "UPDATE review_publication_policy_head SET enabled=false;UPDATE booking_workflow_policy_head SET enabled=false;UPDATE tutor_screening_policy_heads SET status='revoked'",
  );
  await closeWorld(w);
});
const input = (overrides = {}) => ({
  requestId: randomUUID(),
  bookingRevision: booking.workflowRevision,
  completionEventId: booking.eventId,
  rating: 4,
  comment: "Fictional feedback",
  ...overrides,
});
async function revokeAdmission() {
  const a = await readAssignedAdmission(
    f.admissionContext,
    moderator.headers,
    f.admissionId,
  );
  return mutateAdmissionReview(
    f.admissionContext,
    moderator.headers,
    f.admissionId,
    "decision",
    { requestId: randomUUID(), revision: a.revision, action: "revoke" },
  );
}
async function pending() {
  const v = await submitPublication(
    c,
    f.requester.headers,
    booking.id,
    input(),
  );
  await grantPublication(w, v.id, moderator, enabledPolicy());
  return v;
}
function enabledPolicy() {
  if (c.publication.authority === "disabled") throw new Error();
  return c.publication.policyId;
}
const decide = (
  v: { id: string; revision: number },
  state: string,
  privacyChecked = true,
  actor = moderator,
) =>
  decidePublication(c, actor.headers, v.id, {
    requestId: randomUUID(),
    expectedRevision: v.revision,
    state,
    privacyChecked,
  });
async function published() {
  const v = await pending(),
    a = await decide(v, "approved");
  return decide(a, "published");
}
describe("review-publication actual PostgreSQL", () => {
  it("submits exact completed head; private pending does not contribute", async () => {
    const v = await pending();
    expect(v.state).toBe("pending");
    expect(
      (await readAuthorPublication(c, f.requester.headers, booking.id)).review
        ?.id,
    ).toBe(v.id);
    expect(await readPublicReviews(c, f.profile.slug)).toMatchObject({
      count: 0,
      average: null,
      reviews: [],
    });
  });
  it("publishes anonymous allowlist and removes count/average/text on withdrawal", async () => {
    const v = await published(),
      p = await readPublicReviews(c, f.profile.slug);
    expect(p).toMatchObject({
      count: 1,
      average: 4,
      reviews: [
        { authorLabel: "Customer", rating: 4, comment: "Fictional feedback" },
      ],
    });
    expect(Object.keys(p.reviews[0]).sort()).toEqual([
      "authorLabel",
      "comment",
      "date",
      "rating",
    ]);
    expect(JSON.stringify(p)).not.toContain(booking.id);
    expect(JSON.stringify(p)).not.toContain(f.requester.id);
    await decide(v, "withdrawn", false);
    expect(await readPublicReviews(c, f.profile.slug)).toMatchObject({
      count: 0,
      average: null,
      reviews: [],
    });
  });
  it("requires privacy confirmation and sequential manual approval", async () => {
    const v = await pending();
    await expect(decide(v, "approved", false)).rejects.toMatchObject({
      status: 400,
    });
    await expect(decide(v, "published")).rejects.toMatchObject({ status: 400 });
    expect(
      (await readModeratorPublication(c, moderator.headers, v.id)).revision,
    ).toBe(0);
  });
  it("reconsiders immutable rejected or withdrawn text with append-only history", async () => {
    const v = await pending(),
      r = await decide(v, "rejected", false),
      p = await decide(r, "pending", false);
    expect(p.revision).toBe(2);
    expect(p.comment).toBe(v.comment);
    expect(p.history.map((e) => e.nextState)).toEqual([
      "pending",
      "rejected",
      "pending",
    ]);
  });
  it("retries exact submission once and rejects changed payload or new duplicate key", async () => {
    const value = input(),
      rows = await Promise.all([
        submitPublication(c, f.requester.headers, booking.id, value),
        submitPublication(c, f.requester.headers, booking.id, value),
      ]);
    expect(rows[0].id).toBe(rows[1].id);
    await expect(
      submitPublication(c, f.requester.headers, booking.id, {
        ...value,
        rating: 2,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      submitPublication(c, f.requester.headers, booking.id, input()),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("two distinct concurrent submissions yield exactly one logical review", async () => {
    const rows = await Promise.allSettled([
      submitPublication(c, f.requester.headers, booking.id, input()),
      submitPublication(c, f.requester.headers, booking.id, input()),
    ]);
    expect(rows.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM publication_reviews WHERE logical_booking_id=$1",
          [booking.logicalBookingId],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("denies unrelated author/tutor and missing completion event/revision", async () => {
    await expect(
      submitPublication(c, outsider.headers, booking.id, input()),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      submitPublication(c, f.tutor.headers, booking.id, input()),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      submitPublication(
        c,
        f.requester.headers,
        booking.id,
        input({ completionEventId: randomUUID() }),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      submitPublication(
        c,
        f.requester.headers,
        booking.id,
        input({ bookingRevision: 0 }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("denies wrong exact moderator and self moderation", async () => {
    const v = await pending();
    await refreshTestAdmin(w.runtime, outsider, password);
    await expect(decide(v, "approved", true, outsider)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      readModeratorPublication(c, outsider.headers, v.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      readAuthorPublication(c, outsider.headers, booking.id),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("exact decision retry appends once and differing stale writes conflict", async () => {
    const v = await pending(),
      value = {
        requestId: randomUUID(),
        expectedRevision: 0,
        state: "approved",
        privacyChecked: true,
      };
    const rows = await Promise.all([
      decidePublication(c, moderator.headers, v.id, value),
      decidePublication(c, moderator.headers, v.id, value),
    ]);
    expect(rows[0].revision).toBe(1);
    expect(rows[1].revision).toBe(1);
    expect(rows[1].history).toHaveLength(2);
    await expect(decide(v, "rejected", false)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("concurrent publish/return-to-pending has one current revision winner", async () => {
    const a = await decide(await pending(), "approved"),
      rows = await Promise.allSettled([
        decide(a, "published"),
        decide(a, "pending", false),
      ]);
    expect(rows.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (await readModeratorPublication(c, moderator.headers, a.id)).revision,
    ).toBe(2);
  });
  it("author logout preserves public visibility but private reads lose exact session", async () => {
    await published();
    await w.owner.pool.query("DELETE FROM session WHERE user_id=$1", [
      f.requester.id,
    ]);
    expect((await readPublicReviews(c, f.profile.slug)).count).toBe(1);
    await expect(
      readAuthorPublication(c, f.requester.headers, booking.id),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("approval retry cannot bypass current beneficiary revocation", async () => {
    const v = await pending(),
      value = {
        requestId: randomUUID(),
        expectedRevision: 0,
        state: "approved",
        privacyChecked: true,
      };
    await decidePublication(c, moderator.headers, v.id, value);
    await revokeAdmission();
    await expect(
      decidePublication(c, moderator.headers, v.id, value),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("current beneficiary revocation removes all public contribution", async () => {
    await published();
    await revokeAdmission();
    expect((await readPublicReviews(c, f.profile.slug)).count).toBe(0);
  });
  it("current publication policy disable removes projection and mutation capability", async () => {
    const v = await published();
    await w.owner.pool.query(
      "UPDATE review_publication_policy_head SET enabled=false",
    );
    expect((await readPublicReviews(c, f.profile.slug)).count).toBe(0);
    await expect(decide(v, "withdrawn", false)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("tutor suspension removes publication and exact moderator can still withdraw", async () => {
    const v = await published();
    await w.owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
      [f.profile.id],
    );
    expect((await readPublicReviews(c, f.profile.slug)).count).toBe(0);
    expect((await decide(v, "withdrawn", false)).state).toBe("withdrawn");
  });
  it("production synthetic capability and default disabled fail before writes", async () => {
    await expect(
      readPublicReviews(
        { ...c, publication: { authority: "disabled" } },
        f.profile.slug,
      ),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      readPublicReviews(
        {
          ...c,
          runtime: { ...w.runtime, environment: "development" as const },
        },
        f.profile.slug,
      ),
    ).rejects.toThrow();
  });
  it("revoked moderator after actual tutor lock wait rolls back decision/history", async () => {
    const v = await pending(),
      lock = await w.owner.pool.connect();
    try {
      await lock.query("BEGIN");
      await lock.query("SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE", [
        f.profile.id,
      ]);
      const result = decide(v, "approved").then(
        () => "saved",
        (e) => e.status,
      );
      await observedLock(w, "decide_publication_review");
      await w.owner.pool.query(
        "UPDATE publication_moderator_grants SET active=false WHERE review_id=$1",
        [v.id],
      );
      await lock.query("COMMIT");
      expect(await result).toBe(404);
      expect(
        (
          await w.owner.pool.query(
            "SELECT state,revision FROM publication_reviews WHERE id=$1",
            [v.id],
          )
        ).rows[0],
      ).toEqual({ state: "pending", revision: 0 });
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
    }
  });
  it("late audit wait then revocation rolls back updated state and audit", async () => {
    const v = await pending(),
      lock = await w.owner.pool.connect();
    try {
      await lock.query("BEGIN");
      await lock.query("LOCK TABLE publication_review_events IN SHARE MODE");
      const result = decide(v, "approved").then(
        () => "saved",
        (e) => e.status,
      );
      await observedLock(w, "decide_publication_review");
      await w.owner.pool.query(
        "UPDATE publication_moderator_grants SET active=false WHERE review_id=$1",
        [v.id],
      );
      await lock.query("COMMIT");
      expect(await result).toBe(404);
      expect(
        (
          await w.owner.pool.query(
            "SELECT state,revision FROM publication_reviews WHERE id=$1",
            [v.id],
          )
        ).rows[0],
      ).toEqual({ state: "pending", revision: 0 });
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
    }
  });
  it("runtime cannot edit submission/grants/audit and owner cannot rewrite immutable payload", async () => {
    const v = await pending();
    for (const q of [
      "UPDATE publication_reviews SET rating=1",
      "DELETE FROM publication_reviews",
      "UPDATE publication_moderator_grants SET active=true",
      "UPDATE publication_review_events SET privacy_checked=true",
      "INSERT INTO review_publication_policy_head(source,policy_id) VALUES('synthetic_readiness',gen_random_uuid())",
    ])
      await expect(w.runtime.pool.query(q)).rejects.toMatchObject({
        code: "42501",
      });
    await expect(
      w.owner.pool.query(
        "UPDATE publication_reviews SET comment='changed' WHERE id=$1",
        [v.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      w.owner.pool.query(
        "UPDATE publication_review_events SET privacy_checked=true WHERE review_id=$1",
        [v.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it.each(Array.from({ length: 9 }, (_, i) => i))(
    "direct NULL submit argument %i fails closed",
    async (index) => {
      const args: unknown[] = [
        f.requester.id,
        "fake-session",
        booking.id,
        booking.eventId,
        booking.workflowRevision,
        enabledPolicy(),
        randomUUID(),
        4,
        "",
      ];
      args[index] = null;
      await expect(
        w.runtime.pool.query(
          "SELECT submit_publication_review($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          args,
        ),
      ).rejects.toMatchObject({ code: "23514" });
    },
  );
  it.each(Array.from({ length: 8 }, (_, i) => i))(
    "direct NULL decision argument %i fails closed",
    async (index) => {
      const args: unknown[] = [
        moderator.id,
        "fake-session",
        randomUUID(),
        enabledPolicy(),
        0,
        randomUUID(),
        "approved",
        true,
      ];
      args[index] = null;
      await expect(
        w.runtime.pool.query(
          "SELECT decide_publication_review($1,$2,$3,$4,$5,$6,$7,$8)",
          args,
        ),
      ).rejects.toMatchObject({ code: "23514" });
    },
  );
});
