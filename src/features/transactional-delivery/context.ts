import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { and, inArray, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/connection";
import type { AuthRuntime } from "@/lib/auth-factory";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { parseServerEnv } from "@/lib/env/schema";
import { transactionalDeliveries as deliveries } from "@/lib/db/schema/transactional-delivery";
import { mailboxSchema } from "@/lib/email/mailbox";
import {
  createResendTransport,
  createLocalBookingResendTransport,
} from "@/lib/email/resend-transport";
import {
  createBookingMessageConstructor,
  exactHttpsOrigin,
  createLocalBookingMessageConstructor,
} from "@/lib/email/transactional-message";

const configuration = z
  .strictObject({
    enabled: z.literal(true),
    environment: z.enum(["test", "staging"]),
    appOrigin: z.string().refine(exactHttpsOrigin),
    apiKey: z.string().regex(/^re_[A-Za-z0-9_-]{8,256}$/),
    sender: mailboxSchema,
    verifiedSender: z.strictObject({
      sender: mailboxSchema,
      environment: z.enum(["test", "staging"]),
      appOrigin: z.string().refine(exactHttpsOrigin),
    }),
    allowedRecipients: z
      .array(mailboxSchema.refine((v) => v.endsWith(".test")))
      .min(1)
      .max(100),
    timeoutMs: z.number().int().min(1).max(30_000).default(10_000),
    identitySecret: z.string().min(32).max(512),
  })
  .refine(
    (v) =>
      v.sender === v.verifiedSender.sender &&
      v.environment === v.verifiedSender.environment &&
      v.appOrigin === v.verifiedSender.appOrigin &&
      new Set(v.allowedRecipients).size === v.allowedRecipients.length,
  );
export type DeliveryConfiguration = z.input<typeof configuration>;
const registered = new WeakSet<object>();

/** Internal composition seam. The operator supplies W2's validated Database;
 * test-owned composition supplies its synthetic Database/SDK boundary. */
export function bindTransactionalDelivery(
  db: Database,
  input?: unknown,
  testing?: { fetch: typeof fetch; now?: () => number },
) {
  const parsed = configuration.safeParse(input);
  if (!parsed.success || (testing && parsed.data.environment !== "test"))
    return null;
  const config = parsed.data;
  const { identitySecret, ...transportConfiguration } = config;
  const context = Object.freeze({
    db,
    candidateFilter: undefined as SQL | undefined,
    configurationFingerprint: createHmac("sha256", identitySecret)
      .update(
        JSON.stringify([
          "booking-delivery-config-v1",
          config.environment,
          config.appOrigin,
          config.sender,
          config.apiKey,
          [...config.allowedRecipients].sort(),
          "booking-notice-v1",
          "resend-6.32.1",
        ]),
      )
      .digest("hex"),
    construct: createBookingMessageConstructor({
      appOrigin: config.appOrigin,
      identitySecret,
    }),
    transport: createResendTransport(transportConfiguration, testing),
  });
  registered.add(context);
  return context;
}

/** Reads only current admitted private local settings; no recipient override. */
export function bindLocalTransactionalDelivery(
  runtime: AuthRuntime,
  source: Record<string, string | undefined> = process.env,
): DeliveryContext | null {
  const capability = getLocalWorkflow(runtime, source);
  if (!capability) return null;
  const env = parseServerEnv(source);
  if (
    !env.LOCAL_VERIFICATION_RESEND_KEY ||
    !env.LOCAL_VERIFICATION_RECIPIENT ||
    !env.BETTER_AUTH_SECRET
  )
    return null;
  const key = env.LOCAL_VERIFICATION_RESEND_KEY;
  const recipient = env.LOCAL_VERIFICATION_RECIPIENT;
  const secret = env.BETTER_AUTH_SECRET;
  const context: DeliveryContext = Object.freeze({
    db: runtime.db,
    // Exclude unrelated/unsupported rows before claiming; never redirect them.
    candidateFilter: and(
      inArray(deliveries.kind, [
        "workflow_provisional",
        "workflow_confirmed",
        "workflow_rescheduled",
        "workflow_cancelled",
        "workflow_expired",
        "workflow_completed",
        "workflow_no_show",
      ]),
      sql`EXISTS (SELECT 1 FROM public."user" u WHERE u.id=${deliveries.recipientUserId} AND u.email=${recipient})`,
      sql`EXISTS (SELECT 1 FROM public.booking_lifecycle_events e JOIN public.bookings b ON b.id=coalesce(e.replacement_booking_id,e.booking_id) WHERE e.id=${deliveries.eventId} AND b.source='local_operation')`,
    ),
    configurationFingerprint: createHmac("sha256", secret)
      .update(
        JSON.stringify([
          "local-booking-delivery-v1",
          capability.origin,
          key,
          recipient,
          "booking-notice-v1",
          "resend-6.32.1",
        ]),
      )
      .digest("hex"),
    construct: createLocalBookingMessageConstructor(capability, secret),
    transport: createLocalBookingResendTransport(capability, {
      key,
      recipient,
    }),
  });
  registered.add(context);
  return context;
}
export type DeliveryContext = NonNullable<
  ReturnType<typeof bindTransactionalDelivery>
>;
export function assertDeliveryContext(context: DeliveryContext) {
  if (!registered.has(context))
    throw new Error("Transactional delivery unavailable.");
}
