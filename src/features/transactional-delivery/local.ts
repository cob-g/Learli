import "server-only";
import { after } from "next/server";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { bindLocalTransactionalDelivery } from "./context";
import { drainTransactionalDeliveries, type DrainOptions } from "./drain";
import { emitDiagnostic } from "@/lib/diagnostics.server";

export async function drainLocalBookingNotices(
  runtime: AuthRuntime,
  options: DrainOptions = {},
) {
  const context = bindLocalTransactionalDelivery(runtime);
  return context
    ? {
        status: "completed" as const,
        counts: await drainTransactionalDeliveries(context, options),
      }
    : { status: "disabled" as const };
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
