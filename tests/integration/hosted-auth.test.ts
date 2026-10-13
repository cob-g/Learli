import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PoolConfig } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { isAPIError } from "better-auth/api";
vi.mock("server-only", () => ({}));
const fixture = vi.hoisted(() => ({
  settings: undefined as ((role: "learli_app") => PoolConfig) | undefined,
}));
vi.mock("@/lib/db/staging-config", async (original) => {
  const real = await original<typeof import("@/lib/db/staging-config")>();
  return {
    ...real,
    stagingPoolConfig: (
      config: import("@/lib/db/staging-config").StagingDatabaseConfig,
    ) => {
      real.stagingPoolConfig(config);
      if (!fixture.settings) throw new Error("Owned settings missing");
      return fixture.settings("learli_app");
    },
  };
});
import { parseHostedAuthConfig } from "@/features/hosted-auth/config";
import { handleAuthRequest } from "@/lib/auth-handler";
import { handleAccountRequest } from "@/features/account/handler";
import { handleAccountPassword } from "@/features/account-password/handler";
import { handleAccountEmail } from "@/features/account-email/handler";
import { handleAccountSessions } from "@/features/account-sessions/handler";
import { createSyntheticHostedProvider } from "../support/hosted-auth-provider";
import {
  createHostedAuthDatabase,
  grantHostedTestAdmin,
  hostedSyntheticPassword,
} from "../support/hosted-auth-runtime";
import {
  hostedTestPacket,
  hostedTestSource,
  hostedTestOrigin,
} from "../support/hosted-auth-packet";
import { totpCode } from "../support/admin-mfa";

