import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  openWorld,
  closeWorld,
  createAccount,
  jsonRequest,
  type World,
  type TestAccount,
} from "./support";
import {
  workflowFixture,
  historicalWorkflowBooking,
  grantWorkflowTask,
  provisionBookingPolicy,
} from "../support/booking-workflows-fixtures";
import {
  changePolicyBooking,
  readTutorCompletion,
} from "@/features/booking-workflows/service";
import { handleWorkflowMutation } from "@/features/booking-workflows/handler";
import {
  readParticipantBooking,
  listParticipantBookingOverview,
} from "@/features/bookings/read-service";
import {
  mutateAdmissionReview,
  readAssignedAdmission,
} from "@/features/learner-admission/service";
import { observedLock } from "./screening-fixtures";

let w: World,
  reviewer: TestAccount,
  foreign: TestAccount,
  f: Awaited<ReturnType<typeof workflowFixture>>;
beforeAll(async () => {
  w = openWorld();
  reviewer = await createAccount(w, ["admin"]);
  foreign = await createAccount(w, ["tutor"]);
});
beforeEach(async () => {
  f = await workflowFixture(w, reviewer, "guardian", "tutor");
});
afterAll(async () => {
  await w.owner.pool.query(
    "UPDATE booking_workflow_policy_head SET enabled=false",
  );
  await closeWorld(w);
});
async function historical(
  state: "confirmed" | "provisional" = "confirmed",
  future = false,
) {
  const now = Date.now();
  return historicalWorkflowBooking(w, f, reviewer, {
    state,
    start: new Date(now + (future ? 2 : -2) * 3600000),
    end: new Date(now + (future ? 3 : -1) * 3600000),
    created: new Date(now - 86400000),
    expires: new Date(now + (state === "provisional" ? 600000 : -80000000)),
  });
}
const input = (requestId = randomUUID()) => ({
  requestId,
  expectedRevision: 0,
  reasonCode: "synthetic_completed",
});
const complete = (id: string, account = f.tutor, value = input()) =>
  changePolicyBooking(f.context, account.headers, id, "complete", value);
async function saved(id: string) {
  const row = (
    await w.owner.pool.query(
      "SELECT state,workflow_revision AS revision FROM bookings WHERE id=$1",
      [id],
    )
  ).rows[0];
  const events = (
    await w.owner.pool.query(
      "SELECT actor_user_id,event,created_at,workflow_revision FROM booking_lifecycle_events WHERE booking_id=$1 AND event='workflow_completed'",
      [id],
    )
  ).rows;
  return { row, events };
}
async function sessionId(account: TestAccount) {
  return (
    await w.owner.pool.query(
      "SELECT id FROM session WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1",
      [account.id],
    )
  ).rows[0].id as string;
}
async function restrictedComplete(
  id: string,
  account: TestAccount,
  session = "",
) {
  return (
    await w.runtime.pool.query(
      "SELECT * FROM change_policy_booking($1,$2,$3,$4,$5,0,'complete','synthetic_completed',NULL,NULL,NULL,$6)",
      [
        account.id,
        session || (await sessionId(account)),
        id,
        randomUUID(),
        f.booking.policyId,
        "a".repeat(64),
      ],
    )
  ).rows[0];
}

