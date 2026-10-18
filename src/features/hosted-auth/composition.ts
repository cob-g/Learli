// Node-only factory shared by runtime and real-database tests/local fixtures.
import { betterAuth } from "better-auth";
import { APIError, isAPIError } from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth-options";
import type { Database } from "@/lib/db/connection";
import type { LocalMessage } from "@/lib/email/local-mail";
import { createMailAttemptBoundary } from "./mail-attempt";
import { accountAdapter } from "./account-adapter";
import { hostedMembershipPlugin } from "./membership";
import * as schema from "@/lib/db/schema";
import { createEmailProofBinding } from "@/features/account-email/proof-context";
import {
  adminTwoFactorPlugin,
  createAdminSecurityProvider,
} from "@/features/admin-security/provider";

export type AccountMail = LocalMessage;
export function composeAccountAuth(
  db: Database,
  configuration: {
    origin: string;
    secret: string;
    hosted: boolean;
    permitsEmail(email: string): boolean;
    sendMail(mail: AccountMail): Promise<void>;
  },
) {
  const emailProofBinding = createEmailProofBinding();
  const adminSecurity = createAdminSecurityProvider(db);
  const mailAttempt = createMailAttemptBoundary(configuration.sendMail);
  const auth = betterAuth({
    ...authOptions,
    ...(configuration.hosted
      ? {
          advanced: {
            ...authOptions.advanced,
            useSecureCookies: true,
            trustedProxyHeaders: false,
            defaultCookieAttributes: {
              secure: true,
              httpOnly: true,
              sameSite: "lax" as const,
              path: "/",
            },
            crossSubDomainCookies: { enabled: false },
            ipAddress: { ipAddressHeaders: ["x-learli-client-ip"] },
          },
        }
      : {}),
    baseURL: configuration.origin,
    secret: configuration.secret,
    trustedOrigins: [configuration.origin],
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
    database: accountAdapter(db),
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
                  configuration.secret,
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
      // The same runtime address policy protects existing proofs and sessions too.
      hostedMembershipPlugin(configuration.permitsEmail),
      adminTwoFactorPlugin(),
      adminSecurity.plugin,
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
          await mailAttempt.send({
            kind:
              type === "change-email"
                ? "email-change-new"
                : "email-change-current",
            to: email,
            url: `${configuration.origin}/account/email`,
            otp,
          });
        },
      }),
    ],
    emailVerification: {
      ...authOptions.emailVerification,
      beforeEmailVerification: async (user: { email: string }) => {
        if (!configuration.permitsEmail(user.email))
          throw new APIError("FORBIDDEN", {
            message: "Account access is unavailable.",
          });
      },
      sendVerificationEmail: async ({ user, url }) =>
        mailAttempt.send({
          kind: "verification",
          to: user.email,
          url,
        }),
    },
    emailAndPassword: {
      ...authOptions.emailAndPassword,
      sendResetPassword: async ({ user, url }) =>
        mailAttempt.send({ kind: "reset", to: user.email, url }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (
              !configuration.permitsEmail(user.email) ||
              !user.name.trim() ||
              user.name.length > 100
            ) {
              throw new APIError("BAD_REQUEST", {
                message:
                  "Use an allowed email address and a short display name.",
              });
            }
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
            const [account] = await db
              .select({ email: schema.user.email })
              .from(schema.user)
              .where(eq(schema.user.id, session.userId));
            if (
              access?.status !== "active" ||
              !account ||
              !configuration.permitsEmail(account.email)
            )
              throw new APIError("FORBIDDEN", {
                message: "Sign-in could not be completed.",
              });
          },
        },
      },
    },
  });
  return { auth, emailProofBinding, adminSecurity, mailAttempt };
}
