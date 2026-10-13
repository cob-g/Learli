// Test-owned composition only. No application module imports this file.
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { createHostedRuntimeDatabase } from "../../src/lib/db/hosted-runtime";
import { composeAccountAuth } from "../../src/features/hosted-auth/composition";
import { bindAccountMail } from "../../src/features/hosted-auth/mail";
import { createResendTransport } from "../../src/lib/email/resend-transport";
import type { HostedAuthConfig } from "../../src/features/hosted-auth/config";

const sdkBody = z.strictObject({
  from: z.literal("sender@example.test"),
  to: z.array(z.string().email()).length(1),
  subject: z.string(),
  text: z.string(),
  html: z.string(),
});
export function syntheticSdkFetch(directory: string): typeof fetch {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  return async (input, options) => {
    if (
      String(input) !== "https://api.resend.com/emails" ||
      options?.method !== "POST" ||
      typeof options.body !== "string"
    )
      throw new Error("Unexpected synthetic SDK request.");
    const body = sdkBody.parse(JSON.parse(options.body));
    const headers = new Headers(options.headers);
    const key = headers.get("Idempotency-Key");
    if (!key?.startsWith("learli/") || !body.to[0].endsWith("@example.test"))
      throw new Error("Unexpected synthetic SDK identity.");
    const responseFile = path.join(directory, "response.json");
    const mode: unknown = existsSync(responseFile)
      ? JSON.parse(readFileSync(responseFile, "utf8"))
      : "accepted";
    const id = randomUUID();
    writeFileSync(
      path.join(directory, `${Date.now()}-${id}.json`),
      JSON.stringify({ body, idempotencyKey: key, mode }),
      { mode: 0o600, flag: "wx" },
    );
    if (mode === "timeout")
      return new Promise<Response>((_, reject) =>
        options.signal?.addEventListener(
          "abort",
          () => reject(new Error("Synthetic timeout")),
          { once: true },
        ),
      );
    const status =
      mode === "accepted"
        ? 200
        : mode === "429"
          ? 429
          : mode === "409"
            ? 409
            : 503;
    return new Response(
      JSON.stringify(
        status === 200
          ? { id }
          : {
              name:
                status === 409
                  ? "concurrent_idempotent_requests"
                  : "application_error",
            },
      ),
      { status, headers: { "content-type": "application/json" } },
    );
  };
}
export async function createSyntheticHostedProvider(
  config: HostedAuthConfig,
  captureDirectory: string,
) {
  const database = await createHostedRuntimeDatabase(config.database);
  try {
    const transport = createResendTransport(
      config.mail.mode === "disabled"
        ? undefined
        : {
            ...config.mail.transport,
            environment: "test",
            verifiedSender: {
              ...config.mail.transport.verifiedSender,
              environment: "test",
            },
          },
      { fetch: syntheticSdkFetch(captureDirectory) },
    );
    const composition = composeAccountAuth(database.db, {
      origin: config.origin,
      secret: config.secret,
      hosted: true,
      permitsEmail: (email) => config.accountEmails.includes(email),
      sendMail: bindAccountMail(config, transport),
    });
    return {
      ...database,
      ...composition,
      origin: config.origin,
      environment: "staging" as const,
      hosted: config,
    };
  } catch {
    await database.close();
    throw new Error("Synthetic provider failed.");
  }
}