describe("assigned Tutor administrative completion under versioned policy", () => {
  it("records the tutor, one atomic completion event and matching parent/tutor history", async () => {
    const b = await historical();
    expect(await readTutorCompletion(f.context, f.tutor.headers, b.id)).toEqual(
      { id: b.id, workflowRevision: 0 },
    );
    expect((await saved(b.id)).row.state).toBe("confirmed"); // A GET/time passing does not complete.
    const completed = await complete(b.id);
    expect(completed).toMatchObject({
      id: b.id,
      state: "completed",
      workflowRevision: 1,
    });
    const stored = await saved(b.id);
    expect(stored.row).toEqual({ state: "completed", revision: 1 });
    expect(stored.events).toHaveLength(1);
    expect(stored.events[0]).toMatchObject({
      actor_user_id: f.tutor.id,
      event: "workflow_completed",
      workflow_revision: 1,
    });
    expect(stored.events[0].created_at).toBeInstanceOf(Date);
    expect(
      await readTutorCompletion(f.context, f.tutor.headers, b.id),
    ).toBeNull();
    for (const [account, scope] of [
      [f.requester, "guardian"],
      [f.tutor, "tutor"],
    ] as const) {
      const detail = await readParticipantBooking(
        w.runtime,
        account.headers,
        b.id,
        scope,
      );
      expect(detail).toMatchObject({
        id: b.id,
        state: "completed",
        tutor: { displayName: f.tutor.name },
        learner: { displayName: f.learner.displayName },
      });
      expect(detail.events.some((e) => e.event === "workflow_completed")).toBe(
        true,
      );
      const overview = await listParticipantBookingOverview(
        w.runtime,
        account.headers,
        { scope },
      );
      expect(
        overview.history.items.some(
          (item) => item.id === b.id && item.state === "completed",
        ),
      ).toBe(true);
      expect(overview.active.items.some((item) => item.id === b.id)).toBe(
        false,
      );
    }
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM booking_workflow_notice_intents WHERE event_id=$1",
          [completed.eventId],
        )
      ).rows[0].n,
    ).toBe(2);
  });
  it("makes identical concurrent retries one event and rejects a conflicting new request", async () => {
    const b = await historical(),
      v = input();
    const receipts = await Promise.all(
      Array.from({ length: 4 }, () => complete(b.id, f.tutor, v)),
    );
    expect(new Set(receipts.map((r) => r.eventId)).size).toBe(1);
    expect((await saved(b.id)).events).toHaveLength(1);
    await expect(complete(b.id)).rejects.toMatchObject({ status: 409 });
  });
  it.each([
    "parent",
    "foreign_tutor",
    "admin",
    "suspended",
    "unverified",
    "expired",
    "revoked_session",
    "revoked_role",
    "screening",
    "guardian",
    "policy",
  ] as const)(
    "rejects %s at service and restricted SQL boundaries",
    async (mode) => {
      const b = await historical();
      let account = f.tutor;
      if (mode === "parent") account = f.requester;
      if (mode === "foreign_tutor") account = foreign;
      if (mode === "admin") {
        account = reviewer;
        await grantWorkflowTask(w, b.logicalBookingId, reviewer);
      }
      const session = await sessionId(account);
      if (mode === "suspended")
        await w.owner.pool.query(
          "UPDATE user_access SET status='suspended' WHERE user_id=$1",
          [account.id],
        );
      if (mode === "unverified")
        await w.owner.pool.query(
          'UPDATE "user" SET email_verified=false WHERE id=$1',
          [account.id],
        );
      if (mode === "expired")
        await w.owner.pool.query(
          "UPDATE session SET expires_at=clock_timestamp()-interval '1 minute' WHERE id=$1",
          [session],
        );
      if (mode === "revoked_session")
        await w.owner.pool.query("DELETE FROM session WHERE id=$1", [session]);
      if (mode === "revoked_role")
        await w.owner.pool.query(
          "DELETE FROM user_roles WHERE user_id=$1 AND role='tutor'",
          [account.id],
        );
      if (mode === "screening")
        await w.owner.pool.query(
          "UPDATE tutor_screening_policy_heads SET status='revoked'",
        );
      if (mode === "guardian") {
        const a = await readAssignedAdmission(
          f.admissionContext,
          reviewer.headers,
          f.admissionId,
        );
        await mutateAdmissionReview(
          f.admissionContext,
          reviewer.headers,
          f.admissionId,
          "decision",
          { requestId: randomUUID(), revision: a.revision, action: "revoke" },
        );
      }
      if (mode === "policy")
        await w.owner.pool.query(
          "UPDATE booking_workflow_policy_head SET enabled=false",
        );
      const status = ["expired", "revoked_session"].includes(mode)
        ? 401
        : ["suspended", "unverified"].includes(mode)
          ? 403
          : mode === "policy"
            ? 503
            : 404;
      await expect(complete(b.id, account)).rejects.toMatchObject({ status });
      expect((await restrictedComplete(b.id, account, session)).outcome).toBe(
        mode === "policy" ? "policy_unavailable" : "forbidden",
      );
      expect(await saved(b.id)).toEqual({
        row: { state: "confirmed", revision: 0 },
        events: [],
      });
    },
  );
  it("denies early/provisional/cancelled work and keeps confirmation/no-show admin-only", async () => {
    const future = await historical("confirmed", true);
    expect(
      await readTutorCompletion(f.context, f.tutor.headers, future.id),
    ).toBeNull();
    await expect(complete(future.id)).rejects.toMatchObject({ status: 409 });
    const provisional = await historical("provisional");
    await expect(complete(provisional.id)).rejects.toMatchObject({
      status: 404,
    });
    for (const action of ["confirm", "no_show"] as const)
      await expect(
        changePolicyBooking(f.context, f.tutor.headers, future.id, action, {
          ...input(),
          reasonCode:
            action === "confirm"
              ? "synthetic_prerequisite_review"
              : "synthetic_no_show",
        }),
      ).rejects.toMatchObject({ status: 403 });
    await changePolicyBooking(
      f.context,
      f.requester.headers,
      future.id,
      "cancel",
      { ...input(), reasonCode: "synthetic_participant_change" },
    );
    await expect(complete(future.id)).rejects.toMatchObject({ status: 404 });
  });
  it("does not reinterpret immutable v1 bookings or give their Tutor completion rights", async () => {
    const booking = await provisionBookingPolicy(w, f.admission.policyId);
    f = { ...f, booking, context: { ...f.context, booking } };
    const b = await historical();
    expect(
      await readTutorCompletion(f.context, f.tutor.headers, b.id),
    ).toBeNull();
    await expect(complete(b.id)).rejects.toMatchObject({ status: 403 });
    expect((await restrictedComplete(b.id, f.tutor)).outcome).toBe("forbidden");
    await grantWorkflowTask(w, b.logicalBookingId, reviewer);
    expect(await complete(b.id, reviewer)).toMatchObject({
      state: "completed",
    });
  });
  it("rejects forged actor fields and remains unavailable in the shipped default", async () => {
    const b = await historical();
    const request = (body: unknown) =>
      jsonRequest(w, `/api/bookings/${b.id}/workflow/complete`, {
        body,
        cookie: f.tutor.cookie,
      });
    expect(
      (
        await handleWorkflowMutation(
          w.runtime,
          request({ ...input(), actorId: reviewer.id }),
          b.id,
          "complete",
          f.context,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handleWorkflowMutation(
          w.runtime,
          request(input()),
          b.id,
          "complete",
        )
      ).status,
    ).toBe(503);
    expect(
      (await restrictedComplete(b.id, f.tutor, await sessionId(f.requester)))
        .outcome,
    ).toBe("forbidden");
    expect((await saved(b.id)).events).toEqual([]);
  });
  it("rolls state and intent back on event failure and permits a safe retry", async () => {
    const b = await historical();
    await w.owner.pool.query(
      "ALTER TABLE booking_lifecycle_events ADD CONSTRAINT completion_fault CHECK(event<>'workflow_completed') NOT VALID",
    );
    try {
      await expect(complete(b.id)).rejects.toBeDefined();
      expect(await saved(b.id)).toEqual({
        row: { state: "confirmed", revision: 0 },
        events: [],
      });
    } finally {
      await w.owner.pool.query(
        "ALTER TABLE booking_lifecycle_events DROP CONSTRAINT completion_fault",
      );
    }
    expect(await complete(b.id)).toMatchObject({ state: "completed" });
  });
  it("rechecks current tutor authority after waiting for the existing tutor lock", async () => {
    const b = await historical(),
      blocker = await w.owner.pool.connect();
    let settled: Promise<unknown> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
        [f.profile.id],
      );
      settled = complete(b.id).then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      await observedLock(w, "t.id");
      await blocker.query(
        "UPDATE user_access SET status='suspended' WHERE user_id=$1",
        [f.tutor.id],
      );
      await blocker.query("COMMIT");
      expect(await settled).toMatchObject({ error: { status: 404 } });
      expect((await saved(b.id)).events).toEqual([]);
    } finally {
      await blocker.query("ROLLBACK");
      await settled;
      blocker.release();
    }
  });
  it("rechecks authorization after writes and rolls the entire operation back", async () => {
    const b = await historical();
    await w.owner.pool.query(
      `CREATE FUNCTION public.test_revoke_completion_actor() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='workflow_completed' THEN DELETE FROM public.user_roles WHERE user_id=NEW.actor_user_id AND role='tutor'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_revoke_completion_actor AFTER INSERT ON booking_lifecycle_events FOR EACH ROW EXECUTE FUNCTION public.test_revoke_completion_actor()`,
    );
    try {
      await expect(complete(b.id)).rejects.toMatchObject({ status: 404 });
      expect(await saved(b.id)).toEqual({
        row: { state: "confirmed", revision: 0 },
        events: [],
      });
      expect(
        (
          await w.owner.pool.query(
            "SELECT role FROM user_roles WHERE user_id=$1 AND role='tutor'",
            [f.tutor.id],
          )
        ).rowCount,
      ).toBe(1);
    } finally {
      await w.owner.pool.query(
        "DROP TRIGGER test_revoke_completion_actor ON booking_lifecycle_events; DROP FUNCTION public.test_revoke_completion_actor()",
      );
    }
  });
});