let database: Awaited<ReturnType<typeof createHostedAuthDatabase>>;
let runtime: Awaited<ReturnType<typeof createSyntheticHostedProvider>>;
let directory: string;
let unusedAdminRecovery: string;
let adminSecret: string;
const password = hostedSyntheticPassword();
const cookies = new Map<string, string>();
function absorb(response: Response, jar = cookies) {
  for (const cookie of response.headers.getSetCookie()) {
    const field = cookie.split(";")[0],
      index = field.indexOf("=");
    jar.set(field.slice(0, index), field.slice(index + 1));
  }
}
function request(
  route: string,
  body?: unknown,
  jar = cookies,
  extra?: Record<string, string>,
) {
  return new Request(`${hostedTestOrigin}${route}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      host: "accounts.learli.test",
      origin: hostedTestOrigin,
      "content-type": "application/json",
      "x-learli-ingress-token": runtime.hosted.ingressSecret,
      "x-learli-ingress-host": "accounts.learli.test",
      "x-learli-ingress-proto": "https",
      "x-learli-client-ip": "0.0.0.0",
      cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; "),
      ...extra,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function auth(
  route: string,
  body?: unknown,
  jar = cookies,
  extra?: Record<string, string>,
) {
  const response = await handleAuthRequest(
    runtime,
    request(`/api/auth/${route}`, body, jar, extra),
  );
  absorb(response, jar);
  return response;
}
function capture(email: string, subject: string) {
  const records = readdirSync(directory)
    .filter((f) => f !== "response.json")
    .sort()
    .map(
      (f) =>
        JSON.parse(readFileSync(path.join(directory, f), "utf8")) as {
          body: { to: string[]; subject: string; text: string };
        },
    );
  const found = records
    .filter((v) => v.body.to[0] === email && v.body.subject === subject)
    .at(-1);
  if (!found) throw new Error("Synthetic SDK capture missing.");
  return found.body.text;
}
function link(email: string, subject: string) {
  const text = capture(email, subject);
  const found = text
    .split("\n")
    .find((v) => v.startsWith(`${hostedTestOrigin}/api/auth/`));
  if (!found) throw new Error("Proof link missing");
  return new URL(found);
}
function code(email: string, subject: string) {
  const found = /code in your signed-in account: (\d{6})/.exec(
    capture(email, subject),
  );
  if (!found) throw new Error("Code missing");
  return found[1];
}
async function register(email: string) {
  expect(
    (
      await auth("sign-up/email", {
        email,
        name: "Synthetic hosted owner",
        password,
        callbackURL: "/sign-in?verified=1&next=%2Faccount",
      })
    ).status,
  ).toBe(200);
  const url = link(email, "Verify your Learli email");
  expect(
    (await handleAuthRequest(runtime, request(`${url.pathname}${url.search}`)))
      .status,
  ).toBe(302);
}
beforeAll(async () => {
  database = await createHostedAuthDatabase();
  fixture.settings = database.harness.settings;
  directory = path.join(database.harness.directory, "sdk-account-capture");
  runtime = await createSyntheticHostedProvider(
    parseHostedAuthConfig(hostedTestSource(), hostedTestPacket()),
    directory,
  );
}, 90000);
afterAll(async () => {
  await runtime?.close();
  await database?.close();
});
describe("real guarded TLS PostgreSQL hosted provider and account controls", () => {
  it("registers only selected synthetic membership, assigns no roles, requires verification and secure host-only cookies", async () => {
    expect(
      (
        await auth("sign-up/email", {
          email: "unlisted@example.test",
          name: "Synthetic",
          password,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await auth("sign-up/email", {
          email: "person@gmail.com",
          name: "Synthetic",
          password,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await auth("sign-up/email", {
          email: "hosted@example.test",
          name: "Synthetic",
          password,
          role: "admin",
        })
      ).status,
    ).toBe(400);
    await register("hosted@example.test");
    expect(
      (await database.owner.query("SELECT count(*) FROM user_roles")).rows[0]
        .count,
    ).toBe("0");
    const response = await auth("sign-in/email", {
      email: "hosted@example.test",
      password,
    });
    expect(response.status).toBe(200);
    const actual = response.headers.getSetCookie();
    expect(actual.length).toBeGreaterThan(0);
    for (const cookie of actual) {
      expect(cookie).toMatch(/; Secure/i);
      expect(cookie).toMatch(/; HttpOnly/i);
      expect(cookie).toMatch(/; SameSite=Lax/i);
      expect(cookie).not.toMatch(/; Domain=/i);
    }
    expect(response.headers.get("cache-control")).toContain("no-store");
    const identity = (await runtime.auth.api.getSession({
      headers: request("/").headers,
    }))!;
    expect(
      (
        await handleAccountRequest(
          runtime,
          request("/api/account/foreign"),
          "foreign",
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await handleAccountRequest(
          runtime,
          request(`/api/account/${identity.user.id}`),
          identity.user.id,
        )
      ).status,
    ).toBe(200);
  });
  it("requires exact ingress/Host/Origin and safe callbacks while forwarded spoofing cannot change the rate identity", async () => {
    const refusedHeaders: Record<string, string>[] = [
      { "x-learli-ingress-token": "forged" },
      { host: "evil.test" },
      { origin: "https://evil.test" },
      { "x-learli-ingress-proto": "http" },
    ];
    for (const extra of refusedHeaders)
      expect(
        (
          await auth(
            "sign-in/email",
            { email: "hosted@example.test", password },
            cookies,
            extra,
          )
        ).status,
      ).toBe(403);
    expect(
      (
        await auth("send-verification-email", {
          email: "hosted@example.test",
          callbackURL: "https://evil.test",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await auth("request-password-reset", {
          email: "hosted@example.test",
          redirectTo: "//evil.test",
        })
      ).status,
    ).toBe(400);
    await database.owner.query("DELETE FROM rate_limit");
    for (let i = 0; i < 10; i++)
      expect(
        (
          await auth(
            "sign-in/email",
            {
              email: "hosted@example.test",
              password: "wrong-synthetic-password",
            },
            cookies,
            {
              "x-forwarded-for": `192.0.2.${i + 1}`,
              "x-real-ip": `198.51.100.${i + 1}`,
            },
          )
        ).status,
      ).toBe(401);
    expect(
      (
        await auth(
          "sign-in/email",
          { email: "hosted@example.test", password },
          cookies,
          { "x-forwarded-for": "203.0.113.99" },
        )
      ).status,
    ).toBe(429);
    const keys = (
      await database.owner.query<{ key: string }>("SELECT key FROM rate_limit")
    ).rows.map((v) => v.key);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.join()).not.toMatch(/192\.0\.2|198\.51\.100|203\.0\.113/);
    await database.owner.query("DELETE FROM rate_limit");
  });
  it("uses current/new provider OTP binding, rejects unlisted address, revokes other sessions and keeps current proof private", async () => {
    const other = new Map<string, string>();
    expect(
      (
        await auth(
          "sign-in/email",
          { email: "hosted@example.test", password },
          other,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await handleAccountEmail(
          runtime,
          request("/api/account/email", { action: "start" }),
        )
      ).status,
    ).toBe(200);
    const currentCode = code(
      "hosted@example.test",
      "Confirm your current Learli email",
    );
    expect(
      (
        await handleAccountEmail(
          runtime,
          request("/api/account/email", {
            action: "request",
            newEmail: "unlisted@example.test",
            code: currentCode,
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handleAccountEmail(
          runtime,
          request("/api/account/email", {
            action: "request",
            newEmail: "new@example.test",
            code: currentCode,
          }),
        )
      ).status,
    ).toBe(200);
    const newCode = code("new@example.test", "Confirm your new Learli email");
    expect(
      (
        await handleAccountEmail(
          runtime,
          request(
            "/api/account/email",
            {
              action: "confirm",
              newEmail: "new@example.test",
              code: newCode,
            },
            other,
          ),
        )
      ).status,
    ).toBe(400);
    const confirmed = await handleAccountEmail(
      runtime,
      request("/api/account/email", {
        action: "confirm",
        newEmail: "new@example.test",
        code: newCode,
      }),
    );
    absorb(confirmed);
    expect(confirmed.status).toBe(200);
    expect(
      await runtime.auth.api.getSession({
        headers: request("/", undefined, other).headers,
      }),
    ).toBeNull();
    expect(
      (
        await handleAccountEmail(
          runtime,
          request("/api/account/email", {
            action: "confirm",
            newEmail: "new@example.test",
            code: newCode,
          }),
        )
      ).status,
    ).not.toBe(200);
  });
  it("enumeration-safe reset is single use, invalidates existing sessions and keeps committed account state after SDK failure", async () => {
    const unknown = await auth("request-password-reset", {
      email: "unknown@example.test",
      redirectTo: "/reset-password",
    });
    expect(unknown.status).toBe(200);
    expect(
      (
        await auth("request-password-reset", {
          email: "new@example.test",
          redirectTo: "/reset-password",
        })
      ).status,
    ).toBe(200);
    const url = link("new@example.test", "Reset your Learli password");
    const token = url.pathname.split("/").at(-1)!;
    const newPassword = hostedSyntheticPassword();
    expect((await auth("reset-password", { token, newPassword })).status).toBe(
      200,
    );
    expect(
      (await auth("reset-password", { token, newPassword })).status,
    ).not.toBe(200);
    expect(
      (
        await handleAccountSessions(
          runtime,
          request("/api/account/sessions"),
          "list",
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await auth("sign-in/email", {
          email: "new@example.test",
          password: newPassword,
        })
      ).status,
    ).toBe(200);
    const other = new Map<string, string>();
    expect(
      (
        await auth(
          "sign-in/email",
          { email: "new@example.test", password: newPassword },
          other,
        )
      ).status,
    ).toBe(200);
    const changed = await handleAccountPassword(
      runtime,
      request("/api/account/password", {
        currentPassword: newPassword,
        newPassword: password,
        confirmPassword: password,
      }),
    );
    absorb(changed);
    expect(changed.status).toBe(200);
    expect(
      await runtime.auth.api.getSession({
        headers: request("/", undefined, other).headers,
      }),
    ).toBeNull();
    writeFileSync(
      path.join(directory, "response.json"),
      JSON.stringify("500"),
      { mode: 0o600 },
    );
    try {
      expect(
        (
          await auth("sign-up/email", {
            email: "failure@example.test",
            name: "Synthetic SDK failure",
            password,
            callbackURL: "/sign-in",
          })
        ).status,
      ).toBe(503);
      expect(
        (
          await database.owner.query(
            'SELECT email_verified FROM public."user" WHERE email=$1',
            ["failure@example.test"],
          )
        ).rows[0].email_verified,
      ).toBe(false);
    } finally {
      writeFileSync(
        path.join(directory, "response.json"),
        JSON.stringify("accepted"),
        { mode: 0o600 },
      );
    }
  });
  it("reports actual SDK retryable/timeout outcomes even when reset and internal email proof callbacks are swallowed", async () => {
    try {
      for (const mode of ["429", "409", "timeout"]) {
        await database.owner.query("DELETE FROM rate_limit");
        writeFileSync(
          path.join(directory, "response.json"),
          JSON.stringify(mode),
          { mode: 0o600 },
        );
        const refused = await auth("request-password-reset", {
          email: "new@example.test",
          redirectTo: "/reset-password",
        });
        expect(refused.status).toBe(503);
        expect(await refused.text()).not.toContain("new@example.test");
        expect(
          (
            await handleAccountSessions(
              runtime,
              request("/api/account/sessions"),
              "list",
            )
          ).status,
        ).toBe(200);
      }
      const refused = await handleAccountEmail(
        runtime,
        request("/api/account/email", { action: "start" }),
      );
      expect(refused.status).toBe(503);
      expect(
        (
          await database.owner.query(
            'SELECT email FROM public."user" WHERE email=$1',
            ["new@example.test"],
          )
        ).rowCount,
      ).toBe(1);
    } finally {
      writeFileSync(
        path.join(directory, "response.json"),
        JSON.stringify("accepted"),
        { mode: 0o600 },
      );
      await database.owner.query("DELETE FROM rate_limit");
    }
  });
  it("uses actual W1 TOTP challenge and single-use recovery while unassured/suspended identity stays unprivileged", async () => {
    await register("admin@example.test");
    await grantHostedTestAdmin(database.owner, "admin@example.test");
    const admin = new Map<string, string>();
    expect(
      (
        await auth(
          "sign-in/email",
          { email: "admin@example.test", password },
          admin,
        )
      ).status,
    ).toBe(200);
    const enabled = await auth("two-factor/enable", { password }, admin);
    expect(enabled.status).toBe(200);
    const body = (await enabled.json()) as {
      secret: string;
      backupCodes: string[];
    };
    unusedAdminRecovery = body.backupCodes[1];
    adminSecret = body.secret;
    expect(
      (
        await auth(
          "two-factor/verify-totp",
          { code: totpCode(body.secret) },
          admin,
        )
      ).status,
    ).toBe(200);
    expect((await auth("sign-out", {}, admin)).status).toBe(200);
    const signedIn = await auth(
      "sign-in/email",
      { email: "admin@example.test", password },
      admin,
    );
    expect((await signedIn.json()).twoFactorRedirect).toBe(true);
    for (const cookie of signedIn.headers.getSetCookie()) {
      expect(cookie).toMatch(/; Secure/i);
      expect(cookie).toMatch(/; HttpOnly/i);
    }
    expect(
      await runtime.auth.api.getSession({
        headers: request("/", undefined, admin).headers,
      }),
    ).toBeNull();
    expect(
      (
        await auth(
          "two-factor/verify-backup-code",
          { code: body.backupCodes[0] },
          admin,
        )
      ).status,
    ).toBe(200);
    expect((await auth("sign-out", {}, admin)).status).toBe(200);
    await auth(
      "sign-in/email",
      { email: "admin@example.test", password },
      admin,
    );
    expect(
      (
        await auth(
          "two-factor/verify-backup-code",
          { code: body.backupCodes[0] },
          admin,
        )
      ).status,
    ).not.toBe(200);
    await database.owner.query(
      "UPDATE user_access SET status='suspended' WHERE user_id=(SELECT id FROM public.\"user\" WHERE email='admin@example.test')",
    );
    expect(
      (
        await auth(
          "two-factor/verify-totp",
          { code: totpCode(body.secret) },
          admin,
        )
      ).status,
    ).not.toBe(200);
  });
  it("does not expose provider/native pool secrets or raw proof material in safe account DTOs/errors", async () => {
    const response = await handleAccountSessions(
      runtime,
      request("/api/account/sessions"),
      "list",
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toMatch(/token|ipAddress|userAgent|secret|password/);
    expect(Reflect.ownKeys(runtime.pool)).not.toContain("options");
    const failure = await auth("sign-up/email", {
      email: `foreign-${randomUUID()}@example.test`,
      name: "Synthetic",
      password,
    });
    expect(await failure.text()).not.toContain(password);
  });
  it("denies persisted sessions, pending MFA and existing reset/verification proofs after a selected-account restart", async () => {
    await database.owner.query("DELETE FROM rate_limit");
    expect(
      (
        await auth("request-password-reset", {
          email: "new@example.test",
          redirectTo: "/reset-password",
        })
      ).status,
    ).toBe(200);
    const reset = link("new@example.test", "Reset your Learli password");
    const token = reset.pathname.split("/").at(-1)!;
    expect(
      (
        await handleAccountEmail(
          runtime,
          request("/api/account/email", { action: "start" }),
        )
      ).status,
    ).toBe(200);
    const currentCode = code(
      "new@example.test",
      "Confirm your current Learli email",
    );
    const credential = async () =>
      (
        await database.owner.query(
          "SELECT password FROM account WHERE user_id=(SELECT id FROM public.\"user\" WHERE email='new@example.test') AND provider_id='credential'",
        )
      ).rows[0].password;
    const originalCredential = await credential();
    const verification = link(
      "failure@example.test",
      "Verify your Learli email",
    );
    await database.owner.query(
      "UPDATE user_access SET status='active' WHERE user_id=(SELECT id FROM public.\"user\" WHERE email='admin@example.test')",
    );
    const pending = new Map<string, string>();
    expect(
      (
        await auth(
          "sign-in/email",
          { email: "admin@example.test", password },
          pending,
        )
      ).status,
    ).toBe(200);
    const fingerprint = async () =>
      (
        await database.owner.query(
          "SELECT md5(backup_codes) AS hash FROM two_factor WHERE user_id=(SELECT id FROM public.\"user\" WHERE email='admin@example.test')",
        )
      ).rows[0].hash;
    const before = await fingerprint();
    const assured = new Map<string, string>();
    expect(
      (
        await auth(
          "sign-in/email",
          { email: "admin@example.test", password },
          assured,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await auth(
          "two-factor/verify-totp",
          { code: totpCode(adminSecret) },
          assured,
        )
      ).status,
    ).toBe(200);
    const factorState = async () =>
      JSON.stringify(
        (
          await database.owner.query(`
      SELECT e.epoch,
        (SELECT count(*) FROM admin_security_events WHERE user_id=u.id) AS events,
        md5(row_to_json(f)::text) AS factor,
        (SELECT md5(string_agg(row_to_json(s)::text,'|' ORDER BY s.id)) FROM session s WHERE user_id=u.id) AS sessions,
        (SELECT md5(string_agg(row_to_json(r)::text,'|' ORDER BY r.session_id)) FROM admin_assurance_receipts r WHERE user_id=u.id) AS receipts
      FROM public."user" u JOIN admin_security_epochs e ON e.user_id=u.id
      JOIN two_factor f ON f.user_id=u.id WHERE u.email='admin@example.test'
    `)
        ).rows,
      );
    const selectedFactorState = await factorState();
    await runtime.close();
    runtime = await createSyntheticHostedProvider(
      parseHostedAuthConfig(
        hostedTestSource(),
        hostedTestPacket(["second@example.test", "unknown@example.test"]),
      ),
      directory,
    );
    expect((await auth("get-session")).status).toBe(403);
    for (const action of ["enable", "disable", "generate-backup-codes"]) {
      expect(
        (await auth(`two-factor/${action}`, { password }, assured)).status,
      ).toBe(403);
      expect((await factorState()) === selectedFactorState).toBe(true);
    }
    expect(
      (
        await handleAccountSessions(
          runtime,
          request("/api/account/sessions"),
          "list",
        )
      ).status,
    ).toBe(403);
    for (const body of [
      { newPassword: hostedSyntheticPassword() },
      { newPassword: hostedSyntheticPassword(), token: "" },
    ]) {
      expect(
        (
          await auth(
            `reset-password?token=${encodeURIComponent(token)}`,
            body,
            new Map(),
          )
        ).status,
      ).toBe(400);
      // Native direct API before-hook denial throws even with asResponse.
      await expect(
        runtime.auth.api.resetPassword({
          body,
          query: { token },
          asResponse: true,
        }),
      ).rejects.toSatisfy(
        (error: unknown) => isAPIError(error) && error.statusCode === 403,
      );
      expect((await credential()) === originalCredential).toBe(true);
    }
    expect(
      (
        await handleAccountEmail(
          runtime,
          request("/api/account/email", {
            action: "request",
            newEmail: "second@example.test",
            code: currentCode,
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await auth(
          "reset-password",
          { token, newPassword: hostedSyntheticPassword() },
          new Map(),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await database.owner.query(
          "SELECT count(*) FROM verification WHERE identifier=$1",
          [`reset-password:${token}`],
        )
      ).rows[0].count,
    ).toBe("1");
    expect(
      (
        await handleAuthRequest(
          runtime,
          request(`${verification.pathname}${verification.search}`),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await database.owner.query(
          'SELECT email_verified FROM public."user" WHERE email=$1',
          ["failure@example.test"],
        )
      ).rows[0].email_verified,
    ).toBe(false);
    expect(
      (
        await auth(
          "two-factor/verify-backup-code",
          { code: unusedAdminRecovery },
          pending,
        )
      ).status,
    ).toBe(403);
    expect((await fingerprint()) === before).toBe(true);
  });
});
