import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { escapeHtml } from "./escape-html";
import { mailboxSchema } from "./mailbox";
import { safeReturnPath } from "@/lib/permissions/return-path";
import { isValidTimeZone } from "@/lib/time/time-zone";

export { mailboxSchema } from "./mailbox";

export type AuthTemplate =
  | "verification-v1"
  | "password-reset-v1"
  | "email-change-current-v1"
  | "email-change-new-v1";

/** Safe projection only. Never contains recipient, proof, URL or email body. */
export type ValidatedMessage = Readonly<{
  template: AuthTemplate | "booking-notice-v1";
  idempotencyKey: string;
  payloadFingerprint: string;
  firstAttemptAt: number;
}>;

type Material = Readonly<{
  appOrigin: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}>;
const material = new WeakMap<ValidatedMessage, Material>();

// Internal server-provider bridge; callers cannot materialize arbitrary bodies.
export function readValidatedMessage(message: ValidatedMessage) {
  return material.get(message);
}

export function exactHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value;
  } catch {
    return false;
  }
}

const baseShape = {
  eventId: z.uuid(),
  // Persist before first dispatch; never replace this on retry.
  firstAttemptAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
};
const linkInput = z.strictObject({
  ...baseShape,
  provider: z.strictObject({ email: mailboxSchema, url: z.string().max(4096) }),
});
const codeInput = z.strictObject({
  ...baseShape,
  provider: z.strictObject({
    email: mailboxSchema,
    otp: z.string().regex(/^\d{6}$/),
  }),
});
export type ProviderLinkInput = z.input<typeof linkInput>;
export type ProviderCodeInput = z.input<typeof codeInput>;
export type MessageConstruction =
  | { ok: true; message: ValidatedMessage }
  | { ok: false; code: "configuration" | "recipient" | "payload" };

function safeUrl(value: string, origin: string): URL | undefined {
  if (
    /[\s\\\u0000-\u001f\u007f]/.test(value) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value)
  )
    return;
  try {
    const url = new URL(value);
    if (
      url.origin !== origin ||
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash
    )
      return;
    return url;
  } catch {
    return;
  }
}

function safeCallback(value: string, origin: string, reset: boolean): boolean {
  if (!value || /[\\\u0000-\u001f\u007f]/.test(value)) return false;
  if (!value.startsWith("/") && !value.startsWith(`${origin}/`)) return false;
  const url = safeUrl(new URL(value, origin).href, origin);
  if (!url || (reset && (url.pathname !== "/reset-password" || url.search)))
    return false;
  if (!reset && !["/", "/sign-in", "/account"].includes(url.pathname))
    return false;
  for (const [key, target] of url.searchParams) {
    if (url.searchParams.getAll(key).length !== 1) return false;
    if (key === "verified" && target === "1") continue;
    if (
      key === "next" &&
      target.startsWith("/") &&
      !target.startsWith("//") &&
      safeReturnPath(target) === target &&
      !/[\\\u0000-\u001f\u007f]/.test(target) &&
      safeUrl(new URL(target, origin).href, origin)
    )
      continue;
    return false;
  }
  return true;
}

function proofUrl(value: string, origin: string, reset: boolean): boolean {
  const url = safeUrl(value, origin);
  if (!url) return false;
  const proof = reset
    ? url.pathname.slice("/api/auth/reset-password/".length)
    : url.searchParams.get("token");
  if (!proof || !/^[A-Za-z0-9._~-]{16,2048}$/.test(proof)) return false;
  if (
    reset
      ? !/^\/api\/auth\/reset-password\/[A-Za-z0-9._~-]+$/.test(url.pathname)
      : url.pathname !== "/api/auth/verify-email"
  )
    return false;
  const allowed = reset ? ["callbackURL"] : ["token", "callbackURL"];
  for (const key of url.searchParams.keys())
    if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1)
      return false;
  const callback = url.searchParams.get("callbackURL");
  return callback !== null && safeCallback(callback, origin, reset);
}

