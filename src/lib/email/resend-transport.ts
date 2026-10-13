import "server-only";
import { Resend, type Response as SdkResponse } from "resend";
import { z } from "zod";
import {
  exactHttpsOrigin,
  mailboxSchema,
  readValidatedMessage,
  type ValidatedMessage,
} from "./transactional-message";

export type TransportResult =
  | { status: "accepted"; providerId: string }
  | { status: "retryable"; code: "rate_limited" | "unavailable" }
  | { status: "rejected"; code: "configuration" | "recipient" | "payload" }
  | { status: "uncertain"; code: "timeout" };

const environment = z.enum(["development", "test", "staging", "production"]);
const origin = z.string().refine(exactHttpsOrigin);
const configSchema = z
  .strictObject({
    enabled: z.literal(true),
    environment,
    appOrigin: origin,
    apiKey: z.string().regex(/^re_[A-Za-z0-9_-]{8,256}$/),
    sender: mailboxSchema,
    verifiedSender: z.strictObject({
      sender: mailboxSchema,
      environment,
      appOrigin: origin,
    }),
    allowedRecipients: z.array(mailboxSchema).min(1).max(100),
    timeoutMs: z.number().int().min(1).max(30_000).default(10_000),
  })
  .refine(
    (value) =>
      value.sender === value.verifiedSender.sender &&
      value.environment === value.verifiedSender.environment &&
      value.appOrigin === value.verifiedSender.appOrigin,
  );
export type ResendTransportConfig = z.input<typeof configSchema>;
export const RESEND_IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1000;

const errorSchema = z.object({ name: z.string().max(100) });
const successSchema = z.strictObject({ id: z.uuid() });
const uncertain = (): TransportResult => ({
  status: "uncertain",
  code: "timeout",
});

/**
 * Keep SDK send/post serialization, but bypass its private raw-error logger.
 * This public HTTP boundary neither logs nor returns provider message/headers.
 */
class PrivateResend extends Resend {
  constructor(
    key: string,
    private readonly request: typeof fetch,
  ) {
    // Ignore ambient SDK base URL and user-agent overrides.
    super(key, {
      baseUrl: "https://api.resend.com",
      userAgent: "learli-resend/1",
    });
  }
  override async fetchRequest<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<SdkResponse<T>> {
    if (path !== "/emails" || options.method !== "POST")
      throw new Error("Email request rejected.");
    const response = await this.request(`${this.baseUrl}${path}`, {
      ...options,
      redirect: "error",
    });
    const parsed: unknown = await response.json();
    if (response.ok) {
      // One generic SDK assertion, guarded by endpoint and strict response schema.
      // SDK exposes fetchRequest<T>; this class permits only the send-email shape.
      if (!successSchema.safeParse(parsed).success)
        throw new Error("Email response rejected.");
      return { data: parsed as T, error: null, headers: null };
    }
    const error = errorSchema.safeParse(parsed);
    return {
      data: null,
      error: {
        name: "application_error",
        message: "Email request failed.",
        statusCode: response.status,
        // SDK ErrorResponse is a closed union; recognized names are mapped below.
        ...(error.success &&
        error.data.name === "concurrent_idempotent_requests"
          ? { name: "concurrent_idempotent_requests" as const }
          : error.success && error.data.name === "invalid_idempotent_request"
            ? { name: "invalid_idempotent_request" as const }
            : {}),
      },
      headers: null,
    };
  }
}

/** No ambient configuration or provider I/O until an enabled valid send. */
export function createResendTransport(
  configuration?: unknown,
  testing?: { fetch: typeof fetch; now?: () => number },
): { send(message: ValidatedMessage): Promise<TransportResult> } {
  const parsed = configSchema.safeParse(configuration);
  const config = parsed.success ? parsed.data : undefined;
  const permitted = config && (!testing || config.environment === "test");
  const immutable = new Map<
    string,
    { fingerprint: string; firstAttemptAt: number }
  >();
  let sdk: PrivateResend | undefined;
  return Object.freeze({
    async send(message: ValidatedMessage): Promise<TransportResult> {
      if (!permitted || !config)
        return { status: "rejected", code: "configuration" };
      const body = readValidatedMessage(message);
      if (!body) return { status: "rejected", code: "payload" };
      if (body.appOrigin !== config.appOrigin)
        return { status: "rejected", code: "configuration" };
      if (!config.allowedRecipients.includes(body.to))
        return { status: "rejected", code: "recipient" };
      const now = testing?.now?.() ?? Date.now();
      if (!Number.isSafeInteger(now) || now < message.firstAttemptAt)
        return { status: "rejected", code: "payload" };
      if (now - message.firstAttemptAt >= RESEND_IDEMPOTENCY_RETENTION_MS)
        return uncertain();
      const previous = immutable.get(message.idempotencyKey);
      if (
        previous &&
        (previous.fingerprint !== message.payloadFingerprint ||
          previous.firstAttemptAt !== message.firstAttemptAt)
      )
        return { status: "rejected", code: "payload" };
      if (!previous) {
        immutable.set(message.idempotencyKey, {
          fingerprint: message.payloadFingerprint,
          firstAttemptAt: message.firstAttemptAt,
        });
        // Cache eviction only: no email scheduling or resend action. Do not retain
        // one entry per event for the lifetime of a long-lived server transport.
        const cacheKey = message.idempotencyKey;
        const eviction = setTimeout(
          () => immutable.delete(cacheKey),
          RESEND_IDEMPOTENCY_RETENTION_MS - (now - message.firstAttemptAt),
        );
        eviction.unref();
      }
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        sdk ??= new PrivateResend(
          config.apiKey,
          testing?.fetch ?? globalThis.fetch,
        );
        const result = await Promise.race([
          sdk.emails.send(
            {
              from: config.sender,
              to: [body.to],
              subject: body.subject,
              text: body.text,
              html: body.html,
            },
            {
              idempotencyKey: message.idempotencyKey,
              signal: controller.signal,
            },
          ),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error("Email request timed out."));
            }, config.timeoutMs);
          }),
        ]);
        if (!result.error) {
          const accepted = successSchema.safeParse(result.data);
          return accepted.success
            ? { status: "accepted", providerId: accepted.data.id }
            : uncertain();
        }
        const { name, statusCode } = result.error;
        if (statusCode === 429)
          return { status: "retryable", code: "rate_limited" };
        if (statusCode === 409 && name === "concurrent_idempotent_requests")
          return { status: "retryable", code: "unavailable" };
        if (statusCode === 409) return { status: "rejected", code: "payload" };
        if (statusCode === 408 || statusCode === 504) return uncertain();
        if (statusCode && statusCode >= 500)
          return { status: "retryable", code: "unavailable" };
        if (statusCode === 401 || statusCode === 403)
          return { status: "rejected", code: "configuration" };
        return { status: "rejected", code: "payload" };
      } catch {
        // Connection failure, invalid JSON and timeout may follow API acceptance.
        return uncertain();
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  });
}
