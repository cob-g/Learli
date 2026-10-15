import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  composeAccountAuth,
  type AccountMail,
} from "@/features/hosted-auth/composition";
import { createDatabase } from "@/lib/db/connection";
import { requireAdminAssurance } from "@/features/admin-security/assurance";
import { assertOwnedReadinessDatabase } from "../support/readiness-placement";
import { mergeCookies, totpCode } from "../support/admin-mfa";

let owner: ReturnType<typeof createDatabase>;
let database: ReturnType<typeof createDatabase>;
const emails: string[] = [];
const password = "Synthetic-signup-atomicity-passphrase-123";
let schemaGuards: string;
async function guardFingerprint() {
  const {
    rows: [row],
  } = await owner.pool.query<{ fingerprint: string }>(`
    SELECT md5(string_agg(pg_get_triggerdef(oid), E'\\n' ORDER BY oid)) AS fingerprint
    FROM pg_trigger WHERE NOT tgisinternal`);
  return row.fingerprint;
}

beforeAll(async () => {
  assertOwnedReadinessDatabase(process.cwd());
  owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
  database = createDatabase(process.env.DATABASE_URL ?? "", true);
  for (const [connection, role] of [
    [owner, "learli_owner"],
    [database, "learli_app"],
  ] as const) {
    const {
      rows: [actual],
    } = await connection.pool.query<{
      database: string;
      role: string;
      port: number;
    }>(
      "SELECT current_database() AS database, current_user AS role, inet_server_port() AS port",
    );
    expect(actual).toMatchObject({ database: "learli_test", role });
    expect(actual.port).toBe(
      new URL(process.env.DATABASE_URL!).port === ""
        ? 5432
        : Number(new URL(process.env.DATABASE_URL!).port),
    );
  }
  schemaGuards = await guardFingerprint();
});

afterAll(async () => {
  try {
    expect(await guardFingerprint()).toBe(schemaGuards);
    // Only identities made by this invocation; no shared-suite resets/history edits.
    await owner?.pool.query(
      'DELETE FROM public."user" WHERE email = ANY($1::text[])',
      [emails],
    );
  } finally {
    await database?.pool.end();
    await owner?.pool.end();
  }
});

