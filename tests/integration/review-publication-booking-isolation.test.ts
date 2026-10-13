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
import { readWorkflowCandidates } from "@/features/booking-workflows/service";
import { observedLock } from "./screening-fixtures";
let w: World,
  moderator: TestAccount,
  f: Awaited<ReturnType<typeof workflowFixture>>;
beforeAll(async () => {
  w = openWorld();
  moderator = await createAccount(w, ["admin"]);
}, 60000);
beforeEach(async () => {
  await refreshTestAdmin(w.runtime, moderator, password);
  f = await workflowFixture(w, moderator);
}, 60000);
afterAll(async () => {
  await w.owner.pool.query(
    "UPDATE booking_workflow_policy_head SET enabled=false;UPDATE tutor_screening_policy_heads SET status='revoked'",
  );
  await closeWorld(w);
});
async function session(actor: TestAccount) {
  const result = await w.runtime.auth.api.getSession({
    headers: actor.headers,
  });
  if (!result) throw new Error("Actual fixture session required");
  return result.session.id;
}
async function ended() {
  const now = Date.now();
  return historicalWorkflowBooking(w, f, moderator, {
    state: "confirmed",
    start: new Date(now - 7200000),
    end: new Date(now - 3600000),
    created: new Date(now - 10800000),
    expires: new Date(now - 10200000),
  });
}
describe("forward-only W6 direct SQL isolation repair", () => {
  it("refuses RR stale completion task across actual tutor wait and exact grant revoke", async () => {
    const b = await ended();
    await grantWorkflowTask(w, b.logicalBookingId, moderator);
    const caller = await w.runtime.pool.connect(),
      lock = await w.owner.pool.connect(),
      sid = await session(moderator);
    try {
      await caller.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await caller.query("SELECT count(*) FROM booking_workflow_grants");
      await lock.query("BEGIN");
      await lock.query("SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE", [
        f.profile.id,
      ]);
      const pending = caller
        .query(
          "SELECT * FROM change_policy_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
          [
            moderator.id,
            sid,
            b.id,
            randomUUID(),
            f.booking.policyId,
            0,
            "complete",
            "synthetic_completed",
            null,
            null,
            null,
            "a".repeat(64),
          ],
        )
        .then(
          (r) => r.rows[0]?.outcome,
          (e) => e.code,
        );
      const done = await Promise.race([
        pending.then((v) => ({ finished: true as const, value: v })),
        observedLock(w, "change_policy_booking").then(() => ({
          finished: false as const,
        })),
      ]);
      if (!done.finished)
        await w.owner.pool.query(
          "UPDATE booking_workflow_grants SET active=false WHERE logical_booking_id=$1 AND actor_user_id=$2 AND action='complete'",
          [b.logicalBookingId, moderator.id],
        );
      await lock.query("COMMIT");
      expect(await pending).toBe("23514");
    } finally {
      await lock.query("ROLLBACK");
      await caller.query("ROLLBACK");
      lock.release();
      caller.release();
    }
  });
  it("refuses RR create with genuine current eligible slot before mutation", async () => {
    const slot = (
      await readWorkflowCandidates(f.context, f.requester.headers, f.choice)
    )[0];
    if (!slot) throw new Error("Actual eligible candidate required");
    const subject = (
        await w.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
      ).rows[0].id,
      caller = await w.runtime.pool.connect();
    try {
      await caller.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await expect(
        caller.query(
          "SELECT * FROM create_policy_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [
            f.requester.id,
            await session(f.requester),
            randomUUID(),
            f.booking.policyId,
            f.learner.id,
            f.profile.id,
            subject,
            slot.startAtUtc,
            slot.endAtUtc,
            "Asia/Manila",
            "a".repeat(64),
          ],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    } finally {
      await caller.query("ROLLBACK");
      caller.release();
    }
  });
  it("refuses RR dispute entry before response-policy or booking work", async () => {
    const b = await ended(),
      caller = await w.runtime.pool.connect();
    try {
      await caller.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await expect(
        caller.query(
          "SELECT * FROM create_booking_workflow_dispute($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            f.requester.id,
            await session(f.requester),
            b.id,
            randomUUID(),
            "unconfigured-synthetic-response",
            "general",
            "Fictional dispute",
            "Fictional content",
          ],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    } finally {
      await caller.query("ROLLBACK");
      caller.release();
    }
  });
});
