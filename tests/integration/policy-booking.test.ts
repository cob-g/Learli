import { refreshTestAdmin } from "../support/admin-mfa";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  mutateAdmissionReview,
  readAssignedAdmission,
} from "@/features/learner-admission/service";
import { observedLock } from "./screening-fixtures";
import { sql } from "drizzle-orm";
import {
  openWorld,
  closeWorld,
  createAccount,
  password,
  type World,
  type TestAccount,
} from "./support";
import {
  workflowFixture,
  grantWorkflowTask,
  historicalWorkflowBooking,
} from "../support/booking-workflows-fixtures";
import {
  createPolicyReservation,
  readWorkflowCandidates,
  readWorkflowMoveCandidates,
  changePolicyBooking,
} from "@/features/booking-workflows/service";
import { formatLessonTime } from "@/features/bookings/format-time";
import {
  readParticipantBooking,
  listParticipantBookingOverview,
} from "@/features/bookings/read-service";
import {
  readCurrentBookingNoticeRecipients,
  currentCompletionEligibilityPredicate,
} from "@/features/booking-workflows/provider";
import {
  savePrivateMeetingLink,
  readPrivateMeetingLink,
} from "@/features/booking-meeting-links/service";
let w: World,
  reviewer: TestAccount,
  outsider: TestAccount,
  f: Awaited<ReturnType<typeof workflowFixture>>;
beforeAll(async () => {
  w = openWorld();
  reviewer = await createAccount(w, ["admin"], "Fictional W6 reviewer");
  outsider = await createAccount(w, ["admin"], "Unassigned W6 reviewer");
}, 60000);
beforeEach(async () => {
  await refreshTestAdmin(w.runtime, reviewer, password);
  f = await workflowFixture(w, reviewer);
}, 60000);
afterAll(async () => {
  await w.owner.pool.query(
    "UPDATE booking_workflow_policy_head SET enabled=false",
  );
  await w.owner.pool.query(
    "UPDATE tutor_screening_policy_heads SET status='revoked'",
  );
  await closeWorld(w);
});
async function request(index = 6) {
  const slots = await readWorkflowCandidates(
      f.context,
      f.requester.headers,
      f.choice,
    ),
    t = slots[index];
  if (!t) throw new Error("Required actual slot unavailable");
  const value = {
    ...f.choice,
    startAtUtc: t.startAtUtc,
    endAtUtc: t.endAtUtc,
    idempotencyKey: randomUUID(),
  };
  return {
    value,
    receipt: await createPolicyReservation(
      f.context,
      f.requester.headers,
      value,
    ),
  };
}
const change = (
  receipt: { id: string; workflowRevision: number },
  action: "confirm" | "cancel" | "complete" | "no_show",
  actor = reviewer,
) =>
  changePolicyBooking(f.context, actor.headers, receipt.id, action, {
    requestId: randomUUID(),
    expectedRevision: receipt.workflowRevision,
    reasonCode:
      action === "confirm"
        ? "synthetic_prerequisite_review"
        : action === "cancel"
          ? "synthetic_participant_change"
          : action === "complete"
            ? "synthetic_completed"
            : "synthetic_no_show",
  });
