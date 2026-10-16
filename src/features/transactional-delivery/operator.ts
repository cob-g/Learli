import "server-only";
import type { HostedAuthConfig } from "@/features/hosted-auth/config";
import { assertHostedAuthConfig } from "@/features/hosted-auth/config";
import { createHostedRuntimeDatabase } from "@/lib/db/hosted-runtime";
import { bindTransactionalDelivery } from "./context";
import { drainTransactionalDeliveries, type DrainOptions } from "./drain";

/** Explicit operator invocation only. No route, worker, scheduler or user resend API. */
export async function drainHostedTransactionalDelivery(
  config: HostedAuthConfig,
  options: DrainOptions = {},
) {
  assertHostedAuthConfig(config);
  // Private account capture is not a Resend booking-delivery transport.
  if (config.mail.mode !== "resend-single-attempt")
    return { status: "disabled" as const };
  const database = await createHostedRuntimeDatabase(config.database);
  try {
    const context = bindTransactionalDelivery(database.db, {
      ...config.mail.transport,
      identitySecret: config.mail.identitySecret,
    });
    if (!context) throw new Error("Transactional delivery unavailable.");
    return {
      status: "completed" as const,
      counts: await drainTransactionalDeliveries(context, options),
    };
  } finally {
    await database.close();
  }
}
