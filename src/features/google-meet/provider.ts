import { OAuth2Client, CodeChallengeMethod } from "google-auth-library";
import { z } from "zod";
import { validateMeetingLink } from "@/lib/validation/meeting-link";
import { MEET_SCOPE, MEET_SCOPES, type GoogleMeetConfig } from "./config";

export type GoogleGrant = {
  subject: string;
  label: string;
  scopes: string[];
  refreshToken: string | null;
};
export type MeetReceipt = { name: string; uri: string };
export type GoogleFailureCode =
  | "refresh_rejected"
  | "refresh_unavailable"
  | "create_rejected"
  | "rate_limited"
  | "uncertain"
  | "credential";
const diagnosticSchema = z
  .object({
    httpStatus: z.number().int().min(400).max(599),
    status: z.enum([
      "INVALID_ARGUMENT",
      "UNAUTHENTICATED",
      "PERMISSION_DENIED",
      "RESOURCE_EXHAUSTED",
      "UNCLASSIFIED",
    ]),
    reason: z.enum([
      "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
      "SERVICE_DISABLED",
      "BILLING_DISABLED",
      "CONSUMER_INVALID",
      "USER_PROJECT_DENIED",
      "IAM_PERMISSION_DENIED",
      "RATE_LIMIT_EXCEEDED",
      "RESOURCE_QUOTA_EXCEEDED",
      "UNCLASSIFIED",
    ]),
  })
  .strict();
export type GoogleCreateDiagnostic = z.infer<typeof diagnosticSchema>;
export class GoogleFailure extends Error {
  readonly diagnostic?: Readonly<GoogleCreateDiagnostic>;
  constructor(
    readonly code: GoogleFailureCode,
    diagnostic?: GoogleCreateDiagnostic,
  ) {
    super("Google meeting service unavailable. Details omitted.");
    const safe = diagnosticSchema.safeParse(diagnostic);
    if (safe.success) this.diagnostic = Object.freeze(safe.data);
  }
}

/** Never retain provider messages, identifiers, arbitrary metadata or raw bodies. */
async function createDiagnostic(
  response: Response,
  signal: AbortSignal,
): Promise<GoogleCreateDiagnostic> {
  const diagnostic: GoogleCreateDiagnostic = {
    httpStatus: response.status,
    status: "UNCLASSIFIED",
    reason: "UNCLASSIFIED",
  };
  try {
    const body = z
      .object({
        error: z.object({
          status: z.string().optional(),
          details: z
            .array(
              z.object({
                "@type": z.string().optional(),
                domain: z.string().optional(),
                reason: z.string().optional(),
              }),
            )
            .max(20)
            .optional(),
        }),
      })
      .parse(await readBoundedJson(response, signal));
    diagnostic.status = diagnosticSchema.shape.status
      .catch("UNCLASSIFIED")
      .parse(body.error.status);
    const info = body.error.details?.find(
      (d) =>
        d["@type"] === "type.googleapis.com/google.rpc.ErrorInfo" &&
        ["googleapis.com", "meet.googleapis.com"].includes(d.domain ?? ""),
    );
    diagnostic.reason = diagnosticSchema.shape.reason
      .catch("UNCLASSIFIED")
      .parse(info?.reason);
  } catch {
    /* Missing, malformed, oversized or timed-out bodies stay unclassified. */
  }
  return diagnostic;
}

async function readBoundedJson(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  signal.throwIfAborted();
  const reader = response.body?.getReader();
  if (!reader) throw new Error();
  let abort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    abort = () => reject(new Error("Google response deadline exceeded."));
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([
      aborted,
      (async () => {
        const chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 65536) throw new Error();
          chunks.push(part.value);
        }
        return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
      })(),
    ]);
  } finally {
    signal.removeEventListener("abort", abort);
    // Do not wait on a remote cancellation acknowledgement beyond the deadline.
    void reader.cancel().catch(() => {});
  }
}
export interface GoogleMeetProvider {
  authorize(state: string, nonce: string, challenge: string): string;
  exchange(code: string, verifier: string, nonce: string): Promise<GoogleGrant>;
  accessToken(refreshToken: string): Promise<string>;
  createSpace(accessToken: string): Promise<MeetReceipt>;
  revoke(refreshToken: string): Promise<void>;
}
const client = (config: GoogleMeetConfig) =>
  new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    transporterOptions: { retry: false, timeout: 10_000 },
  });

