// Node-only provider composition; credentials stay wholly Better Auth-owned.
import { AsyncLocalStorage } from "node:async_hooks";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api";
import { twoFactor } from "better-auth/plugins/two-factor";
import type { BetterAuthPlugin } from "better-auth";
import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/connection";
import {
  ADMIN_FRESH_FACTOR_SECONDS,
  adminAssurancePredicate,
} from "./assurance";

export const adminTwoFactorOptions = {
  issuer: "Learli",
  allowPasswordless: false,
  skipVerificationOnEnable: false,
  twoFactorCookieMaxAge: 300,
  backupCodeOptions: { storeBackupCodes: "encrypted" as const },
};
export const adminTwoFactorPlugin = () => twoFactor(adminTwoFactorOptions);
const verificationPaths = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
]);
const changePaths = new Set([
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/generate-backup-codes",
]);
type Proof = {
  userId: string;
  epoch: number;
  factorId: string;
  roleGrantedAt: string;
};
type Scope = { proof?: Proof; ordinaryUserId?: string };
const unavailable = () =>
  new APIError("SERVICE_UNAVAILABLE", {
    message:
      "Administrator security could not be completed. Sign in and verify again.",
  });
const denied = () =>
  new APIError("FORBIDDEN", {
    message: "Administrator verification is required.",
  });

