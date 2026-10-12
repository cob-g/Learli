// Node-only factory shared by runtime and real-database tests/local fixtures.
import { betterAuth } from "better-auth";
import { APIError, isAPIError } from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { authOptions } from "./auth-options";
import { createDatabase } from "./db/connection";
import * as schema from "./db/schema";
import { captureLocalMail } from "./email/local-mail";
import { syntheticEmail } from "./local-mode";
import { parseServerEnv } from "./env/schema";
import { createEmailProofBinding } from "@/features/account-email/proof-context";

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
  const emailProofBinding = createEmailProofBinding();
  const auth = betterAuth({
    ...authOptions,
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    onAPIError: {
      // Better Call logs unknown errors even when Better Auth logging is disabled.
      // Its synchronous hook catch converts this fresh APIError without raw params.
      onError(error) {
        if (!isAPIError(error))
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Account service is unavailable.",
          });
      },
    },
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    verification: {
      storeIdentifier: {
        default: "plain",
        overrides: Object.fromEntries(
          ["email-verification-otp-", "change-email-otp-"].map((prefix) => [
            prefix,
            {
              hash: (identifier: string) =>
                emailProofBinding.identifier(
                  identifier,
                  env.BETTER_AUTH_SECRET!,
                  async (plain) => {
                    const rows = await db
                      .select({ id: schema.verification.id })
                      .from(schema.verification)
                      .where(eq(schema.verification.identifier, plain))
                      .limit(1);
                    return rows.length > 0;
                  },
                ),
            },
          ]),
        ),
      },
    },
    plugins: [
      emailOTP({
        changeEmail: { enabled: true, verifyCurrentEmail: true },
        storeOTP: "hashed",
        expiresIn: 300,
        allowedAttempts: 3,
        disableSignUp: true,
        overrideDefaultEmailVerification: false,
        sendVerificationOnSignUp: false,
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "email-verification" && type !== "change-email")
            throw new Error("Local email confirmation is unavailable.");
          await captureLocalMail(environment, {
            kind:
              type === "change-email"
                ? "email-change-new"
                : "email-change-current",
            to: email,
            url: `${env.APP_URL}/account/email`,
            otp,
          });
        },
      }),
    ],
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
  return {
    auth,
    db,
    pool,
    origin: env.APP_URL,
    environment,
    emailProofBinding,
  };
}
export type AuthRuntime = ReturnType<typeof createLocalAuth>;
