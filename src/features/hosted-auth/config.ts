import { isIP } from "node:net";
import { z } from "zod";
import { parseServerEnv } from "@/lib/env/schema";
import { stagingDatabaseConfig } from "@/lib/db/staging-config";
import { syntheticEmail } from "@/lib/local-mode";
// Node entry can validate configuration without importing server-only modules.
const mailboxSchema = z
  .string()
  .max(254)
  .email()
  .regex(/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+$/)
  .refine((value) => !value.includes(".."));

export class HostedAuthError extends Error {
  constructor(
    readonly code: "configuration" | "private_file" | "unavailable" | "ingress",
  ) {
    super(`Hosted account service refused: ${code}. Details omitted.`);
  }
}
export function hostedOrigin(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.origin === value &&
      !/[\s\\\u0000-\u001f\u007f]/.test(value) &&
      !isIP(url.hostname.replace(/^\[|\]$/g, "")) &&
      url.hostname !== "localhost" &&
      !url.hostname.endsWith(".localhost") &&
      !url.hostname.endsWith(".local") &&
      url.hostname.includes(".") &&
      /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(
        url.hostname,
      )
    );
  } catch {
    return false;
  }
}
const secret = z.string().min(32).max(512);
const address = z
  .string()
  .refine((value) => isIP(value) !== 0 && !/[\s,%]/.test(value));
const ingressSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("disabled") }),
  z.strictObject({
    mode: z.literal("trusted-proxy"),
    trustedPeerAddresses: z
      .array(address)
      .min(1)
      .max(16)
      .refine((v) => new Set(v).size === v.length),
    clientIp: z.enum(["shared-bucket", "overwritten-single-header"]),
    httpsHeader: z.literal("x-forwarded-proto"),
  }),
]);
const transportSchema = z.strictObject({
  enabled: z.literal(true),
  environment: z.literal("staging"),
  appOrigin: z.string().refine(hostedOrigin),
  apiKey: z.string().regex(/^re_[A-Za-z0-9_-]{8,256}$/),
  sender: mailboxSchema,
  verifiedSender: z.strictObject({
    sender: mailboxSchema,
    environment: z.literal("staging"),
    appOrigin: z.string().refine(hostedOrigin),
  }),
  allowedRecipients: z.array(mailboxSchema).min(1).max(100),
  timeoutMs: z.number().int().min(1).max(30000).default(10000),
});
const packetSchema = z.strictObject({
  version: z.literal(1),
  purpose: z.literal("hosted_synthetic"),
  realIntake: z.literal("disabled"),
  accountEmails: z
    .array(
      mailboxSchema.refine((v) => v === v.toLowerCase() && syntheticEmail(v)),
    )
    .min(1)
    .max(100)
    .refine((v) => new Set(v).size === v.length),
  STAGING_DATABASE_URL: z.string().min(1).max(4096),
  target: z.unknown(),
  ingress: ingressSchema.default({ mode: "disabled" }),
  mail: z
    .discriminatedUnion("mode", [
      z.strictObject({ mode: z.literal("disabled") }),
      z.strictObject({
        mode: z.literal("resend-single-attempt"),
        transport: transportSchema,
        identitySecret: secret,
      }),
    ])
    .default({ mode: "disabled" }),
});
const registered = new WeakSet<object>();
export function assertHostedAuthConfig(config: HostedAuthConfig) {
  if (!registered.has(config)) throw new HostedAuthError("configuration");
}
/** Pure admission. Never performs a connection or send, never accepts production. */
export function parseHostedAuthConfig(
  source: Record<string, string | undefined>,
  packet: unknown,
) {
  try {
    const env = parseServerEnv(source);
    const parsed = packetSchema.parse(packet);
    if (
      env.APP_ENV !== "staging" ||
      env.AUTH_MODE !== "hosted-synthetic" ||
      !hostedOrigin(env.APP_URL) ||
      env.BETTER_AUTH_URL !== env.APP_URL ||
      !secret.safeParse(env.BETTER_AUTH_SECRET).success ||
      !secret.safeParse(env.HOSTED_INGRESS_SECRET).success ||
      env.HOSTED_INGRESS_SECRET === env.BETTER_AUTH_SECRET ||
      source.BETTER_AUTH_SECRETS !== undefined ||
      env.DATABASE_URL ||
      env.DATABASE_URL_DIRECT
    )
      throw new Error();
    const database = stagingDatabaseConfig({
      appEnv: "staging",
      url: parsed.STAGING_DATABASE_URL,
      target: parsed.target,
      purpose: "runtime",
    });
    if (parsed.mail.mode === "resend-single-attempt") {
      const t = parsed.mail.transport;
      if (
        t.appOrigin !== env.APP_URL ||
        t.verifiedSender.appOrigin !== env.APP_URL ||
        t.sender !== t.verifiedSender.sender ||
        t.allowedRecipients.length !== parsed.accountEmails.length ||
        new Set(t.allowedRecipients).size !== t.allowedRecipients.length ||
        t.allowedRecipients.some(
          (email) => !parsed.accountEmails.includes(email),
        )
      )
        throw new Error();
    }
    if (parsed.ingress.mode === "trusted-proxy")
      Object.freeze(parsed.ingress.trustedPeerAddresses);
    Object.freeze(parsed.ingress);
    if (parsed.mail.mode !== "disabled") {
      Object.freeze(parsed.mail.transport.verifiedSender);
      Object.freeze(parsed.mail.transport.allowedRecipients);
      Object.freeze(parsed.mail.transport);
    }
    Object.freeze(parsed.mail);
    const result = Object.freeze({
      origin: env.APP_URL,
      secret: env.BETTER_AUTH_SECRET!,
      ingressSecret: env.HOSTED_INGRESS_SECRET!,
      database,
      accountEmails: Object.freeze([...parsed.accountEmails]),
      ingress: parsed.ingress,
      mail: parsed.mail,
    });
    registered.add(result);
    return result;
  } catch {
    throw new HostedAuthError("configuration");
  }
}
export type HostedAuthConfig = ReturnType<typeof parseHostedAuthConfig>;
