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
import {
  workflowFixture,
  historicalWorkflowBooking,
  grantWorkflowTask,
} from "../support/booking-workflows-fixtures";
import {
  provisionPublicationPolicy,
  completedPublicationBooking,
  grantPublication,
} from "../support/review-publication-fixtures";
import {
  readPublicReviews,
  submitPublication,
  decidePublication,
  type PublicationContext,
} from "@/features/review-publication/service";
import {
  readAssignedAdmission,
  mutateAdmissionReview,
} from "@/features/learner-admission/service";
import { changePolicyBooking } from "@/features/booking-workflows/service";
import { completeHistoricalDemoFixture } from "@/features/bookings/fixture-tooling";
import { submitReview } from "@/features/private-reviews/service";
import { observedLock } from "./screening-fixtures";
let w: World,
  moderator: TestAccount,
  f: Awaited<ReturnType<typeof workflowFixture>>,
  c: PublicationContext;
beforeAll(async () => {
  w = openWorld();
  moderator = await createAccount(w, ["admin"]);
}, 60000);
beforeEach(async () => {
  await refreshTestAdmin(w.runtime, moderator, password);
  f = await workflowFixture(w, moderator);
  c = { runtime: w.runtime, publication: await provisionPublicationPolicy(w) };
}, 60000);
afterAll(async () => {
  await w.owner.pool.query(
    "UPDATE review_publication_policy_head SET enabled=false;UPDATE booking_workflow_policy_head SET enabled=false;UPDATE tutor_screening_policy_heads SET status='revoked'",
  );
  await closeWorld(w);
});
function policyId() {
  if (c.publication.authority === "disabled") throw new Error();
  return c.publication.policyId;
}
async function publish(rating: number) {
  const b = await completedPublicationBooking(w, f, moderator),
    r = await submitPublication(c, f.requester.headers, b.id, {
      requestId: randomUUID(),
      bookingRevision: b.workflowRevision,
      completionEventId: b.eventId,
      rating,
      comment: `Fictional rating ${rating}`,
    });
  await grantPublication(w, r.id, moderator, policyId());
  const a = await decidePublication(c, moderator.headers, r.id, {
    requestId: randomUUID(),
    expectedRevision: 0,
    state: "approved",
    privacyChecked: true,
  });
  const p = await decidePublication(c, moderator.headers, r.id, {
    requestId: randomUUID(),
    expectedRevision: a.revision,
    state: "published",
    privacyChecked: true,
  });
  return { b, r: p };
}
describe("publication source/provenance/current visibility boundaries", () => {
  it("count/average/rows share the same exact two-review set and one withdrawal", async () => {
    const first = await publish(2);
    await publish(5);
    const both = await readPublicReviews(c, f.profile.slug);
    expect(both.count).toBe(2);
    expect(both.average).toBe(3.5);
    expect(both.reviews.map((r) => r.rating).sort()).toEqual([2, 5]);
    await decidePublication(c, moderator.headers, first.r.id, {
      requestId: randomUUID(),
      expectedRevision: 2,
      state: "withdrawn",
      privacyChecked: false,
    });
    const after = await readPublicReviews(c, f.profile.slug);
    expect(after.count).toBe(1);
    expect(after.average).toBe(5);
    expect(after.reviews.map((r) => r.rating)).toEqual([5]);
  });
  it("administrative no-show is ineligible even with an ended current booking", async () => {
    const now = Date.now(),
      b = await historicalWorkflowBooking(w, f, moderator, {
        state: "confirmed",
        start: new Date(now - 7200000),
        end: new Date(now - 3600000),
        created: new Date(now - 10800000),
        expires: new Date(now - 10200000),
      });
    await grantWorkflowTask(w, b.logicalBookingId, moderator);
    const ended = await changePolicyBooking(
      f.context,
      moderator.headers,
      b.id,
      "no_show",
      {
        requestId: randomUUID(),
        expectedRevision: 0,
        reasonCode: "synthetic_no_show",
      },
    );
    await expect(
      submitPublication(c, f.requester.headers, ended.id, {
        requestId: randomUUID(),
        bookingRevision: ended.workflowRevision,
        completionEventId: ended.eventId,
        rating: 4,
        comment: "Fictional",
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect((await readPublicReviews(c, f.profile.slug)).count).toBe(0);
  });
  it("foreign completed-event provenance cannot stand in for the current booking event", async () => {
    const b1 = await completedPublicationBooking(w, f, moderator),
      b2 = await completedPublicationBooking(w, f, moderator);
    await expect(
      submitPublication(c, f.requester.headers, b1.id, {
        requestId: randomUUID(),
        bookingRevision: b1.workflowRevision,
        completionEventId: b2.eventId,
        rating: 4,
        comment: "Fictional",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("screening/public tutor account restriction removes every contribution", async () => {
    await publish(4);
    await w.owner.pool.query(
      "UPDATE user_access SET status='suspended' WHERE user_id=$1",
      [f.tutor.id],
    );
    const p = await readPublicReviews(c, f.profile.slug);
    expect(p.count).toBe(0);
    expect(p.average).toBeNull();
    expect(p.reviews).toEqual([]);
  });
  it("booking policy current-head switch removes stale-policy publication", async () => {
    await publish(4);
    await w.owner.pool.query(
      "UPDATE booking_workflow_policy_head SET enabled=false",
    );
    expect((await readPublicReviews(c, f.profile.slug)).count).toBe(0);
  });
  it("a new current publication policy never retroactively promotes an old decision", async () => {
    await publish(4);
    const next = await provisionPublicationPolicy(w);
    expect((await readPublicReviews(c, f.profile.slug)).count).toBe(0);
    expect(
      (await readPublicReviews({ ...c, publication: next }, f.profile.slug))
        .count,
    ).toBe(0);
  });
  it("late submission audit wait then actual admission revoke rolls back submission/event", async () => {
    const b = await completedPublicationBooking(w, f, moderator),
      lock = await w.owner.pool.connect();
    try {
      await lock.query("BEGIN");
      await lock.query("LOCK TABLE publication_review_events IN SHARE MODE");
      const result = submitPublication(c, f.requester.headers, b.id, {
        requestId: randomUUID(),
        bookingRevision: b.workflowRevision,
        completionEventId: b.eventId,
        rating: 4,
        comment: "Fictional",
      }).then(
        () => "saved",
        (e) => e.status,
      );
      await observedLock(w, "submit_publication_review");
      const a = await readAssignedAdmission(
        f.admissionContext,
        moderator.headers,
        f.admissionId,
      );
      await mutateAdmissionReview(
        f.admissionContext,
        moderator.headers,
        f.admissionId,
        "decision",
        { requestId: randomUUID(), revision: a.revision, action: "revoke" },
      );
      await lock.query("COMMIT");
      expect(await result).toBe(404);
      expect(
        (
          await w.owner.pool.query(
            "SELECT count(*)::int n FROM publication_reviews WHERE logical_booking_id=$1",
            [b.logicalBookingId],
          )
        ).rows[0].n,
      ).toBe(0);
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
    }
  });
  it.each(["author", "tutor"] as const)(
    "actual MFA %s with exact active grant cannot self-moderate",
    async (kind) => {
      const booking = await completedPublicationBooking(w, f, moderator);
      const review = await submitPublication(
        c,
        f.requester.headers,
        booking.id,
        {
          requestId: randomUUID(),
          bookingRevision: booking.workflowRevision,
          completionEventId: booking.eventId,
          rating: 4,
          comment: "Fictional self-exclusion probe",
        },
      );
      const actor = kind === "author" ? f.requester : f.tutor;
      await w.owner.pool.query(
        "INSERT INTO user_roles(user_id,role) VALUES($1,'admin') ON CONFLICT DO NOTHING",
        [actor.id],
      );
      await refreshTestAdmin(w.runtime, actor, password);
      await grantPublication(w, review.id, actor, policyId());
      const state = await w.runtime.auth.api.getSession({
        headers: actor.headers,
      });
      if (!state) throw new Error("Actual current MFA session required");
      expect(
        (
          await w.runtime.pool.query(
            "SELECT has_admin_assurance($1,$2,28800) AS allowed",
            [actor.id, state.session.id],
          )
        ).rows[0].allowed,
      ).toBe(true);
      await expect(
        decidePublication(c, actor.headers, review.id, {
          requestId: randomUUID(),
          expectedRevision: 0,
          state: "approved",
          privacyChecked: true,
        }),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        (
          await w.owner.pool.query(
            "SELECT state,revision FROM publication_reviews WHERE id=$1",
            [review.id],
          )
        ).rows[0],
      ).toEqual({ state: "pending", revision: 0 });
    },
  );
  it("actual historical private review remains permanently excluded and immutable", async () => {
    const parent = await createAccount(w, ["parent"]),
      learner = randomUUID(),
      booking = randomUUID();
    await w.owner.pool.query(
      "INSERT INTO learner_profiles(id,fixture_key,source,management,display_name,level,timezone) VALUES($1,$2,'local_fixture','guardian','Fictional private learner','high_school','UTC')",
      [learner, randomUUID()],
    );
    await w.owner.pool.query(
      "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
      [parent.id, learner],
    );
    const subject = (
      await w.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
    ).rows[0].id;
    await w.owner.pool.query(
      "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) VALUES($1,'local_simulation',$2,$3,$4,$5,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour','UTC',$6,$7,'demo_reserved',clock_timestamp()-interval '3 hours',clock_timestamp()+interval '10 minutes')",
      [
        booking,
        f.profile.id,
        learner,
        parent.id,
        subject,
        randomUUID(),
        "b".repeat(64),
      ],
    );
    await completeHistoricalDemoFixture(w.owner, booking);
    const privateReview = await submitReview(
      w.runtime,
      parent.headers,
      booking,
      {
        requestId: randomUUID(),
        expectedRevision: 0,
        rating: 5,
        comment: "Private fixture must never appear",
      },
    );
    expect((await readPublicReviews(c, f.profile.slug)).reviews).toEqual([]);
    const event = (
      await w.owner.pool.query(
        "SELECT id FROM booking_lifecycle_events WHERE booking_id=$1 AND event='demo_completed'",
        [booking],
      )
    ).rows[0].id;
    await expect(
      submitPublication(c, parent.headers, booking, {
        requestId: randomUUID(),
        bookingRevision: 0,
        completionEventId: event,
        rating: 5,
        comment: "Private fixture must never appear",
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await w.owner.pool.query(
          "SELECT source,comment FROM private_booking_reviews WHERE id=$1",
          [privateReview.id],
        )
      ).rows[0],
    ).toEqual({
      source: "local_synthetic",
      comment: "Private fixture must never appear",
    });
  });
});
