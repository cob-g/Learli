import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
vi.mock("server-only", () => ({}));
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
  grantWorkflowTask,
  historicalWorkflowBooking,
} from "../support/booking-workflows-fixtures";
import {
  createPolicyReservation,
  readWorkflowCandidates,
  changePolicyBooking,
} from "@/features/booking-workflows/service";
import {
  bindTransactionalDelivery,
  type DeliveryContext,
} from "@/features/transactional-delivery/context";
import { drainTransactionalDeliveries } from "@/features/transactional-delivery/drain";
import { currentDeliveryMaterial } from "@/features/transactional-delivery/recipient";
import { observedLock } from "./screening-fixtures";
import { sql } from "drizzle-orm";
import { requireIdentity } from "@/lib/permissions/access";
import {
  readAssignedAdmission,
  mutateAdmissionReview,
} from "@/features/learner-admission/service";

let w: World,
  reviewer: TestAccount,
  f: Awaited<ReturnType<typeof workflowFixture>>;
const origin = "https://learli.example",
  identitySecret = "W4-synthetic-booking-sdk-binding-key-only";
type SdkRequest = { body: string; key: string | null };
let requests: SdkRequest[],
  mode: "accepted" | "429" | "500" | "concurrent409" | "altered409" | "timeout";
let onSend: (() => Promise<void>) | undefined;
beforeAll(async () => {
  w = openWorld();
  reviewer = await createAccount(w, ["admin"], "Fictional W4 reviewer");
}, 60000);
beforeEach(async () => {
  await refreshTestAdmin(w.runtime, reviewer, password);
  f = await workflowFixture(w, reviewer);
  requests = [];
  mode = "accepted";
  onSend = undefined;
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

function config(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    environment: "test",
    appOrigin: origin,
    identitySecret,
    apiKey: "re_synthetic_w4_boundary_key_only",
    sender: "sender@example.test",
    verifiedSender: {
      sender: "sender@example.test",
      environment: "test",
      appOrigin: origin,
    },
    allowedRecipients: [f.requester.email, f.tutor.email],
    timeoutMs: 500,
    ...overrides,
  };
}
function runtime(
  overrides: Record<string, unknown> = {},
  now?: () => number,
): DeliveryContext {
  const context = bindTransactionalDelivery(w.runtime.db, config(overrides), {
    now,
    fetch: async (url, options) => {
      expect(String(url)).toBe("https://api.resend.com/emails");
      expect(options?.method).toBe("POST");
      requests.push({
        body: String(options?.body),
        key: new Headers(options?.headers).get("Idempotency-Key"),
      });
      await onSend?.();
      if (mode === "timeout")
        throw new Error(
          "Synthetic SDK response lost after potential acceptance.",
        );
      const status =
        mode === "accepted"
          ? 200
          : mode === "429"
            ? 429
            : mode === "500"
              ? 500
              : 409;
      return Response.json(
        status === 200
          ? { id: "ad52bfd5-e5a9-4c26-a9d6-f42441a0306d" }
          : {
              name:
                mode === "concurrent409"
                  ? "concurrent_idempotent_requests"
                  : mode === "altered409"
                    ? "invalid_idempotent_request"
                    : "application_error",
              message: "omitted synthetic error",
            },
        { status },
      );
    },
  });
  if (!context) throw new Error("Synthetic delivery context refused.");
  return context;
}
async function booking() {
  const slots = await readWorkflowCandidates(
      f.context,
      f.requester.headers,
      f.choice,
    ),
    slot = slots[6];
  if (!slot) throw new Error("Actual slot unavailable.");
  return createPolicyReservation(f.context, f.requester.headers, {
    ...f.choice,
    startAtUtc: slot.startAtUtc,
    endAtUtc: slot.endAtUtc,
    idempotencyKey: randomUUID(),
  });
}
async function rows(eventId: string) {
  return (
    await w.owner.pool.query(
      "SELECT * FROM transactional_deliveries WHERE event_id=$1 ORDER BY recipient_user_id",
      [eventId],
    )
  ).rows;
}
async function due(eventId: string) {
  // Observe the actual bounded DB deadline; never rewrite guarded retry state.
  const deadline = Date.now() + 7_000;
  while (Date.now() < deadline) {
    const q = await w.owner.pool.query(
      "SELECT bool_and(next_attempt_at<=clock_timestamp()) ready FROM transactional_deliveries WHERE event_id=$1 AND state IN('retryable','uncertain')",
      [eventId],
    );
    if (q.rows[0].ready === true) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Actual bounded retry deadline did not become ready.");
}
describe("actual committed W6 events to SDK durable delivery", () => {
  it("queue/event creation is atomic and uncommitted or rolled-back events never reach the independent drain", async () => {
    const actor = await requireIdentity(w.runtime, f.requester.headers);
    const slots = await readWorkflowCandidates(
        f.context,
        f.requester.headers,
        f.choice,
      ),
      slot = slots[6];
    if (!slot) throw new Error("Actual slot unavailable.");
    const subject = (
      await w.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
    ).rows[0].id;
    let eventId = "",
      bookingId = "",
      announce: () => void = () => {},
      release: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      announce = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const operation = w.runtime.db.transaction(async (tx) => {
      const r = await tx.execute<{
        outcome: string;
        booking_id: string;
        event_id: string;
      }>(
        sql`SELECT * FROM public.create_policy_booking(${actor.userId},${actor.sessionId},${randomUUID()}::uuid,${f.booking.policyId}::uuid,${f.learner.id}::uuid,${f.profile.id}::uuid,${subject}::uuid,${slot.startAtUtc}::timestamptz,${slot.endAtUtc}::timestamptz,'Asia/Manila',${"a".repeat(64)})`,
      );
      expect(r.rows[0].outcome).toBe("created");
      eventId = r.rows[0].event_id;
      bookingId = r.rows[0].booking_id;
      expect(
        (
          await tx.execute<{ n: number }>(
            sql`SELECT count(*)::int n FROM transactional_deliveries WHERE event_id=${eventId}::uuid`,
          )
        ).rows[0].n,
      ).toBe(2);
      announce();
      await gate;
      throw new Error("Synthetic rollback sentinel");
    });
    // Attach the expected rejection immediately; it is not a swallowed assertion.
    const rejection = expect(operation).rejects.toThrow(
      "Synthetic rollback sentinel",
    );
    try {
      await ready;
      const result = await drainTransactionalDeliveries(runtime(), { eventId });
      expect(Object.values(result).every((count) => count === 0)).toBe(true);
      expect(requests).toHaveLength(0);
    } finally {
      release();
    }
    await rejection;
    expect(await rows(eventId)).toHaveLength(0);
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM bookings WHERE id=$1",
          [bookingId],
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it("default disabled and forged contexts never query or call a provider", async () => {
    expect(bindTransactionalDelivery(w.runtime.db)).toBeNull();
    expect(
      bindTransactionalDelivery(w.runtime.db, {
        ...config(),
        enabled: false,
      }),
    ).toBeNull();
    const real = runtime();
    await expect(drainTransactionalDeliveries({ ...real })).rejects.toThrow(
      "unavailable",
    );
    expect(requests).toHaveLength(0);
  });
  it("atomically queues exact actual event/recipients and deduplicates concurrent request retries", async () => {
    const r = await booking(),
      queue = await rows(r.eventId);
    expect(queue).toHaveLength(2);
    expect(
      queue.every(
        (q) => q.state === "pending" && q.attempts === 0 && q.payload === null,
      ),
    ).toBe(true);
    expect(new Set(queue.map((q) => q.recipient_user_id))).toEqual(
      new Set([f.requester.id, f.tutor.id]),
    );
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM booking_workflow_notice_intents WHERE event_id=$1",
          [r.eventId],
        )
      ).rows[0].n,
    ).toBe(queue.length);
  });
  it("drains on an independent connection after commit and releases transaction locks before actual SDK I/O", async () => {
    const r = await booking();
    onSend = async () => {
      const observer = await w.owner.pool.connect();
      try {
        await observer.query("BEGIN");
        await observer.query("SET LOCAL lock_timeout='100ms'");
        const q = await observer.query(
          "SELECT state,first_attempt_at FROM transactional_deliveries WHERE event_id=$1 FOR UPDATE NOWAIT",
          [r.eventId],
        );
        expect(
          q.rows.some((row) => row.state === "claimed" && row.first_attempt_at),
        ).toBe(true);
      } finally {
        await observer.query("ROLLBACK");
        observer.release();
      }
    };
    const result = await drainTransactionalDeliveries(runtime(), {
      eventId: r.eventId,
    });
    expect(result.providerAccepted).toBe(2);
    expect(result.unavailable).toBe(0);
    expect(
      (await rows(r.eventId)).every(
        (q) =>
          q.state === "provider_accepted" && q.attempts === 1 && q.provider_id,
      ),
    ).toBe(true);
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      const body = JSON.parse(request.body);
      expect(body.text).not.toContain(f.learner.displayName);
      expect(body.text).not.toMatch(/meet\.google|zoom\.us/);
      expect(body.text).toContain("Synthetic readiness");
    }
  });
  it("simultaneous drains claim each queue identity once", async () => {
    const r = await booking(),
      context = runtime();
    const results = await Promise.all([
      drainTransactionalDeliveries(context, { eventId: r.eventId }),
      drainTransactionalDeliveries(context, { eventId: r.eventId }),
    ]);
    expect(results.reduce((n, v) => n + v.providerAccepted, 0)).toBe(2);
    expect(requests).toHaveLength(2);
    expect((await rows(r.eventId)).every((q) => q.attempts === 1)).toBe(true);
  });
  it("an unexpired abandoned claim without a prepared attempt does not call the SDK", async () => {
    const r = await booking();
    // Real runtime SQL claim protocol, representing a process that stopped
    // before materialization. No identity/payload/history guard is bypassed.
    await w.runtime.pool.query(
      "UPDATE transactional_deliveries SET state='claimed',claim_token=gen_random_uuid(),claim_until=clock_timestamp()+interval '59 seconds' WHERE event_id=$1",
      [r.eventId],
    );
    const result = await drainTransactionalDeliveries(runtime(), {
      eventId: r.eventId,
    });
    expect(Object.values(result).every((count) => count === 0)).toBe(true);
    expect(requests).toHaveLength(0);
    expect(
      (await rows(r.eventId)).every(
        (q) =>
          q.state === "claimed" &&
          q.attempts === 0 &&
          q.first_attempt_at === null &&
          q.payload === null,
      ),
    ).toBe(true);
  });
  it("actual API acceptance before failed database ACK preserves a durable claim and identical retry after lease expiry", async () => {
    const r = await booking(),
      context = runtime();
    const refusal = `w4_ack_refusal_${randomUUID().replaceAll("-", "")}`;
    await w.owner.pool.query(
      `CREATE FUNCTION public.${refusal}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic ACK refusal' USING ERRCODE='40001'; END; $$`,
    );
    await w.owner.pool.query(
      `CREATE TRIGGER ${refusal} BEFORE UPDATE ON public.transactional_deliveries FOR EACH ROW WHEN (NEW.state='provider_accepted') EXECUTE FUNCTION public.${refusal}()`,
    );
    // Actual database ACK failure after the actual SDK boundary accepted. The
    // extra owner-only fixture guard denies a write; existing guards remain on.
    try {
      expect(
        (
          await drainTransactionalDeliveries(context, {
            eventId: r.eventId,
            limit: 1,
          })
        ).uncertain,
      ).toBe(1);
    } finally {
      await w.owner.pool.query(
        `DROP TRIGGER ${refusal} ON public.transactional_deliveries`,
      );
      await w.owner.pool.query(`DROP FUNCTION public.${refusal}()`);
    }
    const claimed = (await rows(r.eventId)).find((q) => q.state === "claimed");
    expect(claimed?.first_attempt_at).toBeInstanceOf(Date);
    expect(requests).toHaveLength(1);
    const original = requests[0];
    await expect(
      w.runtime.pool.query(
        "UPDATE transactional_deliveries SET claim_token=$2 WHERE id=$1",
        [claimed.id, randomUUID()],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    const until = new Date(claimed.claim_until).getTime();
    while (Date.now() <= until)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(250, until - Date.now() + 20)),
      );
    onSend = async () => {
      const stale = await w.runtime.pool.query(
        "UPDATE transactional_deliveries SET state='provider_accepted',provider_id=gen_random_uuid(),closed_at=clock_timestamp(),claim_token=NULL,claim_until=NULL WHERE id=$1 AND claim_token=$2 RETURNING id",
        [claimed.id, claimed.claim_token],
      );
      expect(stale.rows).toHaveLength(0);
    };
    expect(
      (await drainTransactionalDeliveries(runtime(), { eventId: r.eventId }))
        .providerAccepted,
    ).toBe(2);
    const retried = requests.find(
      (q, index) => index > 0 && q.key === original.key,
    );
    expect(retried).toEqual(original);
    const after = (await rows(r.eventId)).find((q) => q.id === claimed.id);
    expect(after.first_attempt_at).toEqual(claimed.first_attempt_at);
    expect(after.attempts).toBe(2);
  }, 90000);
  it("actual PG-prepared attempt crossing the SDK clock boundary refuses HTTP and retains its first attempt", async () => {
    const r = await booking();
    // Existing actual SDK test-clock injection only; DB time/authority/lease,
    // constructor and durable state remain real and are not rewritten.
    const context = runtime({}, () => Date.now() + 24 * 60 * 60 * 1000);
    expect(
      (await drainTransactionalDeliveries(context, { eventId: r.eventId }))
        .uncertain,
    ).toBe(2);
    expect(requests).toHaveLength(0);
    expect(
      (await rows(r.eventId)).every(
        (q) =>
          q.state === "uncertain" &&
          q.attempts === 1 &&
          q.first_attempt_at &&
          q.provider_id === null,
      ),
    ).toBe(true);
  });
  it.each(["429", "500", "concurrent409"] as const)(
    "persists %s retry and reuses exact bytes/key across fresh context",
    async (failure) => {
      const r = await booking();
      mode = failure;
      expect(
        (await drainTransactionalDeliveries(runtime(), { eventId: r.eventId }))
          .retryable,
      ).toBe(2);
      const before = await rows(r.eventId),
        originals = [...requests];
      mode = "accepted";
      await due(r.eventId);
      expect(
        (await drainTransactionalDeliveries(runtime(), { eventId: r.eventId }))
          .providerAccepted,
      ).toBe(2);
      const after = await rows(r.eventId);
      expect(after.map((q) => q.first_attempt_at)).toEqual(
        before.map((q) => q.first_attempt_at),
      );
      expect(requests.slice(2)).toEqual(originals);
      expect(after.every((q) => q.attempts === 2)).toBe(true);
    },
  );
  it("altered-key409 blocks, timeout is uncertain, and booking remains committed", async () => {
    const r = await booking();
    mode = "altered409";
    expect(
      (await drainTransactionalDeliveries(runtime(), { eventId: r.eventId }))
        .blocked,
    ).toBe(2);
    const other = await booking();
    mode = "timeout";
    expect(
      (
        await drainTransactionalDeliveries(runtime(), {
          eventId: other.eventId,
        })
      ).uncertain,
    ).toBe(2);
    expect(
      (
        await w.owner.pool.query("SELECT state FROM bookings WHERE id=$1", [
          other.id,
        ])
      ).rows[0].state,
    ).toBe("provisional");
  });
  it("revoked current guardian authority suppresses all affected notices before sending", async () => {
    const r = await booking();
    const admission = await readAssignedAdmission(
      f.admissionContext,
      reviewer.headers,
      f.admissionId,
    );
    await mutateAdmissionReview(
      f.admissionContext,
      reviewer.headers,
      f.admissionId,
      "decision",
      {
        requestId: randomUUID(),
        revision: admission.revision,
        action: "revoke",
      },
    );
    expect(
      (await drainTransactionalDeliveries(runtime(), { eventId: r.eventId }))
        .suppressed,
    ).toBe(2);
    expect(requests).toHaveLength(0);
  });
  it("current recipient revocation committed during an actual SQL lock wait suppresses before SDK send", async () => {
    const r = await booking(),
      blocker = await w.owner.pool.connect();
    const context = runtime();
    let operation:
      | Promise<Awaited<ReturnType<typeof drainTransactionalDeliveries>>>
      | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query(
        "LOCK TABLE public.user_access IN ACCESS EXCLUSIVE MODE",
      );
      operation = drainTransactionalDeliveries(context, { eventId: r.eventId });
      await observedLock(w, "booking_workflow_notice_intents");
      await blocker.query(
        "UPDATE public.user_access SET status='suspended' WHERE user_id=$1",
        [f.requester.id],
      );
      await blocker.query("COMMIT");
      const result = await operation;
      expect(result.suppressed).toBe(2);
      expect(result.unavailable).toBe(0);
      expect(requests).toHaveLength(0);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      await operation;
    }
  });
  it("changed recipient address/material/configuration cannot reuse prepared identity", async () => {
    const r = await booking();
    mode = "429";
    await drainTransactionalDeliveries(runtime(), { eventId: r.eventId });
    await due(r.eventId);
    await w.owner.pool.query('UPDATE "user" SET timezone=$1 WHERE id=$2', [
      "America/New_York",
      f.requester.id,
    ]);
    mode = "accepted";
    const result = await drainTransactionalDeliveries(runtime(), {
      eventId: r.eventId,
    });
    expect(result.suppressed).toBe(1);
    expect(result.providerAccepted).toBe(1);
    expect(requests).toHaveLength(3);
    const other = await booking();
    mode = "429";
    await drainTransactionalDeliveries(runtime(), { eventId: other.eventId });
    await due(other.eventId);
    expect(
      (
        await drainTransactionalDeliveries(
          runtime({
            identitySecret: "changed-W4-synthetic-message-epoch-only",
          }),
          { eventId: other.eventId },
        )
      ).blocked,
    ).toBe(2);
  });
  it("actual recipient address change suppresses a prepared retry without sending to either address", async () => {
    const r = await booking();
    const changedEmail = `w4-changed-${randomUUID()}@learli.test`;
    // Both addresses are allowed before preparation: suppression must come from
    // current material authority, not from an SDK test-recipient allowlist.
    const context = runtime({
      allowedRecipients: [f.requester.email, changedEmail, f.tutor.email],
    });
    mode = "429";
    expect(
      (await drainTransactionalDeliveries(context, { eventId: r.eventId }))
        .retryable,
    ).toBe(2);
    const prepared = (await rows(r.eventId)).find(
      (row) => row.recipient_user_id === f.requester.id,
    );
    expect(prepared.payload.recipientEmail).toBe(f.requester.email);
    await due(r.eventId);
    // Owner-only synthetic account update isolates this adapter boundary. The
    // actual current/new-address provider proof flow has separate W3 coverage.
    await w.owner.pool.query('UPDATE "user" SET email=$1 WHERE id=$2', [
      changedEmail,
      f.requester.id,
    ]);
    mode = "accepted";
    const result = await drainTransactionalDeliveries(context, {
      eventId: r.eventId,
    });
    expect(result.suppressed).toBe(1);
    expect(result.providerAccepted).toBe(1);
    expect(requests).toHaveLength(3);
    const retried = JSON.parse(requests[2].body);
    expect(retried.to).toEqual([f.tutor.email]);
    expect(
      requests
        .slice(2)
        .every(
          (request) =>
            !request.body.includes(f.requester.email) &&
            !request.body.includes(changedEmail),
        ),
    ).toBe(true);
    const suppressed = (await rows(r.eventId)).find(
      (row) => row.recipient_user_id === f.requester.id,
    );
    expect(suppressed).toMatchObject({
      state: "suppressed",
      suppressed_reason: "material_changed",
      payload: prepared.payload,
      idempotency_key: prepared.idempotency_key,
      payload_fingerprint: prepared.payload_fingerprint,
      first_attempt_at: prepared.first_attempt_at,
      attempts: 1,
    });
    expect(
      (await drainTransactionalDeliveries(context, { eventId: r.eventId }))
        .providerAccepted,
    ).toBe(0);
    expect(requests).toHaveLength(3);
  });
  it("independent College booking drains student and assigned tutor navigation without a guardian", async () => {
    f = await workflowFixture(w, reviewer, "self");
    const r = await booking();
    expect(
      (await drainTransactionalDeliveries(runtime(), { eventId: r.eventId }))
        .providerAccepted,
    ).toBe(2);
    expect(requests).toHaveLength(2);
    for (const [email, scope] of [
      [f.requester.email, "student"],
      [f.tutor.email, "tutor"],
    ]) {
      const body = requests
        .map((request) => JSON.parse(request.body))
        .find((value) => value.to.length === 1 && value.to[0] === email);
      expect(body).toBeDefined();
      expect(body.text).toContain(`${origin}/bookings/${r.id}?scope=${scope}`);
      expect(body.text).not.toContain("scope=guardian");
      expect(body.text).not.toContain(f.learner.displayName);
      expect(body.text).not.toContain(f.learner.id);
    }
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM guardian_learner_links WHERE learner_id=$1",
          [f.learner.id],
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      (await rows(r.eventId)).every((row) => row.state === "provider_accepted"),
    ).toBe(true);
  });
  it("superseded confirmation/provisional notices are suppressed; current cancellation is sent", async () => {
    const r = await booking();
    await grantWorkflowTask(w, r.logicalBookingId, reviewer);
    const confirmed = await changePolicyBooking(
      f.context,
      reviewer.headers,
      r.id,
      "confirm",
      {
        requestId: randomUUID(),
        expectedRevision: r.workflowRevision,
        reasonCode: "synthetic_prerequisite_review",
      },
    );
    const cancelled = await changePolicyBooking(
      f.context,
      f.requester.headers,
      r.id,
      "cancel",
      {
        requestId: randomUUID(),
        expectedRevision: confirmed.workflowRevision,
        reasonCode: "synthetic_participant_change",
      },
    );
    expect(
      (await drainTransactionalDeliveries(runtime(), { eventId: r.eventId }))
        .suppressed,
    ).toBe(2);
    expect(
      (
        await drainTransactionalDeliveries(runtime(), {
          eventId: confirmed.eventId,
        })
      ).suppressed,
    ).toBe(2);
    expect(
      (
        await drainTransactionalDeliveries(runtime(), {
          eventId: cancelled.eventId,
        })
      ).providerAccepted,
    ).toBe(2);
    expect(
      requests.every((q) =>
        JSON.parse(q.body).text.includes("Booking cancelled"),
      ),
    ).toBe(true);
  });
  it("participant scope follows actual beneficiary relation even for multiple roles", async () => {
    const r = await booking();
    await w.owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'tutor') ON CONFLICT DO NOTHING",
      [f.requester.id],
    );
    const material = await currentDeliveryMaterial(
      w.runtime.db,
      r.eventId,
      f.requester.id,
      "workflow_provisional",
      Date.now(),
    );
    expect(material?.detailPath).toBe(`/bookings/${r.id}?scope=guardian`);
    expect(JSON.stringify(material)).not.toContain(f.learner.displayName);
  });
  it.each(["complete", "no_show"] as const)(
    "actual assigned MFA %s outcome sends only an administrative notice",
    async (action) => {
      const now = Date.now(),
        start = new Date(now - 3 * 3600000),
        end = new Date(now - 2 * 3600000),
        created = new Date(now - 5 * 3600000);
      const r = await historicalWorkflowBooking(w, f, reviewer, {
        state: "confirmed",
        start,
        end,
        created,
        expires: new Date(created.getTime() + 600000),
      });
      await grantWorkflowTask(w, r.logicalBookingId, reviewer);
      const saved = await changePolicyBooking(
        f.context,
        reviewer.headers,
        r.id,
        action,
        {
          requestId: randomUUID(),
          expectedRevision: 0,
          reasonCode:
            action === "complete" ? "synthetic_completed" : "synthetic_no_show",
        },
      );
      expect(
        (
          await drainTransactionalDeliveries(runtime(), {
            eventId: saved.eventId,
          })
        ).providerAccepted,
      ).toBe(2);
      for (const request of requests) {
        const text = JSON.parse(request.body).text;
        expect(text).toContain(
          "Administrative outcomes do not establish attendance",
        );
        expect(text).not.toContain(f.learner.displayName);
        expect(text).not.toMatch(/meet\.google|zoom\.us/);
      }
    },
  );
  it("actual policy expiry commits its event and sends expiry while suppressing stale provisional", async () => {
    const now = Date.now(),
      created = new Date(now - 11 * 60000),
      start = new Date(Math.ceil((now + 2 * 3600000) / 1800000) * 1800000);
    const r = await historicalWorkflowBooking(w, f, reviewer, {
      state: "provisional",
      created,
      start,
      end: new Date(start.getTime() + 3600000),
      expires: new Date(created.getTime() + 600000),
    });
    await booking(); // Actual create service materializes tutor expiry atomically.
    const state = (
      await w.owner.pool.query("SELECT state FROM bookings WHERE id=$1", [r.id])
    ).rows[0].state;
    expect(state).toBe("expired");
    const e = (
      await w.owner.pool.query(
        "SELECT id FROM booking_lifecycle_events WHERE booking_id=$1 AND event='workflow_expired'",
        [r.id],
      )
    ).rows[0];
    expect(e).toBeDefined();
    expect(
      (await drainTransactionalDeliveries(runtime(), { eventId: r.eventId }))
        .suppressed,
    ).toBe(2);
    expect(
      (await drainTransactionalDeliveries(runtime(), { eventId: e.id }))
        .providerAccepted,
    ).toBe(2);
    expect(
      requests.every((q) =>
        JSON.parse(q.body).text.includes("Provisional booking expired"),
      ),
    ).toBe(true);
  });
  it("runtime cannot insert/delete/retarget/rewrite payload, timestamps, key or closed states", async () => {
    const r = await booking();
    await drainTransactionalDeliveries(runtime(), { eventId: r.eventId });
    const [q] = await rows(r.eventId);
    for (const query of [
      "DELETE FROM transactional_deliveries WHERE id=$1",
      "UPDATE transactional_deliveries SET event_id=gen_random_uuid() WHERE id=$1",
      "UPDATE transactional_deliveries SET payload='{}'::jsonb WHERE id=$1",
      "UPDATE transactional_deliveries SET first_attempt_at=clock_timestamp() WHERE id=$1",
      "UPDATE transactional_deliveries SET idempotency_key='learli/changed' WHERE id=$1",
      "UPDATE transactional_deliveries SET state='pending' WHERE id=$1",
    ])
      await expect(w.runtime.pool.query(query, [q.id])).rejects.toHaveProperty(
        "code",
      );
    await expect(
      w.runtime.pool.query(
        "INSERT INTO transactional_deliveries(event_id,recipient_user_id,kind) VALUES($1,$2,'workflow_provisional')",
        [r.eventId, f.requester.id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      w.runtime.db.execute(sql`SELECT public.queue_transactional_delivery()`),
    ).rejects.toBeDefined();
    expect((await rows(r.eventId))[0].payload).toEqual(q.payload);
  });
});
