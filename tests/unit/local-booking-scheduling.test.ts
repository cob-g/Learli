import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { createLocalAuth } from "@/lib/auth-factory";
import { bindLocalTransactionalDelivery } from "@/features/transactional-delivery/context";
import {
  scheduleLocalBookingNotices,
  scheduleLocalBookingMaintenance,
  drainLocalBookingNotices,
} from "@/features/transactional-delivery/local";
import * as expiry from "@/features/transactional-delivery/expiry";
import * as drain from "@/features/transactional-delivery/drain";
import { handleWorkflowMutation } from "@/features/booking-workflows/handler";
import {
  createPolicyReservation,
  changePolicyBooking,
} from "@/features/booking-workflows/service";
import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { PgDialect } from "drizzle-orm/pg-core";
import { after } from "next/server";

vi.mock("@/features/transactional-delivery/expiry", () => ({
  reconcileLocalBookingExpiry: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/features/booking-workflows/service", () => ({
  createPolicyReservation: vi.fn(),
  changePolicyBooking: vi.fn(),
}));
const source = {
  APP_ENV: "development",
  AUTH_MODE: "local",
  DATABASE_MODE: "local",
  LOCAL_WORKFLOW_MODE: "enabled",
  APP_URL: "http://127.0.0.1:3000",
  BETTER_AUTH_URL: "http://127.0.0.1:3000",
  DATABASE_URL: "postgresql://learli_app:synthetic@127.0.0.1:55499/learli_dev",
  BETTER_AUTH_SECRET: "synthetic-local-scheduler-secret-123456",
  LOCAL_VERIFICATION_RESEND_KEY: "re_synthetic123456",
  LOCAL_VERIFICATION_RECIPIENT: "owner@example.com",
};
const runtime = createLocalAuth(source);
const eventId = "ad52bfd5-e5a9-4c26-a9d6-f42441a0306d";
const receipt = {
  id: eventId,
  logicalBookingId: eventId,
  revision: 0,
  workflowRevision: 0,
  eventId,
  state: "confirmed" as const,
  policyVersion: "synthetic",
};
const counts = {
  providerAccepted: 1,
  retryable: 0,
  uncertain: 0,
  suppressed: 0,
  blocked: 0,
  skipped: 0,
  unavailable: 0,
};
beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries(source)) vi.stubEnv(key, value);
  vi.stubEnv("DATABASE_URL_DIRECT", undefined);
  vi.spyOn(drain, "drainTransactionalDeliveries").mockResolvedValue(counts);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterAll(() => runtime.pool.end());
const request = () =>
  new Request(`${runtime.origin}/api/bookings`, {
    method: "POST",
    headers: { origin: runtime.origin, "content-type": "application/json" },
    body: "{}",
  });

it("binds actual local runtime settings and filters exact owner/local source/seven kinds before claims", () => {
  const context = bindLocalTransactionalDelivery(runtime)!;
  const query = new PgDialect().sqlToQuery(context.candidateFilter!);
  expect(query.params).toContain(source.LOCAL_VERIFICATION_RECIPIENT);
  expect(
    query.params.filter(
      (v) => typeof v === "string" && v.startsWith("workflow_"),
    ),
  ).toEqual([
    "workflow_provisional",
    "workflow_confirmed",
    "workflow_rescheduled",
    "workflow_cancelled",
    "workflow_expired",
    "workflow_completed",
    "workflow_no_show",
  ]);
  expect(query.sql).toContain("local_operation");
  expect(query.sql).toContain('"recipient_user_id"');
});

it("does not schedule when disabled or when a key/recipient is absent", () => {
  vi.stubEnv("LOCAL_VERIFICATION_RESEND_KEY", undefined);
  vi.stubEnv("LOCAL_VERIFICATION_RECIPIENT", undefined);
  expect(bindLocalTransactionalDelivery(runtime)).toBeNull();
  scheduleLocalBookingNotices(runtime, eventId);
  expect(after).not.toHaveBeenCalled();
  expect(drain.drainTransactionalDeliveries).not.toHaveBeenCalled();
});

it("runs a bounded event-specific drain only after callback execution and rebinds configuration", async () => {
  scheduleLocalBookingNotices(runtime, eventId);
  expect(after).toHaveBeenCalledTimes(1);
  expect(drain.drainTransactionalDeliveries).not.toHaveBeenCalled();
  const callback = vi.mocked(after).mock.calls[0]![0] as () => Promise<void>;
  await callback();
  expect(drain.drainTransactionalDeliveries).toHaveBeenCalledWith(
    expect.anything(),
    { eventId, limit: 2 },
  );
  vi.mocked(drain.drainTransactionalDeliveries).mockClear();
  vi.stubEnv("LOCAL_VERIFICATION_RESEND_KEY", undefined);
  vi.stubEnv("LOCAL_VERIFICATION_RECIPIENT", undefined);
  await callback();
  expect(drain.drainTransactionalDeliveries).not.toHaveBeenCalled();
});