async function confirmed() {
  const r = await request();
  await grantWorkflowTask(w, r.receipt.logicalBookingId, reviewer);
  return { ...r, receipt: await change(r.receipt, "confirm") };
}
describe("policy booking actual PostgreSQL authority and integrity", () => {
  it("requires policy and exact authorized admission instead of an existing demo role", async () => {
    await expect(
      createPolicyReservation(
        { ...f.context, booking: { authority: "disabled" } },
        f.requester.headers,
        {},
      ),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      readWorkflowCandidates(f.context, outsider.headers, f.choice),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("creates one provisional/event/two intents across parallel identical retries", async () => {
    const slots = await readWorkflowCandidates(
        f.context,
        f.requester.headers,
        f.choice,
      ),
      t = slots[8],
      value = {
        ...f.choice,
        startAtUtc: t.startAtUtc,
        endAtUtc: t.endAtUtc,
        idempotencyKey: randomUUID(),
      };
    const results = await Promise.all([
      createPolicyReservation(f.context, f.requester.headers, value),
      createPolicyReservation(f.context, f.requester.headers, value),
    ]);
    expect(results[0].id).toBe(results[1].id);
    expect(results[0].eventId).toBe(results[1].eventId);
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM booking_workflow_notice_intents WHERE event_id=$1",
          [results[0].eventId],
        )
      ).rows[0].n,
    ).toBe(2);
  });
  it("resolves simultaneous overlapping different keys atomically", async () => {
    const slots = await readWorkflowCandidates(
        f.context,
        f.requester.headers,
        f.choice,
      ),
      t = slots[8],
      v = { ...f.choice, startAtUtc: t.startAtUtc, endAtUtc: t.endAtUtc };
    const r = await Promise.allSettled([
      createPolicyReservation(f.context, f.requester.headers, {
        ...v,
        idempotencyKey: randomUUID(),
      }),
      createPolicyReservation(f.context, f.requester.headers, {
        ...v,
        idempotencyKey: randomUUID(),
      }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(r.filter((x) => x.status === "rejected")).toHaveLength(1);
  });
  it("confirmation requires named prerequisite exact task plus current MFA", async () => {
    const r = await request();
    await expect(change(r.receipt, "confirm", outsider)).rejects.toMatchObject({
      status: 404,
    });
    await grantWorkflowTask(w, r.receipt.logicalBookingId, reviewer);
    await expect(
      changePolicyBooking(
        f.context,
        reviewer.headers,
        r.receipt.id,
        "confirm",
        {
          expectedRevision: 0,
          requestId: randomUUID(),
          reasonCode: "synthetic_completed",
        },
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect((await change(r.receipt, "confirm")).state).toBe("confirmed");
  });
  it("confirmed ignores old provisional deadline in detail/dashboard/private link/busy predicates", async () => {
    const times = await readWorkflowCandidates(
        f.context,
        f.requester.headers,
        f.choice,
      ),
      slot = times[6];
    const receipt = await historicalWorkflowBooking(w, f, reviewer, {
      state: "confirmed",
      start: new Date(slot.startAtUtc),
      end: new Date(slot.endAtUtc),
      created: new Date(Date.now() - 1800000),
      expires: new Date(Date.now() - 1200000),
    });
    const r = { receipt, value: { startAtUtc: slot.startAtUtc } };
    expect(
      (
        await readParticipantBooking(
          w.runtime,
          f.requester.headers,
          r.receipt.id,
          "guardian",
        )
      ).state,
    ).toBe("confirmed");
    expect(
      (
        await listParticipantBookingOverview(w.runtime, f.requester.headers, {
          scope: "guardian",
        })
      ).active.items.some((b) => b.id === r.receipt.id),
    ).toBe(true);
    const slots = await readWorkflowCandidates(
      f.context,
      f.requester.headers,
      f.choice,
    );
    expect(slots.some((t) => t.startAtUtc === r.value.startAtUtc)).toBe(false);
    await savePrivateMeetingLink(w.runtime, f.tutor.headers, r.receipt.id, {
      requestId: randomUUID(),
      expectedRevision: 0,
      url: "https://meet.google.com/abc-defg-hij",
    });
    expect(
      (
        await readPrivateMeetingLink(
          w.runtime,
          f.requester.headers,
          r.receipt.id,
        )
      ).state,
    ).toBe("present");
  });
  it("provisional expiration cannot revive or renew on replay", async () => {
    const times = await readWorkflowCandidates(
        f.context,
        f.requester.headers,
        f.choice,
      ),
      slot = times[6];
    const receipt = await historicalWorkflowBooking(w, f, reviewer, {
      state: "provisional",
      start: new Date(slot.startAtUtc),
      end: new Date(slot.endAtUtc),
      created: new Date(Date.now() - 1800000),
      expires: new Date(Date.now() - 1200000),
    });
    const r = {
      receipt,
      value: {
        ...f.choice,
        startAtUtc: slot.startAtUtc,
        endAtUtc: slot.endAtUtc,
        idempotencyKey: randomUUID(),
      },
    };
    await grantWorkflowTask(w, r.receipt.logicalBookingId, reviewer);
    await expect(change(r.receipt, "confirm")).rejects.toMatchObject({
      status: 409,
    });
    await w.runtime.pool.query("SELECT public.expire_policy_bookings($1)", [
      f.profile.id,
    ]);
    const after = await readParticipantBooking(
      w.runtime,
      f.requester.headers,
      r.receipt.id,
      "guardian",
    );
    expect(after.state).toBe("expired");
    expect(after.id).toBe(r.receipt.id);
    const saved = (
      await w.owner.pool.query("SELECT expires_at FROM bookings WHERE id=$1", [
        r.receipt.id,
      ])
    ).rows[0];
    expect(new Date(saved.expires_at).getTime()).toBeLessThan(Date.now());
  });
  it("reports a live provisional link as awaiting confirmation while keeping it private", async () => {
    const r = await request();
    expect(
      await readPrivateMeetingLink(
        w.runtime,
        f.requester.headers,
        r.receipt.id,
      ),
    ).toEqual({ state: "awaiting_confirmation" });
    await expect(
      savePrivateMeetingLink(w.runtime, f.tutor.headers, r.receipt.id, {
        requestId: randomUUID(),
        expectedRevision: 0,
        url: "https://meet.google.com/abc-defg-hij",
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      readPrivateMeetingLink(w.runtime, outsider.headers, r.receipt.id),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("failed move preserves original/head/events/link and successful replacement retires link", async () => {
    const r = await confirmed();
    await w.owner.pool.query('UPDATE "user" SET timezone=$2 WHERE id=$1', [
      f.requester.id,
      "Pacific/Auckland",
    ]);
    await savePrivateMeetingLink(w.runtime, f.tutor.headers, r.receipt.id, {
      requestId: randomUUID(),
      expectedRevision: 0,
      url: "https://meet.google.com/abc-defg-hij",
    });
    const before = (
      await w.owner.pool.query(
        "SELECT count(*)::int n FROM booking_lifecycle_events WHERE logical_booking_id=$1",
        [r.receipt.logicalBookingId],
      )
    ).rows[0].n;
    await expect(
      changePolicyBooking(
        f.context,
        f.requester.headers,
        r.receipt.id,
        "reschedule",
        {
          requestId: randomUUID(),
          expectedRevision: 1,
          reasonCode: "synthetic_participant_change",
          startAtUtc: r.value.startAtUtc,
          endAtUtc: r.value.endAtUtc,
          displayTimezone: "UTC",
        },
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await readParticipantBooking(
          w.runtime,
          f.requester.headers,
          r.receipt.id,
          "guardian",
        )
      ).state,
    ).toBe("confirmed");
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM booking_lifecycle_events WHERE logical_booking_id=$1",
          [r.receipt.logicalBookingId],
        )
      ).rows[0].n,
    ).toBe(before);
    const slots = await readWorkflowMoveCandidates(
        f.context,
        f.requester.headers,
        r.receipt.id,
      ),
      t = slots[14],
      wrongTimezone = {
        requestId: randomUUID(),
        expectedRevision: 1,
        reasonCode: "synthetic_participant_change",
        startAtUtc: t.startAtUtc,
        endAtUtc: t.endAtUtc,
        displayTimezone: "UTC",
      };
    expect(t).toEqual(
      formatLessonTime(
        new Date(t.startAtUtc),
        new Date(t.endAtUtc),
        "Pacific/Auckland",
      ),
    );
    await expect(
      changePolicyBooking(
        f.context,
        f.requester.headers,
        r.receipt.id,
        "reschedule",
        wrongTimezone,
      ),
    ).rejects.toMatchObject({ status: 409 });
    // An outsider's stale zone or unavailable time must not reveal the booking.
    await expect(
      changePolicyBooking(
        f.context,
        outsider.headers,
        r.receipt.id,
        "reschedule",
        {
          ...wrongTimezone,
          requestId: randomUUID(),
          startAtUtc: new Date(
            Date.parse(t.startAtUtc) + 420_000,
          ).toISOString(),
          endAtUtc: new Date(Date.parse(t.endAtUtc) + 420_000).toISOString(),
        },
      ),
    ).rejects.toMatchObject({ status: 404 });
    const v = {
      ...wrongTimezone,
      requestId: randomUUID(),
      displayTimezone: "Pacific/Auckland",
    };
    const move = await changePolicyBooking(
      f.context,
      f.requester.headers,
      r.receipt.id,
      "reschedule",
      v,
    );
    expect(move.state).toBe("confirmed");
    expect(move.logicalBookingId).toBe(r.receipt.logicalBookingId);
    expect(
      (
        await w.owner.pool.query(
          "SELECT display_timezone FROM bookings WHERE id=$1",
          [move.id],
        )
      ).rows[0].display_timezone,
    ).toBe("Pacific/Auckland");
    expect(
      (
        await changePolicyBooking(
          f.context,
          f.requester.headers,
          r.receipt.id,
          "reschedule",
          v,
        )
      ).eventId,
    ).toBe(move.eventId);
    expect(
      (
        await readPrivateMeetingLink(
          w.runtime,
          f.requester.headers,
          r.receipt.id,
        )
      ).state,
    ).toBe("expired");
    expect(
      (await readPrivateMeetingLink(w.runtime, f.requester.headers, move.id))
        .state,
    ).toBe("missing");
    expect(
      (
        await readParticipantBooking(
          w.runtime,
          f.requester.headers,
          r.receipt.id,
          "guardian",
        )
      ).events.map((event) => event.event),
    ).toEqual([
      "workflow_provisional",
      "workflow_confirmed",
      "workflow_rescheduled",
      "workflow_confirmed",
    ]);
  });
  it("cancellation needs current family authority but not future subject eligibility", async () => {
    const r = await confirmed();
    await w.owner.pool.query(
      "UPDATE subjects SET is_active=false WHERE slug='math'",
    );
    try {
      expect((await change(r.receipt, "cancel", f.requester)).state).toBe(
        "cancelled",
      );
    } finally {
      await w.owner.pool.query(
        "UPDATE subjects SET is_active=true WHERE slug='math'",
      );
    }
    expect(
      (
        await readParticipantBooking(
          w.runtime,
          f.requester.headers,
          r.receipt.id,
          "guardian",
        )
      ).events.some((e) => e.event === "workflow_cancelled"),
    ).toBe(true);
  });
  it("outcome before end or unrelated actor is denied", async () => {
    const r = await confirmed();
    await expect(change(r.receipt, "complete")).rejects.toMatchObject({
      status: 409,
    });
    await expect(change(r.receipt, "no_show", outsider)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("current recipient projection is safe and guardian logout does not revoke beneficiary", async () => {
    const r = await confirmed();
    const recipients = await readCurrentBookingNoticeRecipients(
      w.runtime.db,
      r.receipt.eventId,
    );
    expect(recipients).toHaveLength(2);
    expect(JSON.stringify(recipients)).not.toMatch(
      /learner|meet\.google|screening:/,
    );
    await w.owner.pool.query("DELETE FROM session WHERE user_id=$1", [
      f.requester.id,
    ]);
    expect(
      await readCurrentBookingNoticeRecipients(w.runtime.db, r.receipt.eventId),
    ).toHaveLength(2);
    await expect(
      change(r.receipt, "cancel", f.requester),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("revoked learner admission denies current projections and mutations", async () => {
    const r = await confirmed();
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
    await expect(
      readParticipantBooking(
        w.runtime,
        f.requester.headers,
        r.receipt.id,
        "guardian",
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      await readCurrentBookingNoticeRecipients(w.runtime.db, r.receipt.eventId),
    ).toEqual([]);
    await expect(change(r.receipt, "complete")).rejects.toMatchObject({
      status: 404,
    });
  });
  it("ordinary runtime cannot directly promote readiness state/history or write policy/grants", async () => {
    const r = await request();
    await expect(
      w.runtime.pool.query(
        "UPDATE bookings SET state='confirmed' WHERE id=$1",
        [r.receipt.id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      w.runtime.pool.query(
        "UPDATE booking_workflow_policy_head SET enabled=false",
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      w.runtime.pool.query("UPDATE booking_workflow_grants SET active=true"),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("completion provider refuses uncompleted booking confirmation event", async () => {
    const r = await confirmed();
    const predicate = currentCompletionEligibilityPredicate({
      userId: f.requester.id,
      sessionId: (await w.runtime.auth.api.getSession({
        headers: f.requester.headers,
      }))!.session.id,
      bookingId: r.receipt.id,
      eventId: r.receipt.eventId,
    });
    const q = await w.runtime.db.execute<{ eligible: boolean }>(
      sql`SELECT ${predicate} AS eligible`,
    );
    expect(q.rows[0].eligible).toBe(false);
  });
});

describe("readiness late-write waits and administrative outcomes", () => {
  it("late notice recipient FK wait followed by screening account revocation rolls back creation/events/intents", async () => {
    const slots = await readWorkflowCandidates(
        f.context,
        f.requester.headers,
        f.choice,
      ),
      t = slots[8],
      v = {
        ...f.choice,
        startAtUtc: t.startAtUtc,
        endAtUtc: t.endAtUtc,
        idempotencyKey: randomUUID(),
      },
      blocker = await w.owner.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
        f.tutor.id,
      ]);
      pending = createPolicyReservation(f.context, f.requester.headers, v);
      const settled = pending.then(
        () => ({ ok: true }),
        (e) => ({ error: e }),
      );
      await observedLock(w, "create_policy_booking");
      await blocker.query(
        "UPDATE user_access SET status='suspended' WHERE user_id=$1",
        [f.tutor.id],
      );
      await blocker.query("COMMIT");
      expect(await settled).toMatchObject({ error: { status: 404 } });
      expect(
        (
          await w.owner.pool.query(
            "SELECT count(*)::int n FROM bookings WHERE idempotency_key=$1",
            [v.idempotencyKey],
          )
        ).rows[0].n,
      ).toBe(0);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      if (pending) await pending.catch(() => undefined);
    }
  });
  it("late confirmation event actor FK wait followed by admin role revocation preserves provisional and history", async () => {
    const r = await request();
    await grantWorkflowTask(w, r.receipt.logicalBookingId, reviewer);
    const before = (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM booking_lifecycle_events WHERE logical_booking_id=$1",
          [r.receipt.logicalBookingId],
        )
      ).rows[0].n,
      blocker = await w.owner.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
        reviewer.id,
      ]);
      pending = change(r.receipt, "confirm");
      const settled = pending.then(
        () => ({ ok: true }),
        (e) => ({ error: e }),
      );
      await observedLock(w, "change_policy_booking");
      await blocker.query(
        "DELETE FROM user_roles WHERE user_id=$1 AND role='admin'",
        [reviewer.id],
      );
      await blocker.query("COMMIT");
      expect(await settled).toMatchObject({ error: { status: 404 } });
      expect(
        (
          await readParticipantBooking(
            w.runtime,
            f.requester.headers,
            r.receipt.id,
            "guardian",
          )
        ).state,
      ).toBe("provisional");
      expect(
        (
          await w.owner.pool.query(
            "SELECT count(*)::int n FROM booking_lifecycle_events WHERE logical_booking_id=$1",
            [r.receipt.logicalBookingId],
          )
        ).rows[0].n,
      ).toBe(before);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      if (pending) await pending.catch(() => undefined);
      await w.owner.pool.query(
        "INSERT INTO user_roles(user_id,role) VALUES($1,'admin') ON CONFLICT DO NOTHING",
        [reviewer.id],
      );
    }
  });
  it("late confirmation expiry uses DB clock after event FK wait and rolls back all confirmation writes", async () => {
    const slots = await readWorkflowCandidates(
        f.context,
        f.requester.headers,
        f.choice,
      ),
      t = slots[8],
      expires = new Date(Date.now() + 800),
      r = await historicalWorkflowBooking(w, f, reviewer, {
        state: "provisional",
        start: new Date(t.startAtUtc),
        end: new Date(t.endAtUtc),
        created: new Date(Date.now() - 60000),
        expires,
      });
    await grantWorkflowTask(w, r.logicalBookingId, reviewer);
    const blocker = await w.owner.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
        reviewer.id,
      ]);
      pending = change(r, "confirm");
      const settled = pending.then(
        () => ({ ok: true }),
        (e) => ({ error: e }),
      );
      await observedLock(w, "change_policy_booking");
      while (
        (
          await w.owner.pool.query(
            "SELECT clock_timestamp()>$1::timestamptz AS elapsed",
            [expires],
          )
        ).rows[0].elapsed !== true
      )
        await new Promise((r) => setTimeout(r, 20));
      await blocker.query("COMMIT");
      expect(await settled).toMatchObject({ error: { status: 409 } });
      expect(
        (
          await w.owner.pool.query(
            "SELECT state,workflow_revision FROM bookings WHERE id=$1",
            [r.id],
          )
        ).rows[0],
      ).toEqual({ state: "provisional", workflow_revision: 0 });
      expect(
        (
          await w.owner.pool.query(
            "SELECT count(*)::int n FROM booking_lifecycle_events WHERE booking_id=$1 AND event='workflow_confirmed'",
            [r.id],
          )
        ).rows[0].n,
      ).toBe(0);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      if (pending) await pending.catch(() => undefined);
    }
  });
  it.each(["complete", "no_show"] as const)(
    "exact assigned %s is administrative after end and completion eligibility is event/head specific",
    async (action) => {
      const now = Date.now(),
        r = await historicalWorkflowBooking(w, f, reviewer, {
          state: "confirmed",
          start: new Date(now - 7200000),
          end: new Date(now - 3600000),
          created: new Date(now - 14400000),
          expires: new Date(now - 13800000),
        });
      await grantWorkflowTask(w, r.logicalBookingId, reviewer);
      const result = await change(r, action);
      expect(result.state).toBe(
        action === "complete" ? "completed" : "no_show",
      );
      const current = await w.runtime.auth.api.getSession({
        headers: f.requester.headers,
      });
      if (!current) throw new Error();
      const q = await w.runtime.db.execute<{ eligible: boolean }>(
        sql`SELECT ${currentCompletionEligibilityPredicate({ userId: f.requester.id, sessionId: current.session.id, bookingId: r.id, eventId: result.eventId })} AS eligible`,
      );
      expect(q.rows[0].eligible).toBe(action === "complete");
      expect(
        (
          await readParticipantBooking(
            w.runtime,
            f.requester.headers,
            r.id,
            "guardian",
          )
        ).events.map((e) => e.event),
      ).toContain(
        action === "complete" ? "workflow_completed" : "workflow_no_show",
      );
    },
  );
  it("changing current policy head cannot mutate original policy or rewrite its saved terms", async () => {
    const r = await request();
    await grantWorkflowTask(w, r.receipt.logicalBookingId, reviewer);
    const { provisionBookingPolicy } =
      await import("../support/booking-workflows-fixtures");
    const next = await provisionBookingPolicy(w, f.admission.policyId);
    await expect(
      changePolicyBooking(
        { runtime: w.runtime, booking: next },
        reviewer.headers,
        r.receipt.id,
        "confirm",
        {
          requestId: randomUUID(),
          expectedRevision: 0,
          reasonCode: "synthetic_prerequisite_review",
        },
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(
      (
        await w.owner.pool.query(
          "SELECT state,workflow_policy_id FROM bookings WHERE id=$1",
          [r.receipt.id],
        )
      ).rows[0],
    ).toEqual({ state: "provisional", workflow_policy_id: f.booking.policyId });
  });
});

describe("readiness existing safeguarding dispute bridge", () => {
  async function response() {
    const escalation = await createAccount(
      w,
      ["admin"],
      "Fictional W6 escalation owner",
    );
    const { responseFixture } = await import("./screening-fixtures");
    return responseFixture(w, reviewer, escalation);
  }
  const input = () => ({
    requestKey: randomUUID(),
    category: "account",
    subject: "Fictional booking outcome dispute",
    body: "Fictional administrative outcome disagreement. No attendance evidence.",
  });
  it("creates case/response/events and immutable exact booking association atomically and retries once", async () => {
    const r = await confirmed(),
      scope = await response(),
      v = input(),
      { createBookingDispute } =
        await import("@/features/booking-workflows/service"),
      { queryCaseBooking } = await import("@/features/support-bookings/query"),
      { requireIdentity } = await import("@/lib/permissions/access");
    const a = await createBookingDispute(
        f.context,
        f.requester.headers,
        r.receipt.id,
        v,
        scope.context,
      ),
      b = await createBookingDispute(
        f.context,
        f.requester.headers,
        r.receipt.id,
        v,
        scope.context,
      );
    expect(a.id).toBe(b.id);
    expect(
      (
        await w.owner.pool.query(
          "SELECT b.booking_id,c.source FROM support_case_bookings b JOIN support_cases c ON c.id=b.case_id WHERE b.case_id=$1",
          [a.id],
        )
      ).rows[0],
    ).toEqual({ booking_id: r.receipt.id, source: "synthetic_readiness" });
    const context = await queryCaseBooking(
      w.runtime.db,
      await requireIdentity(w.runtime, f.requester.headers),
      a.id,
      "requester",
    );
    expect(context).toMatchObject({ available: true, state: "confirmed" });
    expect(JSON.stringify(context)).not.toMatch(/learner|meet\.google/);
    await expect(
      queryCaseBooking(
        w.runtime.db,
        await requireIdentity(w.runtime, outsider.headers),
        a.id,
        "reviewer",
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      createBookingDispute(
        f.context,
        outsider.headers,
        r.receipt.id,
        input(),
        scope.context,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("same request key with changed booking or payload cannot retarget the original dispute", async () => {
    const first = await request(),
      second = await request(12),
      scope = await response(),
      v = input(),
      { createBookingDispute } =
        await import("@/features/booking-workflows/service");
    const saved = await createBookingDispute(
      f.context,
      f.requester.headers,
      first.receipt.id,
      v,
      scope.context,
    );
    await expect(
      createBookingDispute(
        f.context,
        f.requester.headers,
        second.receipt.id,
        v,
        scope.context,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      createBookingDispute(
        f.context,
        f.requester.headers,
        first.receipt.id,
        { ...v, body: "Changed fictional payload" },
        scope.context,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await w.owner.pool.query(
          "SELECT booking_id FROM support_case_bookings WHERE case_id=$1",
          [saved.id],
        )
      ).rows[0].booking_id,
    ).toBe(first.receipt.id);
  });
  it("expired session denies dispute and default disabled policies collect no request", async () => {
    const r = await request(),
      scope = await response(),
      { createBookingDispute } =
        await import("@/features/booking-workflows/service");
    await expect(
      createBookingDispute(
        { ...f.context, booking: { authority: "disabled" } },
        f.requester.headers,
        r.receipt.id,
        input(),
        scope.context,
      ),
    ).rejects.toMatchObject({ status: 503 });
    await w.owner.pool.query("DELETE FROM session WHERE user_id=$1", [
      f.requester.id,
    ]);
    await expect(
      createBookingDispute(
        f.context,
        f.requester.headers,
        r.receipt.id,
        input(),
        scope.context,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe("readiness atomic dispute transaction markers", () => {
  it("committed old readiness case cannot gain a new association and forged marker input is overwritten", async () => {
    const r = await request(),
      escalation = await createAccount(w, ["admin"]),
      { responseFixture } = await import("./screening-fixtures"),
      scope = await responseFixture(w, reviewer, escalation),
      { createSafeguardingCase } =
        await import("@/features/safeguarding/service");
    const a = await createSafeguardingCase(scope.context, f.requester.headers, {
      requestKey: randomUUID(),
      category: "account",
      subject: "Fictional standalone case",
      body: "Fictional case without a booking association",
    });
    await expect(
      w.owner.pool.query(
        "INSERT INTO support_case_bookings(case_id,booking_id) VALUES($1,$2)",
        [a.id, r.receipt.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      w.runtime.pool.query(
        "UPDATE support_cases SET creation_transaction='forged' WHERE id=$1",
        [a.id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      w.owner.pool.query(
        "UPDATE support_cases SET creation_transaction='forged' WHERE id=$1",
        [a.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      w.runtime.pool.query(
        "INSERT INTO support_cases(requester_user_id,request_key,source,category,subject,body,creation_transaction) VALUES($1,$2,'synthetic_readiness','account','Fictional forged fixture','Fictional body','forged')",
        [f.requester.id, randomUUID()],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    const client = await w.owner.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        "INSERT INTO support_cases(requester_user_id,request_key,source,category,subject,body,creation_transaction) VALUES($1,$2,'synthetic_readiness','account','Fictional forged fixture','Fictional body','forged') RETURNING creation_transaction=pg_current_xact_id()::text AS stamped",
        [f.requester.id, randomUUID()],
      );
      expect(inserted.rows[0].stamped).toBe(true);
      await expect(
        client.query(
          "INSERT INTO support_case_bookings(case_id,booking_id) VALUES($1,$2)",
          [a.id, r.receipt.id],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
  it("late case-creation FK wait then expired requester session leaves no case/response/association", async () => {
    const r = await request(),
      escalation = await createAccount(w, ["admin"]),
      { responseFixture } = await import("./screening-fixtures"),
      scope = await responseFixture(w, reviewer, escalation),
      { createBookingDispute } =
        await import("@/features/booking-workflows/service"),
      key = randomUUID(),
      blocker = await w.owner.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
        f.requester.id,
      ]);
      pending = createBookingDispute(
        f.context,
        f.requester.headers,
        r.receipt.id,
        {
          requestKey: key,
          category: "account",
          subject: "Fictional late dispute",
          body: "Fictional revoked requester",
        },
        scope.context,
      );
      const settled = pending.then(
        () => ({ ok: true }),
        (e) => ({ error: e }),
      );
      await observedLock(w, "create_booking_workflow_dispute");
      await blocker.query(
        "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
        [f.requester.id],
      );
      await blocker.query("COMMIT");
      expect(await settled).toMatchObject({ error: { status: 404 } });
      expect(
        (
          await w.owner.pool.query(
            "SELECT count(*)::int n FROM support_cases WHERE requester_user_id=$1 AND request_key=$2",
            [f.requester.id, key],
          )
        ).rows[0].n,
      ).toBe(0);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      if (pending) await pending.catch(() => undefined);
    }
  });
});