export function createAdminSecurityProvider(db: Database) {
  // The closure travels with the actual runtime, preserving binding across Next bundles.
  const scope = new AsyncLocalStorage<Scope>();
  const plugin = {
    id: "learli-admin-assurance",
    hooks: {
      before: [
        {
          matcher: (ctx) =>
            ctx.path?.startsWith("/two-factor/") === true ||
            ctx.path === "/sign-in/email",
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.path === "/sign-in/email") {
              const headers = new Headers(ctx.headers);
              headers.set(
                "cookie",
                (headers.get("cookie") ?? "")
                  .split(";")
                  .filter(
                    (value) =>
                      !value.split("=")[0].trim().endsWith(".trust_device"),
                  )
                  .join(";"),
              );
              return { context: { headers } };
            }
            const operation = scope.getStore();
            if (
              !operation ||
              (!verificationPaths.has(ctx.path) && !changePaths.has(ctx.path))
            )
              throw denied();
            if (
              ctx.body?.trustDevice ||
              ctx.body?.disableSession ||
              (ctx.body?.method && ctx.body.method !== "totp")
            )
              throw denied();
            try {
              const current = await getSessionFromCtx(ctx);
              let userId = current?.user.id;
              if (!userId && verificationPaths.has(ctx.path)) {
                const cookie = ctx.context.createAuthCookie("two_factor");
                const challenge = await ctx.getSignedCookie(
                  cookie.name,
                  ctx.context.secret,
                );
                const value = challenge
                  ? await ctx.context.internalAdapter.findVerificationValue(
                      challenge,
                    )
                  : null;
                if (value && value.expiresAt > new Date()) userId = value.value;
              }
              if (!userId) throw denied();
              const actor = await db.execute<{
                id: string;
                enabled: boolean;
                factorId: string | null;
                verified: boolean | null;
                roleGrantedAt: string | null;
              }>(sql`
              SELECT u.id, u.two_factor_enabled AS enabled, f.id AS "factorId", f.verified,
                r.granted_at::text AS "roleGrantedAt"
              FROM public."user" u JOIN public.user_access a ON a.user_id=u.id AND a.status='active'
              LEFT JOIN public.user_roles r ON r.user_id=u.id AND r.role='admin'
              LEFT JOIN public.two_factor f ON f.user_id=u.id
              WHERE u.id=${userId} AND u.email_verified
            `);
              const row = actor.rows[0];
              if (!row || actor.rows.length !== 1) throw denied();
              if (changePaths.has(ctx.path)) {
                if (!row.roleGrantedAt) throw denied();
                if (!current) throw denied();
                const active = await db.execute<{ valid: boolean }>(
                  sql`SELECT EXISTS(SELECT 1 FROM public.session WHERE id=${current.session.id} AND user_id=${userId} AND expires_at>clock_timestamp()) AS valid`,
                );
                if (!active.rows[0]?.valid) throw denied();
                // A verified factor can only be changed with fresh proof, including recovery proof.
                if (row.enabled || row.verified === true) {
                  const assurance = await db.execute<{ allowed: boolean }>(
                    sql`SELECT ${adminAssurancePredicate(userId, current.session.id, ADMIN_FRESH_FACTOR_SECONDS)} AS allowed`,
                  );
                  if (!assurance.rows[0]?.allowed) throw denied();
                } else if (ctx.path !== "/two-factor/enable") throw denied();
                // Provider validates the actual password too. Check it first so a bad
                // password cannot invalidate a legitimately assured administrator.
                if (
                  typeof ctx.body?.password !== "string" ||
                  !ctx.body.password
                )
                  throw denied();
                await ctx.context.password.checkPassword(userId, ctx);
                await db.transaction(async (tx) => {
                  await tx.execute(sql`INSERT INTO public.admin_security_epochs(user_id,epoch) VALUES(${userId},1)
                  ON CONFLICT(user_id) DO NOTHING`);
                  await tx.execute(
                    sql`SELECT epoch FROM public.admin_security_epochs WHERE user_id=${userId} FOR UPDATE`,
                  );
                  // A fresh READ COMMITTED statement after every epoch-row or
                  // uniqueness wait. Check proof while its epoch is still current;
                  // invalidating first would make genuine assurance uncheckable.
                  const authorized = await tx.execute<{ allowed: boolean }>(sql`
                    SELECT EXISTS(SELECT 1 FROM public.session s
                      JOIN public."user" u ON u.id=s.user_id AND u.email_verified
                      JOIN public.user_access a ON a.user_id=u.id AND a.status='active'
                      JOIN public.user_roles r ON r.user_id=u.id AND r.role='admin'
                      WHERE s.id=${current.session.id} AND s.user_id=${userId}
                        AND s.expires_at>clock_timestamp() AND r.granted_at::text=${row.roleGrantedAt}
                        AND ${
                          row.enabled || row.verified === true
                            ? adminAssurancePredicate(
                                userId,
                                current.session.id,
                                ADMIN_FRESH_FACTOR_SECONDS,
                              )
                            : sql`coalesce(u.two_factor_enabled,false)=false AND NOT EXISTS(SELECT 1 FROM public.two_factor f WHERE f.user_id=u.id AND f.verified=true)`
                        }
                    ) AS allowed`);
                  if (!authorized.rows[0]?.allowed) throw denied();
                  await tx.execute(
                    sql`UPDATE public.admin_security_epochs SET epoch=epoch+1 WHERE user_id=${userId}`,
                  );
                  await tx.execute(
                    sql`INSERT INTO public.admin_security_events(user_id,action) VALUES(${userId},'factor_change_started')`,
                  );
                });
              } else {
                if (
                  !row.factorId ||
                  (!current && (!row.enabled || row.verified !== true))
                )
                  throw denied();
                if (!row.roleGrantedAt) {
                  operation.ordinaryUserId = userId;
                  return;
                }
                const state = await db.execute<{ epoch: number }>(
                  sql`SELECT epoch FROM public.admin_security_epochs WHERE user_id=${userId}`,
                );
                if (!state.rows[0]) throw denied();
                operation.proof = {
                  userId,
                  factorId: row.factorId,
                  epoch: state.rows[0].epoch,
                  roleGrantedAt: row.roleGrantedAt,
                };
                if (current)
                  await db.execute(
                    sql`DELETE FROM public.admin_assurance_receipts WHERE session_id=${current.session.id} AND user_id=${userId}`,
                  );
              }
            } catch (error) {
              if (isAPIError(error)) throw error;
              throw unavailable();
            }
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => verificationPaths.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            if (isAPIError(ctx.context.returned)) return;
            const operation = scope.getStore();
            const proof = operation?.proof;
            const verified = ctx.context.newSession ?? ctx.context.session;
            if (
              operation?.ordinaryUserId &&
              verified?.user.id === operation.ordinaryUserId
            )
              return;
            if (!proof || !verified || verified.user.id !== proof.userId)
              throw denied();
            try {
              await db.transaction(async (tx) => {
                const receipt = await tx.execute(sql`
                INSERT INTO public.admin_assurance_receipts(session_id,user_id,factor_id,epoch,role_granted_at,verified_at,method)
                SELECT s.id,u.id,f.id,e.epoch,r.granted_at,clock_timestamp(),${ctx.path.endsWith("verify-totp") ? "totp" : "backup_code"}
                FROM public.session s JOIN public."user" u ON u.id=s.user_id
                JOIN public.user_access a ON a.user_id=u.id AND a.status='active'
                JOIN public.user_roles r ON r.user_id=u.id AND r.role='admin'
                JOIN public.admin_security_epochs e ON e.user_id=u.id
                JOIN public.two_factor f ON f.user_id=u.id AND f.verified=true
                WHERE s.id=${verified.session.id} AND u.id=${proof.userId}
                  AND s.expires_at>clock_timestamp() AND u.email_verified AND u.two_factor_enabled=true
                  AND e.epoch=${proof.epoch} AND f.id=${proof.factorId} AND r.granted_at::text=${proof.roleGrantedAt}
                ON CONFLICT(session_id) DO UPDATE SET factor_id=EXCLUDED.factor_id,epoch=EXCLUDED.epoch,
                  role_granted_at=EXCLUDED.role_granted_at,verified_at=EXCLUDED.verified_at,method=EXCLUDED.method
                RETURNING session_id`);
                if (receipt.rowCount !== 1) throw denied();
                await tx.execute(
                  sql`INSERT INTO public.admin_security_events(user_id,action) VALUES(${proof.userId},'factor_verified')`,
                );
              });
            } catch (error) {
              // A session may already exist. No receipt/audit transaction commits on
              // failure, and every admin boundary independently requires its receipt.
              if (isAPIError(error)) throw error;
              throw unavailable();
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;

  async function run<T>(operation: () => Promise<T>): Promise<T> {
    // Nonblocking and globally bounded because one wrapper connection plus the
    // provider's own transactions share the small runtime pool. Finally releases
    // even unknown provider exceptions, unlike a hook-held connection.
    return db.transaction(async (tx) => {
      const result = await tx.execute<{ acquired: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(41005,0) AS acquired`,
      );
      if (!result.rows[0]?.acquired)
        throw new APIError("CONFLICT", {
          message: "Administrator security is busy. Try again shortly.",
        });
      return scope.run({}, operation);
    });
  }
  return { plugin, run };
}
