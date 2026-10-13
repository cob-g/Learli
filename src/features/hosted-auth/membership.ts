import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";

/** Provider-owned lookup/verification only. Never consumes or rewrites a proof. */
export function hostedMembershipPlugin(
  permitsEmail: (email: string) => boolean,
  enabled = true,
) {
  const denied = () =>
    new APIError("FORBIDDEN", { message: "Account access is unavailable." });
  return {
    id: "learli-hosted-membership",
    hooks: {
      before: [
        {
          matcher: (ctx) =>
            enabled &&
            (ctx.path === "/get-session" ||
              ctx.path?.startsWith("/two-factor/") === true ||
              ctx.path === "/reset-password" ||
              ctx.path?.startsWith("/reset-password/") === true ||
              [
                "/list-sessions",
                "/revoke-session",
                "/revoke-other-sessions",
                "/change-password",
              ].includes(ctx.path ?? "")),
          handler: createAuthMiddleware(async (ctx) => {
            const current = await getSessionFromCtx(ctx, {
              disableCookieCache: true,
              disableRefresh: true,
            });
            if (current && !permitsEmail(current.user.email)) throw denied();
            let userId: string | undefined;
            if (!current && ctx.path?.startsWith("/two-factor/verify-")) {
              const cookie = ctx.context.createAuthCookie("two_factor");
              const pending = await ctx.getSignedCookie(
                cookie.name,
                ctx.context.secret,
              );
              const proof = pending
                ? await ctx.context.internalAdapter.findVerificationValue(
                    pending,
                  )
                : null;
              if (proof && proof.expiresAt > new Date()) userId = proof.value;
            }
            if (
              ctx.path === "/reset-password" ||
              ctx.path?.startsWith("/reset-password/")
            ) {
              const token: unknown =
                ctx.path === "/reset-password"
                  ? ctx.body?.token || ctx.query?.token
                  : ctx.params?.token;
              if (typeof token === "string") {
                const proof =
                  await ctx.context.internalAdapter.findVerificationValue(
                    `reset-password:${token}`,
                  );
                if (proof && proof.expiresAt > new Date()) userId = proof.value;
              }
            }
            if (userId) {
              const owner =
                await ctx.context.internalAdapter.findUserById(userId);
              if (!owner || !permitsEmail(owner.email)) throw denied();
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