export function validateMeetReceipt(value: unknown): MeetReceipt {
  const result = z
    .object({
      name: z.string().regex(/^spaces\/[A-Za-z0-9_-]{1,128}$/),
      meetingUri: z.string().max(2048),
      config: z.object({ accessType: z.literal("RESTRICTED") }),
    })
    .parse(value);
  const link = validateMeetingLink(result.meetingUri);
  if (!link.ok || link.provider !== "google_meet")
    throw new GoogleFailure("uncertain");
  return { name: result.name, uri: link.url };
}

/** Construct only after the explicit environment gate. Never use OAuth.request
 * for create: it can transparently refresh and replay a non-idempotent POST. */
export function googleMeetProvider(
  config: GoogleMeetConfig,
): GoogleMeetProvider {
  return {
    authorize: (state, nonce, challenge) =>
      client(config).generateAuthUrl({
        access_type: "offline",
        prompt: "consent select_account",
        scope: [...MEET_SCOPES],
        state,
        nonce,
        code_challenge: challenge,
        code_challenge_method: CodeChallengeMethod.S256,
        include_granted_scopes: false,
      }),
    async exchange(code, verifier, nonce) {
      try {
        const auth = client(config);
        const { tokens } = await auth.getToken({
          code,
          codeVerifier: verifier,
        });
        if (!tokens.id_token) throw new Error();
        const ticket = await auth.verifyIdToken({
          idToken: tokens.id_token,
          audience: config.clientId,
        });
        const payload = z
          .object({
            sub: z.string().min(1).max(255),
            email: z.email().max(320),
            email_verified: z.literal(true),
            nonce: z.literal(nonce),
          })
          .parse(ticket.getPayload());
        const scopes = (tokens.scope ?? "").split(/\s+/).filter(Boolean);
        if (!scopes.includes(MEET_SCOPE)) throw new Error();
        return {
          subject: payload.sub,
          label: payload.email,
          scopes,
          refreshToken: tokens.refresh_token ?? null,
        };
      } catch {
        throw new GoogleFailure("refresh_rejected");
      }
    },
    async accessToken(refreshToken) {
      try {
        const auth = client(config);
        auth.setCredentials({ refresh_token: refreshToken });
        const { token } = await auth.getAccessToken();
        if (!token) throw new Error();
        return token;
      } catch (error) {
        // Inspect only the provider's code, never propagate its response/body.
        const result = z
          .object({
            response: z.object({ data: z.object({ error: z.string() }) }),
          })
          .safeParse(error);
        throw new GoogleFailure(
          result.success && result.data.response.data.error === "invalid_grant"
            ? "refresh_rejected"
            : "refresh_unavailable",
        );
      }
    },
    async createSpace(accessToken) {
      try {
        const signal = AbortSignal.timeout(10_000);
        const response = await fetch("https://meet.googleapis.com/v2/spaces", {
          method: "POST",
          redirect: "error",
          cache: "no-store",
          signal,
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            config: { accessType: "RESTRICTED", entryPointAccess: "ALL" },
          }),
        });
        if (response.status === 429)
          throw new GoogleFailure(
            "rate_limited",
            await createDiagnostic(response, signal),
          );
        if ([400, 401, 403].includes(response.status))
          throw new GoogleFailure(
            "create_rejected",
            await createDiagnostic(response, signal),
          );
        if (!response.ok) throw new GoogleFailure("uncertain");
        return validateMeetReceipt(await readBoundedJson(response, signal));
      } catch (error) {
        throw error instanceof GoogleFailure
          ? error
          : new GoogleFailure("uncertain");
      }
    },
    async revoke(refreshToken) {
      try {
        await client(config).revokeToken(refreshToken);
      } catch {
        throw new GoogleFailure("refresh_unavailable");
      }
    },
  };
}
