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
import {
  workflowFixture,
  grantWorkflowTask,
} from "../support/booking-workflows-fixtures";
import { refreshTestAdmin } from "../support/admin-mfa";
import {
  createPolicyReservation,
  readWorkflowCandidates,
  changePolicyBooking,
  readWorkflowMoveCandidates,
} from "@/features/booking-workflows/service";
import { readParticipantBooking } from "@/features/bookings/read-service";
import { saveOwnTimeOff } from "@/features/time-off/service";
import { saveOwnAvailability } from "@/features/availability/service";
import { readCurrentBookingNoticeRecipients } from "@/features/booking-workflows/provider";
let w: World,
  reviewer: TestAccount,
  f: Awaited<ReturnType<typeof workflowFixture>>;
beforeAll(async () => {
  w = openWorld();
  reviewer = await createAccount(w, ["admin"]);
});
beforeEach(async () => {
  await refreshTestAdmin(w.runtime, reviewer, password);
  f = await workflowFixture(w, reviewer);
});
afterAll(async () => {
  await w.owner.pool.query(
    "UPDATE booking_workflow_policy_head SET enabled=false",
  );
  await w.owner.pool.query(
    "UPDATE tutor_screening_policy_heads SET status='revoked'",
  );
  await closeWorld(w);
});
async function request(index = 8) {
  const slot = (
    await readWorkflowCandidates(f.context, f.requester.headers, f.choice)
  )[index];
  return {
    value: {
      ...f.choice,
      startAtUtc: slot.startAtUtc,
      endAtUtc: slot.endAtUtc,
      idempotencyKey: randomUUID(),
    },
    slot,
  };
}
async function confirm(id: { id: string; logicalBookingId: string }) {
  await grantWorkflowTask(w, id.logicalBookingId, reviewer);
  return changePolicyBooking(f.context, reviewer.headers, id.id, "confirm", {
    requestId: randomUUID(),
    expectedRevision: 0,
    reasonCode: "synthetic_prerequisite_review",
  });
}
const wall = (instant: string) => {
  const d = new Date(instant);
  return new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 16);
};
describe("additional policy booking acceptance with current frozen provider", () => {
  it("independent College requester books own admitted profile without a guardian", async () => {
    f = await workflowFixture(w, reviewer, "self");
    const r = await request(),
      saved = await createPolicyReservation(
        f.context,
        f.requester.headers,
        r.value,
      );
    expect(
      (
        await readParticipantBooking(
          w.runtime,
          f.requester.headers,
          saved.id,
          "student",
        )
      ).learner.level,
    ).toBe("college_support");
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM guardian_learner_links WHERE learner_id=$1",
          [f.learner.id],
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it("provisional vs time off simultaneous race never leaves both overlapping", async () => {
    const r = await request(),
      results = await Promise.allSettled([
        createPolicyReservation(f.context, f.requester.headers, r.value),
        saveOwnTimeOff(w.runtime, f.tutor.headers, {
          operation: "add",
          version: 1,
          timezone: "Asia/Manila",
          startLocal: wall(r.slot.startAtUtc),
          endLocal: wall(r.slot.endAtUtc),
        }),
      ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("confirmed remains protected from time off even past its hold and cancellation releases the interval", async () => {
    const r = await request(),
      b = await createPolicyReservation(
        f.context,
        f.requester.headers,
        r.value,
      ),
      c = await confirm(b);
    await expect(
      saveOwnTimeOff(w.runtime, f.tutor.headers, {
        operation: "add",
        version: 1,
        timezone: "Asia/Manila",
        startLocal: wall(r.slot.startAtUtc),
        endLocal: wall(r.slot.endAtUtc),
      }),
    ).rejects.toMatchObject({ status: 409 });
    await changePolicyBooking(f.context, f.requester.headers, c.id, "cancel", {
      requestId: randomUUID(),
      expectedRevision: 1,
      reasonCode: "synthetic_participant_change",
    });
    expect(
      await saveOwnTimeOff(w.runtime, f.tutor.headers, {
        operation: "add",
        version: 1,
        timezone: "Asia/Manila",
        startLocal: wall(r.slot.startAtUtc),
        endLocal: wall(r.slot.endAtUtc),
      }),
    ).toBeDefined();
  });
  it("two simultaneous replacement requests create one head and failed move preserves original terms", async () => {
    const r = await request(),
      b = await createPolicyReservation(
        f.context,
        f.requester.headers,
        r.value,
      ),
      c = await confirm(b),
      slots = await readWorkflowMoveCandidates(
        f.context,
        f.requester.headers,
        c.id,
      ),
      a = slots[9],
      d = slots[15],
      v = (t: typeof a) => ({
        requestId: randomUUID(),
        expectedRevision: 1,
        reasonCode: "synthetic_participant_change",
        startAtUtc: t.startAtUtc,
        endAtUtc: t.endAtUtc,
        displayTimezone: "UTC",
      });
    const result = await Promise.allSettled([
      changePolicyBooking(
        f.context,
        f.requester.headers,
        c.id,
        "reschedule",
        v(a),
      ),
      changePolicyBooking(
        f.context,
        f.requester.headers,
        c.id,
        "reschedule",
        v(d),
      ),
    ]);
    expect(result.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(result.filter((x) => x.status === "rejected")).toHaveLength(1);
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM bookings WHERE logical_booking_id=$1 AND state='confirmed'",
          [c.logicalBookingId],
        )
      ).rows[0].n,
    ).toBe(1);
    const terms = (
      await w.owner.pool.query(
        "SELECT workflow_policy_id,admission_policy_id,expires_at FROM bookings WHERE logical_booking_id=$1 ORDER BY revision",
        [c.logicalBookingId],
      )
    ).rows;
    expect(terms[0]).toEqual(terms[1]);
  });
  it("stale account/tutor role and exact task grant revocation deny confirmation or recipients", async () => {
    const r = await request(),
      b = await createPolicyReservation(
        f.context,
        f.requester.headers,
        r.value,
      );
    await grantWorkflowTask(w, b.logicalBookingId, reviewer);
    await w.owner.pool.query(
      "UPDATE booking_workflow_grants SET active=false WHERE logical_booking_id=$1",
      [b.logicalBookingId],
    );
    await expect(
      changePolicyBooking(f.context, reviewer.headers, b.id, "confirm", {
        requestId: randomUUID(),
        expectedRevision: 0,
        reasonCode: "synthetic_prerequisite_review",
      }),
    ).rejects.toMatchObject({ status: 404 });
    await w.owner.pool.query(
      "DELETE FROM user_roles WHERE user_id=$1 AND role='parent'",
      [f.requester.id],
    );
    await expect(
      readParticipantBooking(w.runtime, f.requester.headers, b.id, "guardian"),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      await readCurrentBookingNoticeRecipients(w.runtime.db, b.eventId),
    ).toEqual([]);
  });
  it("overnight UTC/date conversion remains full interval with the actual DST engine", async () => {
    await saveOwnAvailability(w.runtime, f.tutor.headers, {
      version: 1,
      timezone: "America/New_York",
      windows: Array.from({ length: 7 }, (_, i) => ({
        isoWeekday: i + 1,
        startMinute: 1380,
        endMinute: 1500,
      })),
    });
    const slots = await readWorkflowCandidates(f.context, f.requester.headers, {
      ...f.choice,
      displayTimezone: "America/New_York",
    });
    expect(slots.length).toBeGreaterThan(0);
    for (const t of slots) {
      expect(Date.parse(t.endAtUtc) - Date.parse(t.startAtUtc)).toBe(3600000);
      expect(t.zone).toMatch(/(?:EDT|EST|Eastern)/);
    }
    const t = slots[2],
      saved = await createPolicyReservation(f.context, f.requester.headers, {
        ...f.choice,
        displayTimezone: "America/New_York",
        startAtUtc: t.startAtUtc,
        endAtUtc: t.endAtUtc,
        idempotencyKey: randomUUID(),
      });
    expect(
      (
        await readParticipantBooking(
          w.runtime,
          f.requester.headers,
          saved.id,
          "guardian",
        )
      ).time.startAtUtc,
    ).toBe(t.startAtUtc);
  });
});
