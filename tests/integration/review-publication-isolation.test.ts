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
  submitPublication,
  type PublicationContext,
} from "@/features/review-publication/service";
import {
  readAssignedAdmission,
  mutateAdmissionReview,
} from "@/features/learner-admission/service";
import { observedLock } from "./screening-fixtures";
let w: World,
  moderator: TestAccount,
  f: Awaited<ReturnType<typeof workflowFixture>>,
  c: PublicationContext,
  b: Awaited<ReturnType<typeof completedPublicationBooking>>;
beforeAll(async () => {
  w = openWorld();
  moderator = await createAccount(w, ["admin"]);
}, 60000);
beforeEach(async () => {
  await refreshTestAdmin(w.runtime, moderator, password);
  f = await workflowFixture(w, moderator);
  c = { runtime: w.runtime, publication: await provisionPublicationPolicy(w) };
  b = await completedPublicationBooking(w, f, moderator);
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
async function session(actor: TestAccount) {
  const result = await w.runtime.auth.api.getSession({
    headers: actor.headers,
  });
  if (!result) throw new Error("Actual fixture session required");
  return result.session.id;
}
const incoming = () => ({
  requestId: randomUUID(),
  bookingRevision: b.workflowRevision,
  completionEventId: b.eventId,
  rating: 4,
  comment: "Fictional isolation probe",
});
describe("direct publication runtime SQL isolation", () => {
  it("refuses RR author snapshot before actual admission revoke across tutor wait", async () => {
    const caller = await w.runtime.pool.connect(),
      lock = await w.owner.pool.connect(),
      value = incoming(),
      sid = await session(f.requester);
    try {
      await caller.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await caller.query("SELECT count(*) FROM public.user_roles");
      await lock.query("BEGIN");
      await lock.query("SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE", [
        f.profile.id,
      ]);
      const pending = caller
        .query("SELECT submit_publication_review($1,$2,$3,$4,$5,$6,$7,$8,$9)", [
          f.requester.id,
          sid,
          b.id,
          b.eventId,
          b.workflowRevision,
          policyId(),
          value.requestId,
          4,
          value.comment,
        ])
        .then(
          () => "saved",
          (e) => e.code,
        );
      const done = await Promise.race([
        pending.then((v) => ({ finished: true as const, value: v })),
        observedLock(w, "submit_publication_review").then(() => ({
          finished: false as const,
        })),
      ]);
      if (!done.finished) {
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
      }
      await lock.query("COMMIT");
      expect(await pending).toBe("25001");
    } finally {
      await lock.query("ROLLBACK");
      await caller.query("ROLLBACK");
      lock.release();
      caller.release();
    }
  });
  it("refuses RR moderator snapshot before exact grant revoke across tutor wait", async () => {
    const review = await submitPublication(
      c,
      f.requester.headers,
      b.id,
      incoming(),
    );
    await grantPublication(w, review.id, moderator, policyId());
    const caller = await w.runtime.pool.connect(),
      lock = await w.owner.pool.connect(),
      sid = await session(moderator);
    try {
      await caller.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await caller.query(
        "SELECT count(*) FROM public.publication_moderator_grants",
      );
      await lock.query("BEGIN");
      await lock.query("SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE", [
        f.profile.id,
      ]);
      const pending = caller
        .query("SELECT decide_publication_review($1,$2,$3,$4,$5,$6,$7,$8)", [
          moderator.id,
          sid,
          review.id,
          policyId(),
          0,
          randomUUID(),
          "approved",
          true,
        ])
        .then(
          () => "saved",
          (e) => e.code,
        );
      const done = await Promise.race([
        pending.then((v) => ({ finished: true as const, value: v })),
        observedLock(w, "decide_publication_review").then(() => ({
          finished: false as const,
        })),
      ]);
      if (!done.finished)
        await w.owner.pool.query(
          "UPDATE publication_moderator_grants SET active=false WHERE review_id=$1",
          [review.id],
        );
      await lock.query("COMMIT");
      expect(await pending).toBe("25001");
    } finally {
      await lock.query("ROLLBACK");
      await caller.query("ROLLBACK");
      lock.release();
      caller.release();
    }
  });
  it.each(["SERIALIZABLE", "READ UNCOMMITTED"])(
    "refuses alternate caller isolation %s before writes",
    async (mode) => {
      const caller = await w.runtime.pool.connect();
      try {
        await caller.query(`BEGIN ISOLATION LEVEL ${mode}`);
        await expect(
          caller.query(
            "SELECT submit_publication_review($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            [
              f.requester.id,
              await session(f.requester),
              b.id,
              b.eventId,
              b.workflowRevision,
              policyId(),
              randomUUID(),
              4,
              "",
            ],
          ),
        ).rejects.toMatchObject({ code: "25001" });
      } finally {
        await caller.query("ROLLBACK");
        caller.release();
      }
    },
  );
});