it("keeps a successful response successful if scheduling or sending fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(createPolicyReservation).mockResolvedValue(receipt);
  vi.mocked(after).mockImplementationOnce(() => {
    throw Error("Synthetic scheduler unavailable");
  });
  expect(
    (
      await handleWorkflowMutation(
        runtime,
        request(),
        undefined,
        undefined,
        bookingWorkflowContext(runtime),
      )
    ).status,
  ).toBe(200);
  scheduleLocalBookingNotices(runtime, eventId);
  vi.mocked(drain.drainTransactionalDeliveries).mockRejectedValueOnce(
    Error("Synthetic send failure"),
  );
  const callback = vi
    .mocked(after)
    .mock.calls.at(-1)![0] as () => Promise<void>;
  await expect(callback()).resolves.toBeUndefined();
});

it("does not schedule before commit resolution or after a rejected transaction", async () => {
  let commit!: (value: typeof receipt) => void;
  vi.mocked(createPolicyReservation).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        commit = resolve;
      }),
  );
  const pending = handleWorkflowMutation(
    runtime,
    request(),
    undefined,
    undefined,
    bookingWorkflowContext(runtime),
  );
  await vi.waitFor(() => expect(commit).toBeTypeOf("function"));
  expect(after).not.toHaveBeenCalled();
  commit(receipt);
  expect((await pending).status).toBe(200);
  expect(after).toHaveBeenCalledTimes(1);
  vi.mocked(after).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(createPolicyReservation).mockRejectedValueOnce(
    Error("Synthetic rolled-back transaction"),
  );
  expect(
    (
      await handleWorkflowMutation(
        runtime,
        request(),
        undefined,
        undefined,
        bookingWorkflowContext(runtime),
      )
    ).status,
  ).toBe(503);
  expect(after).not.toHaveBeenCalled();
});

it.each(["confirm", "reschedule", "cancel", "complete", "no_show"] as const)(
  "schedules committed event after %s",
  async (action) => {
    vi.mocked(changePolicyBooking).mockResolvedValue(receipt);
    expect(
      (
        await handleWorkflowMutation(
          runtime,
          request(),
          eventId,
          action,
          bookingWorkflowContext(runtime),
        )
      ).status,
    ).toBe(200);
    expect(after).toHaveBeenCalledTimes(1);
  },
);

it("bounds maintenance to once per minute and rebinds before callback work", async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    scheduleLocalBookingMaintenance(runtime);
    scheduleLocalBookingMaintenance(runtime);
    expect(after).toHaveBeenCalledTimes(1);
    const callback = vi.mocked(after).mock.calls[0]![0] as () => Promise<void>;
    expect(expiry.reconcileLocalBookingExpiry).not.toHaveBeenCalled();
    await callback();
    expect(expiry.reconcileLocalBookingExpiry).toHaveBeenCalledTimes(1);
    expect(drain.drainTransactionalDeliveries).toHaveBeenCalledWith(
      expect.anything(),
      { limit: 25 },
    );
    vi.advanceTimersByTime(60_000);
    scheduleLocalBookingMaintenance(runtime);
    expect(after).toHaveBeenCalledTimes(2);
    vi.stubEnv("LOCAL_VERIFICATION_RESEND_KEY", undefined);
    vi.stubEnv("LOCAL_VERIFICATION_RECIPIENT", undefined);
    await (vi.mocked(after).mock.calls[1]![0] as () => Promise<void>)();
    expect(expiry.reconcileLocalBookingExpiry).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

it("isolates expiry contention from delivery and does not reconcile on immediate event sends", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(expiry.reconcileLocalBookingExpiry).mockRejectedValueOnce(
    Error("Synthetic lock timeout"),
  );
  await expect(
    drainLocalBookingNotices(runtime, { limit: 2 }),
  ).resolves.toMatchObject({ status: "completed" });
  expect(drain.drainTransactionalDeliveries).toHaveBeenCalledTimes(1);
  vi.mocked(expiry.reconcileLocalBookingExpiry).mockClear();
  await drainLocalBookingNotices(runtime, { eventId, limit: 2 });
  expect(expiry.reconcileLocalBookingExpiry).not.toHaveBeenCalled();
});

it("disabled maintenance does not schedule or query", () => {
  vi.stubEnv("LOCAL_VERIFICATION_RESEND_KEY", undefined);
  vi.stubEnv("LOCAL_VERIFICATION_RECIPIENT", undefined);
  scheduleLocalBookingMaintenance(runtime);
  expect(after).not.toHaveBeenCalled();
  expect(expiry.reconcileLocalBookingExpiry).not.toHaveBeenCalled();
});
