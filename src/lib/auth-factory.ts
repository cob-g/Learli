// Preserve native local Pool inference for fixtures and local domain consumers.
import { createDatabase } from "./db/connection";
import { captureLocalMail } from "./email/local-mail";
import { syntheticEmail } from "./local-mode";
import { parseServerEnv } from "./env/schema";
import { composeAccountAuth } from "@/features/hosted-auth/composition";
import type { NeonDevelopmentAuthRuntime } from "./db/neon-development";
import type { HostedAuthRuntime } from "@/features/hosted-auth/factory";

export function createLocalAuth(source: Record<string, string | undefined>) {
  const env = parseServerEnv(source);
  if (
    env.AUTH_MODE !== "local" ||
    env.DATABASE_MODE !== "local" ||
    !env.DATABASE_URL ||
    !env.BETTER_AUTH_SECRET ||
    (env.APP_ENV !== "development" && env.APP_ENV !== "test")
  )
    throw new Error("Local authentication is unavailable.");
  const environment = env.APP_ENV;
  const { db, pool } = createDatabase(env.DATABASE_URL, environment === "test");
  const composition = composeAccountAuth(db, {
    origin: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    hosted: false,
    permitsEmail: syntheticEmail,
    sendMail: (mail) => captureLocalMail(environment, mail),
  });
  return { ...composition, db, pool, origin: env.APP_URL, environment };
}
export type LocalAuthRuntime = ReturnType<typeof createLocalAuth>;
export type DevelopmentAuthRuntime =
  LocalAuthRuntime | NeonDevelopmentAuthRuntime;
export type AuthRuntime = DevelopmentAuthRuntime | HostedAuthRuntime;