function syntheticAccount(hosted: boolean) {
  const email = `signup-${randomUUID()}@learli.test`;
  emails.push(email);
  const messages: AccountMail[] = [];
  const origin = hosted ? "https://signup.learli.test" : process.env.APP_URL!;
  const ip = [127, ...randomBytes(3)].join(".");
  const allowed = new Set([email]);
  let mailFails = false;
  const composition = composeAccountAuth(database.db, {
    origin,
    secret: process.env.BETTER_AUTH_SECRET!,
    hosted,
    permitsEmail: (candidate) => allowed.has(candidate),
    async sendMail(mail) {
      if (mailFails) throw new Error("Synthetic transport failure");
      messages.push(mail);
    },
  });
  const runtime = {
    ...composition,
    ...database,
    origin,
    environment: "test" as const,
  };
  function request(route: string, body?: unknown, cookie?: string) {
    return new Request(`${origin}/api/auth/${route}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-learli-local-ip": ip,
        "x-learli-client-ip": ip,
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  return {
    ...runtime,
    email,
    messages,
    allowed,
    failMail: () => {
      mailFails = true;
    },
    call: (route: string, body?: unknown, cookie?: string) =>
      composition.auth.handler(request(route, body, cookie)),
    // Same request-scoped MFA boundary as handleAuthRequest, with this test's
    // own client bucket. No shared rate-limit rows are reset or bypassed.
    mfa: (route: string, body: unknown, cookie: string) =>
      composition.adminSecurity.run(() =>
        composition.auth.handler(request(`two-factor/${route}`, body, cookie)),
      ),
    signup: () =>
      composition.auth.handler(
        request("sign-up/email", {
          email,
          name: "Synthetic signup",
          password,
          callbackURL: "/account",
        }),
      ),
  };
}

async function verifiedSession(account: ReturnType<typeof syntheticAccount>) {
  expect((await account.signup()).status).toBe(200);
  const verification = account.messages.find(
    (mail) => mail.kind === "verification",
  );
  if (!verification) throw new Error("Synthetic verification missing");
  expect([200, 302]).toContain(
    (await account.auth.handler(new Request(verification.url))).status,
  );
  const login = await account.call("sign-in/email", {
    email: account.email,
    password,
  });
  expect(login.status).toBe(200);
  return login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}

async function state(email: string) {
  const {
    rows: [counts],
  } = await owner.pool.query<{
    users: number;
    credentials: number;
    access: number;
    audits: number;
    roles: number;
  }>(
    `SELECT
    (SELECT count(*)::int FROM public."user" WHERE email=$1) AS users,
    (SELECT count(*)::int FROM public.account a JOIN public."user" u ON u.id=a.user_id WHERE u.email=$1 AND a.provider_id='credential') AS credentials,
    (SELECT count(*)::int FROM public.user_access a JOIN public."user" u ON u.id=a.user_id WHERE u.email=$1 AND a.status='active') AS access,
    (SELECT count(*)::int FROM public.audit_events a JOIN public."user" u ON u.id=a.target_user_id WHERE u.email=$1 AND a.actor_user_id=u.id AND a.action='account.created') AS audits,
    (SELECT count(*)::int FROM public.user_roles r JOIN public."user" u ON u.id=r.user_id WHERE u.email=$1) AS roles`,
    [email],
  );
  return counts;
}

const empty = { users: 0, credentials: 0, access: 0, audits: 0, roles: 0 };
const complete = { users: 1, credentials: 1, access: 1, audits: 1, roles: 0 };

async function withFailure(
  email: string,
  table: "user_access" | "audit_events" | "account",
  operation: () => Promise<void>,
) {
  // Identifier/email are generated here, never request input. The trigger affects
  // only this synthetic identity, and never replaces/disables a schema guard.
  if (!/^signup-[a-f0-9-]+@learli\.test$/.test(email))
    throw new Error("Synthetic identity required");
  const name = `signup_atomicity_${randomUUID().replaceAll("-", "")}`;
  const column = table === "audit_events" ? "target_user_id" : "user_id";
  await owner.pool
    .query(`CREATE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM public."user" WHERE id=NEW.${column} AND email='${email}') THEN
        RAISE EXCEPTION 'Synthetic signup insert failure' USING ERRCODE='23514';
      END IF;
      RETURN NEW;
    END; $$`);
  try {
    await owner.pool.query(
      `CREATE TRIGGER ${name} BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.${name}()`,
    );
    await operation();
  } finally {
    await owner.pool.query(`DROP TRIGGER IF EXISTS ${name} ON public.${table}`);
    await owner.pool.query(`DROP FUNCTION public.${name}()`);
  }
}

describe.each([false, true])(
  "atomic signup, hosted composition=%s",
  (hosted) => {
    it("rolls back standalone provider user creation when required audit insertion fails", async () => {
      const account = syntheticAccount(hosted);
      const context = await account.auth.$context;
      await withFailure(account.email, "audit_events", async () => {
        await expect(
          context.internalAdapter.createUser(
            {
              email: account.email,
              name: "Synthetic standalone",
              emailVerified: false,
            },
            { method: "email-password" },
          ),
        ).rejects.toBeDefined();
        expect(await state(account.email)).toEqual(empty);
      });
      await context.internalAdapter.createUser(
        {
          email: account.email,
          name: "Synthetic standalone",
          emailVerified: false,
        },
        { method: "email-password" },
      );
      expect(await state(account.email)).toEqual({
        ...complete,
        credentials: 0,
      });
    });

    it.each([false, true])(
      "preserves selected create output without id, in transaction=%s",
      async (transactional) => {
        const account = syntheticAccount(hosted);
        const { adapter } = await account.auth.$context;
        const input = {
          model: "user",
          data: {
            email: account.email,
            name: "Synthetic selected",
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          select: ["email"],
        };
        const result: unknown = transactional
          ? await adapter.transaction((tx) => tx.create(input))
          : await adapter.create(input);
        expect(result).toEqual({ email: account.email });
        expect(await state(account.email)).toEqual({
          ...complete,
          credentials: 0,
        });
      },
    );

    it("rolls back provisioning when the supported transaction callback later fails", async () => {
      const account = syntheticAccount(hosted);
      const { adapter } = await account.auth.$context;
      await expect(
        adapter.transaction(async (tx) => {
          const created = await tx.create<
            Record<string, unknown>,
            { id: string }
          >({
            model: "user",
            data: {
              email: account.email,
              name: "Synthetic transaction",
              emailVerified: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          await tx.create({
            model: "account",
            data: {
              userId: created.id,
              providerId: "credential",
              accountId: created.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          throw new Error("Synthetic transaction callback failure");
        }),
      ).rejects.toThrow("Synthetic transaction callback failure");
      expect(await state(account.email)).toEqual(empty);
    });

    it.each(["user_access", "audit_events", "account"] as const)(
      "rolls back all required records on %s failure and permits a clean retry",
      async (table) => {
        const account = syntheticAccount(hosted);
        await withFailure(account.email, table, async () => {
          const response = await account.signup();
          expect(response.ok).toBe(false);
          expect(await response.text()).not.toMatch(
            /Synthetic signup insert failure|23514|insert into|password|signup_atomicity_/i,
          );
          // Soft assertions retain the original partial-commit + blocked-retry evidence.
          expect.soft(await state(account.email)).toEqual(empty);
          const retry = await account.signup();
          expect.soft(retry.ok).toBe(false);
          expect.soft(await state(account.email)).toEqual(empty);
        });
        const retry = await account.signup();
        expect(retry.status).toBe(200);
        expect(await state(account.email)).toEqual(complete);
      },
    );

    it("preserves roleless signup, verification, login and enumeration-safe duplicate responses", async () => {
      const account = syntheticAccount(hosted);
      const signup = await account.signup();
      expect(signup.status).toBe(200);
      const initial: unknown = await signup.json();
      expect(initial).toMatchObject({
        token: null,
        user: { email: account.email, emailVerified: false },
      });
      expect(await state(account.email)).toEqual(complete);
      expect(
        (
          await account.call("sign-in/email", {
            email: account.email,
            password,
          })
        ).status,
      ).toBe(403);
      const verification = account.messages.find(
        (mail) => mail.kind === "verification",
      );
      if (!verification) throw new Error("Synthetic verification missing");
      expect([200, 302]).toContain(
        (await account.auth.handler(new Request(verification.url))).status,
      );
      const login = await account.call("sign-in/email", {
        email: account.email,
        password,
      });
      expect(login.status).toBe(200);
      const cookie = login.headers
        .getSetCookie()
        .find((value) => value.includes("session_token"));
      expect(cookie).toContain("HttpOnly");
      expect(cookie?.includes("Secure")).toBe(hosted);
      const duplicate = await account.signup();
      expect(duplicate.status).toBe(200);
      expect(await duplicate.json()).toMatchObject({
        token: null,
        user: { email: account.email, emailVerified: false },
      });
      expect(await state(account.email)).toEqual(complete);
    });

    it("preserves single-use password reset, session revocation and subsequent login", async () => {
      const account = syntheticAccount(hosted);
      const cookie = await verifiedSession(account);
      expect(
        (
          await account.call("request-password-reset", {
            email: account.email,
            redirectTo: "/reset-password",
          })
        ).status,
      ).toBe(200);
      const reset = account.messages.find((mail) => mail.kind === "reset");
      if (!reset) throw new Error("Synthetic reset missing");
      const redirect = await account.auth.handler(new Request(reset.url));
      const location = redirect.headers.get("location");
      if (!location) throw new Error("Synthetic reset callback missing");
      const token = new URL(location, account.origin).searchParams.get("token");
      const newPassword = "Synthetic-signup-new-passphrase-456";
      expect(
        (await account.call("reset-password", { token, newPassword })).status,
      ).toBe(200);
      expect(
        (await account.call("reset-password", { token, newPassword })).status,
      ).toBe(400);
      expect(
        await account.auth.api.getSession({ headers: new Headers({ cookie }) }),
      ).toBeNull();
      expect(
        (
          await account.call("sign-in/email", {
            email: account.email,
            password,
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await account.call("sign-in/email", {
            email: account.email,
            password: newPassword,
          })
        ).status,
      ).toBe(200);
      expect(await state(account.email)).toEqual(complete);
    });

    it("preserves provider current/new email proof and other-session revocation", async () => {
      const account = syntheticAccount(hosted);
      const cookie = await verifiedSession(account);
      const other = await account.call("sign-in/email", {
        email: account.email,
        password,
      });
      const otherCookie = mergeCookies("", other);
      const newEmail = `signup-${randomUUID()}@learli.test`;
      emails.push(newEmail);
      account.allowed.add(newEmail);
      const session = await account.auth.api.getSession({
        headers: new Headers({ cookie }),
      });
      if (!session) throw new Error("Synthetic current session missing");
      const change = (route: string, body: unknown, changing = false) =>
        account.emailProofBinding.withContext(
          {
            userId: session.user.id,
            sessionId: session.session.id,
            currentEmail: account.email,
            newEmail: changing ? newEmail : undefined,
          },
          () => account.call(route, body, cookie),
        );
      expect(
        (
          await change("email-otp/send-verification-otp", {
            email: account.email,
            type: "email-verification",
          })
        ).status,
      ).toBe(200);
      const current = account.messages.find(
        (mail) => mail.kind === "email-change-current",
      );
      if (!current || !("otp" in current))
        throw new Error("Synthetic current-email proof missing");
      expect(
        (
          await change(
            "email-otp/request-email-change",
            { newEmail, otp: current.otp },
            true,
          )
        ).status,
      ).toBe(200);
      const proposed = account.messages.find(
        (mail) => mail.kind === "email-change-new",
      );
      if (!proposed || !("otp" in proposed))
        throw new Error("Synthetic new-email proof missing");
      expect(
        (
          await change(
            "email-otp/change-email",
            { newEmail, otp: proposed.otp },
            true,
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await account.auth.api.getSession({
            headers: new Headers({ cookie }),
          })
        )?.user.email,
      ).toBe(newEmail);
      expect(
        (await account.call("revoke-other-sessions", {}, cookie)).status,
      ).toBe(200);
      expect(
        await account.auth.api.getSession({
          headers: new Headers({ cookie: otherCookie }),
        }),
      ).toBeNull();
      expect(await state(newEmail)).toEqual(complete);
    });

    it("preserves provider MFA enrollment, pending sign-in and assured-session promotion", async () => {
      const account = syntheticAccount(hosted);
      let cookie = await verifiedSession(account);
      const current = await account.auth.api.getSession({
        headers: new Headers({ cookie }),
      });
      if (!current) throw new Error("Synthetic current session missing");
      await owner.pool.query(
        "INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')",
        [current.user.id],
      );
      const enabled = await account.mfa("enable", { password }, cookie);
      expect(enabled.status).toBe(200);
      const setup: unknown = await enabled.json();
      if (
        !setup ||
        typeof setup !== "object" ||
        !("totpURI" in setup) ||
        typeof setup.totpURI !== "string"
      )
        throw new Error("Synthetic MFA setup missing");
      const secret = new URL(setup.totpURI).searchParams.get("secret");
      if (!secret) throw new Error("Synthetic MFA secret missing");
      cookie = mergeCookies(cookie, enabled);
      const verified = await account.mfa(
        "verify-totp",
        { code: totpCode(secret) },
        cookie,
      );
      expect(verified.status).toBe(200);
      cookie = mergeCookies(cookie, verified);
      await requireAdminAssurance(account, new Headers({ cookie }));
      expect((await account.call("sign-out", {}, cookie)).status).toBe(200);
      const pending = await account.call("sign-in/email", {
        email: account.email,
        password,
      });
      expect(pending.status).toBe(200);
      expect(await pending.json()).toMatchObject({ twoFactorRedirect: true });
      cookie = mergeCookies("", pending);
      expect(
        await account.auth.api.getSession({ headers: new Headers({ cookie }) }),
      ).toBeNull();
      const challenge = await account.mfa(
        "verify-totp",
        { code: totpCode(secret) },
        cookie,
      );
      expect(challenge.status).toBe(200);
      cookie = mergeCookies(cookie, challenge);
      await requireAdminAssurance(account, new Headers({ cookie }));
    });

    it("refuses nonmember signup before creating any required records", async () => {
      const account = syntheticAccount(hosted);
      account.allowed.clear();
      expect((await account.signup()).ok).toBe(false);
      expect(await state(account.email)).toEqual(empty);
    });

    it("keeps a complete committed identity when optional verification transport fails", async () => {
      const account = syntheticAccount(hosted);
      account.failMail();
      await account.signup();
      expect(await state(account.email)).toEqual(complete);
      expect(
        (
          await account.call("sign-in/email", {
            email: account.email,
            password,
          })
        ).status,
      ).toBe(403);
    });
  },
);
