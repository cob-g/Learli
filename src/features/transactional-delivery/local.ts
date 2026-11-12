import "server-only";
import { after } from "next/server";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { bindLocalTransactionalDelivery } from "./context";
import { drainTransactionalDeliveries, type DrainOptions } from "./drain";
import { emitDiagnostic } from "@/lib/diagnostics.server";
import { reconcileLocalBookingExpiry } from "./expiry";

const shared = globalThis as typeof globalThis & {
  learliBookingMaintenance?: WeakMap<object, number>;
};
const maintenance = (shared.learliBookingMaintenance ??= new WeakMap<
  object,
  number
>());

export async function drainLocalBookingNotices(
  runtime: AuthRuntime,
  options: DrainOptions = {},
) {
  const context = bindLocalTransactionalDelivery(runtime);
  if (context && !options.eventId) {
    try {
      await reconcileLocalBookingExpiry(runtime);
    } catch {
      // A contended expiry must not stop recovery of unrelated queued notices.
      emitDiagnostic("booking.notice_unavailable");
    }
  }
  return context
    ? {
        status: "completed" as const,
        counts: await drainTransactionalDeliveries(context, options),
      }
    : { status: "disabled" as const };
}

/** Called at successful authenticated workspace/read boundaries. This bounds
 * activity-driven work; it is not a clock job or an authorization cache. */
export function scheduleLocalBookingMaintenance(runtime: AuthRuntime) {
  try {
    if (!bindLocalTransactionalDelivery(runtime)) return;
    const now = Date.now();
    if (now - (maintenance.get(runtime.pool) ?? -Infinity) < 60_000) return;
    maintenance.set(runtime.pool, now);
    after(async () => {
      try {
        await drainLocalBookingNotices(runtime, { limit: 25 });
      } catch {
        emitDiagnostic("booking.notice_unavailable");
      }
    });
  } catch {
    emitDiagnostic("booking.notice_unavailable");
  }
}

/** Called only with the service's committed receipt, never with request fields. */
export function scheduleLocalBookingNotices(
  runtime: AuthRuntime,
  eventId: string,
) {
  try {
    if (
      !z.uuid().safeParse(eventId).success ||
      !bindLocalTransactionalDelivery(runtime)
    )
      return;
    after(async () => {
      try {
        // Rebind at execution, then fresh participant checks run before send.
        await drainLocalBookingNotices(runtime, { eventId, limit: 2 });
      } catch {
        emitDiagnostic("booking.notice_unavailable");
      }
    });
  } catch {
    // The booking is committed. Queue state remains recoverable by explicit drain.
    emitDiagnostic("booking.notice_unavailable");
  }
}
