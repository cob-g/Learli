import type { BetterAuthOptions } from "better-auth";

/** Shared by runtime and the provider's schema generator. No credentials here. */
export const authOptions = {
  appName: "Learli",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 1800,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    expiresIn: 3600,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  user: {
    additionalFields: {
      timezone: {
        type: "string",
        required: true,
        defaultValue: "UTC",
        input: false,
      },
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 10 },
      "/request-password-reset": { window: 60, max: 5 },
      "/send-verification-email": { window: 60, max: 5 },
    },
  },
  advanced: {
    // Better Auth otherwise defaults origin checks off under NODE_ENV=test.
    disableOriginCheck: false,
    disableCSRFCheck: false,
    ipAddress: { ipAddressHeaders: ["x-learli-local-ip"] },
  },
  logger: { disabled: true },
} satisfies BetterAuthOptions;
