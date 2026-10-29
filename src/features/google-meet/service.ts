import { sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { requireRole, AccessError } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import {
  hashSecret,
  randomSecret,
  encryptSecret,
  decryptSecret,
  attemptContext,
  tokenContext,
} from "./crypto";
import { type GoogleMeetConfig } from "./config";
import type { GoogleMeetProvider } from "./provider";

export type ConnectionMetadata = {
  state: "active" | "reconnect" | "disconnected";
  account_label: string;
  generation: number;
};
async function actor(runtime: AuthRuntime, headers: Headers, fresh: boolean) {
  const identity = await requireRole(runtime, headers, "tutor");
  const { sessionConfig } = await runtime.auth.$context;
  if (fresh) {
    const result = await runtime.db.execute<{ fresh: boolean }>(
      sql`SELECT (expires_at>clock_timestamp() AND (${sessionConfig.freshAge}::integer=0 OR created_at>clock_timestamp()-${sessionConfig.freshAge}::integer*interval '1 second')) AS fresh FROM session WHERE id=${identity.sessionId} AND user_id=${identity.userId}`,
    );
    if (!result.rows[0]?.fresh)
      throw new RuleError(
        403,
        "Sign out, then sign in again to manage your Google connection.",
      );
  }
  return identity;
}
export async function readGoogleConnection(
  runtime: AuthRuntime,
  headers: Headers,
  fingerprint?: string,
): Promise<ConnectionMetadata | null> {
  const who = await actor(runtime, headers, false);
  const result = await runtime.db.execute<
    ConnectionMetadata & { fingerprint: string }
  >(
    sql`SELECT * FROM public.google_meet_metadata(${who.userId},${who.sessionId})`,
  );
  const current = result.rows[0];
  return current
    ? {
        state:
          fingerprint && current.fingerprint !== fingerprint
            ? "reconnect"
            : current.state,
        account_label: current.account_label,
        generation: current.generation,
      }
    : null;
}
export async function startGoogleConnection(
  runtime: AuthRuntime,
  headers: Headers,
  config: GoogleMeetConfig,
  provider: GoogleMeetProvider,
  input: unknown,
) {
  const values = z
    .object({
      consent: z.literal(true),
      replaceAccount: z.boolean().default(false),
    })
    .strict()
    .parse(input);
  const who = await actor(runtime, headers, true);
  const state = randomSecret(),
    browser = randomSecret(),
    nonce = randomSecret(),
    verifier = randomSecret();
  const stateHash = hashSecret(state);
  const ciphertext = encryptSecret(
    config,
    verifier,
    attemptContext(who.userId, stateHash, config.fingerprint),
  );
  await runtime.db.execute(
    sql`SELECT public.google_meet_begin(${who.userId},${who.sessionId},${stateHash},${hashSecret(browser)},${nonce},${ciphertext},${config.fingerprint},${values.replaceAccount})`,
  );
  const challenge = Buffer.from(hashSecret(verifier), "hex").toString(
    "base64url",
  );
  return { url: provider.authorize(state, nonce, challenge), browser };
}
export async function finishGoogleConnection(
  runtime: AuthRuntime,
  headers: Headers,
  config: GoogleMeetConfig,
  provider: GoogleMeetProvider,
  query: URLSearchParams,
  browser: string | null,
) {
  if (
    [...query.keys()].some(
      (key) =>
        ![
          "state",
          "code",
          "error",
          "scope",
          "authuser",
          "prompt",
          "hd",
          "iss",
        ].includes(key) || query.getAll(key).length !== 1,
    ) ||
    (query.has("iss") && query.get("iss") !== "https://accounts.google.com")
  )
    throw new RuleError(
      400,
      "Restart the Google connection from your tutor workspace.",
    );
  if (query.has("code") === query.has("error"))
    throw new RuleError(
      400,
      "Restart the Google connection from your tutor workspace.",
    );
  const state = z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .parse(query.get("state"));
  if (!browser || !/^[A-Za-z0-9_-]{43}$/.test(browser))
    throw new AccessError(403);
  const who = await actor(runtime, headers, true),
    stateHash = hashSecret(state);
  const result = await runtime.db.execute<{
    connection_id: string;
    nonce: string;
    verifier_ciphertext: string;
  }>(
    sql`SELECT * FROM public.google_meet_consume(${who.userId},${who.sessionId},${stateHash},${hashSecret(browser)},${config.fingerprint})`,
  );
  const attempt = result.rows[0];
  if (!attempt) throw new AccessError(403);
  if (query.has("error")) return "cancelled" as const;
  const code = z.string().min(1).max(4096).parse(query.get("code"));
  const verifier = decryptSecret(
    config,
    attempt.verifier_ciphertext,
    attemptContext(who.userId, stateHash, config.fingerprint),
  );
  const grant = z
    .object({
      subject: z.string().min(1).max(255),
      label: z.email().max(320),
      scopes: z.array(z.string().max(256)).max(50),
      refreshToken: z.string().min(1).max(8192).nullable(),
    })
    .parse(await provider.exchange(code, verifier, attempt.nonce));
  // Provider I/O happened without locks; identity is freshly rechecked before persistence.
  const current = await actor(runtime, headers, true);
  if (current.userId !== who.userId || current.sessionId !== who.sessionId)
    throw new AccessError(403);
  const cipher = grant.refreshToken
    ? encryptSecret(
        config,
        grant.refreshToken,
        tokenContext(
          attempt.connection_id,
          who.userId,
          grant.subject,
          config.fingerprint,
        ),
      )
    : null;
  const saved = await runtime.db.execute<{ saved: boolean }>(
    sql`SELECT public.google_meet_complete(${who.userId},${who.sessionId},${stateHash},${grant.subject},${grant.label},${cipher},${sql.param(grant.scopes)}::text[],${config.fingerprint}) AS saved`,
  );
  if (!saved.rows[0]?.saved)
    throw new RuleError(
      409,
      "Google connection changed or needs renewed consent. Start again; confirm replacement when choosing a different Google account.",
    );
  return "connected" as const;
}
export async function disconnectGoogleConnection(
  runtime: AuthRuntime,
  headers: Headers,
  config: GoogleMeetConfig | null,
  provider: GoogleMeetProvider | null,
) {
  const who = await actor(runtime, headers, true);
  const result = await runtime.db.execute<{
    id: string;
    google_subject: string;
    fingerprint: string;
    refresh_ciphertext: string | null;
  }>(
    sql`SELECT * FROM public.google_meet_disconnect(${who.userId},${who.sessionId})`,
  );
  const old = result.rows[0];
  if (!config || !provider || !old?.refresh_ciphertext)
    return { disconnected: true, providerRevoked: false };
  try {
    const token = decryptSecret(
      config,
      old.refresh_ciphertext,
      tokenContext(old.id, who.userId, old.google_subject, old.fingerprint),
    );
    await provider.revoke(token);
    return { disconnected: true, providerRevoked: true };
  } catch {
    return { disconnected: true, providerRevoked: false };
  }
}
