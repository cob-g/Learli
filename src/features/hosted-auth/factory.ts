import "server-only";
import { createHostedRuntimeDatabase } from "@/lib/db/hosted-runtime";
import { stagingPoolConfig } from "@/lib/db/staging-config";
import { composeAccountAuth } from "./composition";
import {
  HostedAuthError,
  hostedOrigin,
  assertHostedAuthConfig,
  type HostedAuthConfig,
} from "./config";
import { hostedAccountMail } from "./mail";

export async function createHostedAuth(config: HostedAuthConfig) {
  assertHostedAuthConfig(config);
  if (process.env.BETTER_AUTH_SECRETS !== undefined)
    throw new HostedAuthError("configuration");
  // Revalidate concrete consumers before I/O, including the opaque DB registration.
  if (
    !hostedOrigin(config.origin) ||
    config.database.purpose !== "runtime" ||
    config.database.role !== "learli_app" ||
    config.secret.length < 32 ||
    config.ingressSecret.length < 32 ||
    (config.mail.mode === "resend-single-attempt" &&
      config.mail.transport.environment !== "staging")
  )
    throw new HostedAuthError("configuration");
  if (config.ingress.mode === "disabled")
    throw new HostedAuthError("unavailable");
  stagingPoolConfig(config.database);
  const database = await createHostedRuntimeDatabase(config.database);
  try {
    const composition = composeAccountAuth(database.db, {
      origin: config.origin,
      secret: config.secret,
      hosted: true,
      permitsEmail: (email) => config.accountEmails.includes(email),
      sendMail: hostedAccountMail(config),
    });
    return Object.freeze({
      ...composition,
      ...database,
      origin: config.origin,
      environment: "staging" as const,
      hosted: config,
    });
  } catch {
    await database.close();
    throw new HostedAuthError("unavailable");
  }
}
export type HostedAuthRuntime = Awaited<ReturnType<typeof createHostedAuth>>;
