import { createHash } from "node:crypto";
import { z } from "zod";
import { localDatabaseConfig } from "@/lib/db/local-config";
import { isLoopbackOrigin } from "@/lib/local-mode";
import { parseServerEnv } from "@/lib/env/schema";

export const MEET_SCOPE =
  "https://www.googleapis.com/auth/meetings.space.created";
export const MEET_SCOPES = ["openid", "email", MEET_SCOPE] as const;
export const CALLBACK_PATH = "/api/tutor/meeting-providers/google/callback";
export const MEET_PAGE = "/tutor/meetings";

export type GoogleMeetConfig = Readonly<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  origin: string;
  fingerprint: string;
  activeKeyId: string;
  keys: Readonly<Record<string, string>>;
}>;

/** Explicit local-development integration only; test transports are injected. */
export function googleMeetConfig(
  source: Record<string, string | undefined> = process.env,
): GoogleMeetConfig | null {
  if (!source.GOOGLE_MEET_ENABLED || source.GOOGLE_MEET_ENABLED === "false")
    return null;
  try {
    const env = parseServerEnv(source);
    if (
      source.GOOGLE_MEET_ENABLED !== "true" ||
      env.APP_ENV !== "development" ||
      env.LOCAL_WORKFLOW_MODE !== "enabled" ||
      env.AUTH_MODE !== "local" ||
      env.DATABASE_MODE !== "local"
    )
      throw new Error();
    return parseMeetFields(source, env.APP_URL);
  } catch {
    throw new Error("Google Meet configuration is invalid. Values omitted.");
  }
}

function parseMeetFields(
  source: Record<string, string | undefined>,
  origin: string,
): GoogleMeetConfig {
  const clientId = z
    .string()
    .min(10)
    .max(256)
    .parse(source.GOOGLE_MEET_CLIENT_ID);
  const clientSecret = z
    .string()
    .min(8)
    .max(512)
    .parse(source.GOOGLE_MEET_CLIENT_SECRET);
  const redirectUri = `${origin}${CALLBACK_PATH}`;
  if (source.GOOGLE_MEET_REDIRECT_URI !== redirectUri) throw new Error();
  const activeKeyId = z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,32}$/)
    .parse(source.GOOGLE_MEET_KEY_ID);
  const keys = z
    .record(
      z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/),
      z.string().regex(/^[a-f0-9]{64}$/),
    )
    .parse(JSON.parse(source.GOOGLE_MEET_KEYS ?? ""));
  if (!keys[activeKeyId] || Object.keys(keys).length > 8) throw new Error();
  return Object.freeze({
    clientId,
    clientSecret,
    redirectUri,
    origin,
    activeKeyId,
    keys: Object.freeze(keys),
    fingerprint: createHash("sha256")
      .update(JSON.stringify(["meet-local-v1", clientId, redirectUri]))
      .digest("hex"),
  });
}

/** Background role needs no Better Auth secret or general application credential. */
export function googleMeetWorkerConfig(
  source: Record<string, string | undefined>,
): GoogleMeetConfig {
  try {
    if (
      source.GOOGLE_MEET_ENABLED !== "true" ||
      source.APP_ENV !== "development" ||
      source.AUTH_MODE !== "local" ||
      source.DATABASE_MODE !== "local" ||
      source.LOCAL_WORKFLOW_MODE !== "enabled" ||
      !isLoopbackOrigin(source.APP_URL ?? "") ||
      new URL(source.APP_URL!).origin !== source.APP_URL ||
      source.DATABASE_URL ||
      source.DATABASE_URL_DIRECT ||
      source.BETTER_AUTH_SECRET ||
      source.PRIVATE_WORKFLOW_CONFIG_FILE ||
      source.HOSTED_AUTH_CONFIG_FILE ||
      source.NEON_DEVELOPMENT_CONFIG_FILE
    )
      throw new Error();
    const db = localDatabaseConfig(source.GOOGLE_MEET_WORKER_DATABASE_URL);
    if (db.user !== "learli_meet_worker" || db.database !== "learli_dev")
      throw new Error();
    return parseMeetFields(source, source.APP_URL!);
  } catch {
    throw new Error(
      "Google Meet worker configuration is invalid. Values omitted.",
    );
  }
}
