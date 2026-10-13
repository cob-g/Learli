import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import type { Database } from "@/lib/db/connection";
import { createResendTransport } from "@/lib/email/resend-transport";
import {
  createBookingMessageConstructor,
  exactHttpsOrigin,
  mailboxSchema,
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
export type DeliveryContext = NonNullable<
  ReturnType<typeof bindTransactionalDelivery>
>;
export function assertDeliveryContext(context: DeliveryContext) {
  if (!registered.has(context))
    throw new Error("Transactional delivery unavailable.");
}
