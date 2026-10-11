// Node-only factory shared by runtime and real-database tests/local fixtures.
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { authOptions } from "./auth-options";
import { createDatabase } from "./db/connection";
import * as schema from "./db/schema";
import { captureLocalMail } from "./email/local-mail";
import { syntheticEmail } from "./local-mode";
import { parseServerEnv } from "./env/schema";

export function createLocalAuth(source: Record<string, string | undefined>) {
  const env = parseServerEnv(source);
  if (
    env.AUTH_MODE !== "local" ||
    !env.DATABASE_URL ||
    !env.BETTER_AUTH_SECRET ||
    (env.APP_ENV !== "development" && env.APP_ENV !== "test")
  )
    throw new Error("Local authentication is unavailable.");
  const environment = env.APP_ENV;
  const { db, pool } = createDatabase(env.DATABASE_URL, environment === "test");
  const auth = betterAuth({
    ...authOptions,
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    emailVerification: {
      ...authOptions.emailVerification,
      sendVerificationEmail: async ({ user, url }) =>
        captureLocalMail(environment, {
          kind: "verification",
          to: user.email,
          url,
        }),
    },
    emailAndPassword: {
      ...authOptions.emailAndPassword,
      sendResetPassword: async ({ user, url }) =>
        captureLocalMail(environment, { kind: "reset", to: user.email, url }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (
              !syntheticEmail(user.email) ||
              !user.name.trim() ||
              user.name.length > 100
            ) {
              throw new APIError("BAD_REQUEST", {
                message:
                  "Use a synthetic .test account with a short display name.",
              });
            }
          },
          after: async (user) => {
            await db.transaction(async (tx) => {
              await tx.insert(schema.userAccess).values({ userId: user.id });
              await tx.insert(schema.auditEvents).values({
                actorUserId: user.id,
                targetUserId: user.id,
                action: "account.created",
              });
            });
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const [access] = await db
              .select()
              .from(schema.userAccess)
              .where(eq(schema.userAccess.userId, session.userId));
            if (access?.status !== "active")
              throw new APIError("FORBIDDEN", {
                message: "Sign-in could not be completed.",
              });
          },
        },
      },
    },
  });
  return { auth, db, pool, origin: env.APP_URL, environment };
}
export type AuthRuntime = ReturnType<typeof createLocalAuth>;
