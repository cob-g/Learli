// Preserve native local Pool inference for fixtures and local domain consumers.
import { createDatabase } from "./db/connection";
import { captureLocalMail, captureOperationalMail } from "./email/local-mail";
import { syntheticEmail } from "./local-mode";
import { parseServerEnv } from "./env/schema";
import { composeAccountAuth } from "@/features/hosted-auth/composition";
import type { NeonDevelopmentAuthRuntime } from "./db/neon-development";
import type { HostedAuthRuntime } from "@/features/hosted-auth/factory";
import {
  validateLocalWorkflowBinding,
  type LocalWorkflow,
} from "@/features/local-workflow/runtime";
import { mailboxSchema } from "./email/mailbox";

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
  const localWorkflow = validateLocalWorkflowBinding(source, pool);
  const composition = composeAccountAuth(db, {
    origin: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    hosted: false,
    permitsEmail: localWorkflow
      ? (email) => mailboxSchema.safeParse(email).success
      : syntheticEmail,
    sendMail: (mail) =>
      localWorkflow
        ? captureOperationalMail(localWorkflow, mail)
        : captureLocalMail(environment, mail),
  });
  return {
    ...composition,
    db,
    pool,
    origin: env.APP_URL,
    environment,
    localWorkflow,
  };
}
export type LocalAuthRuntime = Omit<
  ReturnType<typeof createLocalAuth>,
  "localWorkflow"
> & {
  readonly localWorkflow?: LocalWorkflow | null;
};
export type DevelopmentAuthRuntime =
  LocalAuthRuntime | NeonDevelopmentAuthRuntime;
export type AuthRuntime = DevelopmentAuthRuntime | HostedAuthRuntime;