/** Only invoke from trusted provider callbacks after server context validation. */
export function createAuthMessageConstructors(config: unknown) {
  const configuration = z
    .strictObject({
      appOrigin: z.string().refine(exactHttpsOrigin),
      identitySecret: z.string().min(32).max(512),
    })
    .safeParse(config);
  const validConfig = configuration.success;
  const appOrigin = configuration.success ? configuration.data.appOrigin : "";
  const identitySecret = configuration.success
    ? configuration.data.identitySecret
    : "";

  function construct(
    template: AuthTemplate,
    input: unknown,
  ): MessageConstruction {
    if (!validConfig) return { ok: false, code: "configuration" };
    const isCode = template.startsWith("email-change-");
    const parsed = (isCode ? codeInput : linkInput).safeParse(input);
    if (!parsed.success) {
      const recipientInvalid = parsed.error.issues.some(
        (issue) => issue.path.join(".") === "provider.email",
      );
      return { ok: false, code: recipientInvalid ? "recipient" : "payload" };
    }
    const { provider, eventId, firstAttemptAt } = parsed.data;
    const reset = template === "password-reset-v1";
    if ("url" in provider && !proofUrl(provider.url, appOrigin, reset))
      return { ok: false, code: "payload" };
    const subject =
      template === "verification-v1"
        ? "Verify your Learli email"
        : reset
          ? "Reset your Learli password"
          : template === "email-change-current-v1"
            ? "Confirm your current Learli email"
            : "Confirm your new Learli email";
    const url = "url" in provider ? provider.url : `${appOrigin}/account/email`;
    const instruction =
      "otp" in provider
        ? `Enter this single-use code in your signed-in account: ${provider.otp}. It expires in five minutes. Keep this code private.`
        : "Use this private link to continue. If you did not request this, ignore this email.";
    const body: Material = Object.freeze({
      appOrigin,
      to: provider.email,
      subject,
      text: `${subject}\n\n${instruction}\n\n${url}`,
      html: `<h1>${subject}</h1><p>${escapeHtml(instruction)}</p><p><a rel="noreferrer" href="${escapeHtml(url)}">Continue on Learli</a></p>`,
    });
    const hmac = (tuple: unknown[]) =>
      createHmac("sha256", identitySecret)
        .update(JSON.stringify(tuple))
        .digest("hex");
    const message: ValidatedMessage = Object.freeze({
      template,
      idempotencyKey: `learli/${hmac(["identity-v1", eventId, provider.email, template])}`,
      payloadFingerprint: hmac(["payload-v1", body]),
      firstAttemptAt,
    });
    material.set(message, body);
    return { ok: true, message };
  }
  return Object.freeze({
    verification: (input: unknown) => construct("verification-v1", input),
    passwordReset: (input: unknown) => construct("password-reset-v1", input),
    emailChangeCurrent: (input: unknown) =>
      construct("email-change-current-v1", input),
    emailChangeNew: (input: unknown) => construct("email-change-new-v1", input),
  });
}

/** Minimal domain material only; no arbitrary body, child or meeting fields. */
export const bookingMessageInput = z
  .strictObject({
    ...baseShape,
    recipientEmail: mailboxSchema,
    kind: z.enum([
      "provisional",
      "confirmed",
      "rescheduled",
      "cancelled",
      "expired",
      "completed",
      "no_show",
    ]),
    source: z.literal("synthetic_readiness"),
    subject: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .refine((v) => !/[\u0000-\u001f\u007f]/.test(v)),
    startAtUtc: z.iso.datetime({ offset: true }),
    endAtUtc: z.iso.datetime({ offset: true }),
    timezone: z.string().refine(isValidTimeZone),
    detailPath: z
      .string()
      .max(512)
      .refine(
        (v) =>
          /^\/bookings\/[a-f0-9-]{36}\?scope=(student|guardian|tutor)$/.test(
            v,
          ) && safeReturnPath(v) === v,
      ),
  })
  .refine((v) => Date.parse(v.endAtUtc) > Date.parse(v.startAtUtc));
export type BookingMessageInput = z.infer<typeof bookingMessageInput>;

/** Reconstruct only the exact immutable domain snapshot persisted before dispatch. */
export function createBookingMessageConstructor(config: unknown) {
  const parsed = z
    .strictObject({
      appOrigin: z.string().refine(exactHttpsOrigin),
      identitySecret: z.string().min(32).max(512),
    })
    .safeParse(config);
  return (input: unknown): MessageConstruction => {
    if (!parsed.success) return { ok: false, code: "configuration" };
    const notice = bookingMessageInput.safeParse(input);
    if (!notice.success) return { ok: false, code: "payload" };
    const value = notice.data;
    const { appOrigin, identitySecret } = parsed.data;
    const outcomes: Record<BookingMessageInput["kind"], string> = {
      provisional: "Provisional booking",
      confirmed: "Booking confirmed",
      rescheduled: "Booking rescheduled",
      cancelled: "Booking cancelled",
      expired: "Provisional booking expired",
      completed: "Booking administratively completed",
      no_show: "Administrative no-show recorded",
    };
    const outcome = outcomes[value.kind];
    const format = (instant: string) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: value.timezone,
        dateStyle: "full",
        timeStyle: "long",
      }).format(new Date(instant));
    const detailUrl = `${appOrigin}${value.detailPath}`;
    const lines = [
      "Synthetic readiness only. No lesson or email delivery is established.",
      outcome,
      value.subject,
      `Starts: ${format(value.startAtUtc)}`,
      `Ends: ${format(value.endAtUtc)}`,
      "Administrative outcomes do not establish attendance.",
      detailUrl,
    ];
    const body: Material = Object.freeze({
      appOrigin,
      to: value.recipientEmail,
      subject: "Your Learli booking update",
      text: lines.join("\n\n"),
      html: `<h1>Your Learli booking update</h1>${lines
        .slice(0, -1)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join(
          "",
        )}<p><a rel="noreferrer" href="${escapeHtml(detailUrl)}">View your booking on Learli</a></p>`,
    });
    const hmac = (tuple: unknown[]) =>
      createHmac("sha256", identitySecret)
        .update(JSON.stringify(tuple))
        .digest("hex");
    const message: ValidatedMessage = Object.freeze({
      template: "booking-notice-v1",
      idempotencyKey: `learli/${hmac(["booking-identity-v1", value.eventId, value.recipientEmail, value.kind])}`,
      payloadFingerprint: hmac(["booking-payload-v1", body]),
      firstAttemptAt: value.firstAttemptAt,
    });
    material.set(message, body);
    return { ok: true, message };
  };
}
