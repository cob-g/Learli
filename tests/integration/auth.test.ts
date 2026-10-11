import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createLocalAuth, type AuthRuntime } from "@/lib/auth-factory";
import { createDatabase } from "@/lib/db/connection";
import {
  user,
  userAccess,
  userRoles,
  session,
  verification,
} from "@/lib/db/schema";
import { handleAuthRequest } from "@/lib/auth-handler";
import { handleAccountRequest } from "@/features/account/handler";
import { requireRole } from "@/lib/permissions/access";
import { localMailbox, type LocalMessage } from "@/lib/email/local-mail";

let runtime: AuthRuntime;
let owner: ReturnType<typeof createDatabase>;
const password = "Synthetic-only-passphrase-123";
function authRequest(
  route: string,
  body?: unknown,
  cookie?: string,
  origin = runtime.origin,
) {
  return handleAuthRequest(
    runtime,
    new Request(`${runtime.origin}/api/auth/${route}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        origin,
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function messageFor(email: string, kind: LocalMessage["kind"]) {
  const directory = localMailbox("test");
  for (const file of (await readdir(directory))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()) {
    const message = JSON.parse(
      await readFile(path.join(directory, file), "utf8"),
    ) as LocalMessage;
    if (message.to === email && message.kind === kind) return message;
  }
  throw new Error("Expected a private local capture.");
}
async function register(verified = true) {
  const email = `test-${randomUUID()}@learli.test`;
  const response = await authRequest("sign-up/email", {
    email,
    name: "Synthetic learner",
    password,
    callbackURL: "/account",
  });
  expect(response.status).toBe(200);
  const body = await response.json();
  if (verified) {
    const capture = await messageFor(email, "verification");
    const result = await handleAuthRequest(runtime, new Request(capture.url));
    expect([200, 302]).toContain(result.status);
  }
  return { email, id: body.user.id as string };
}
async function login(email: string, pass = password) {
  const response = await authRequest("sign-in/email", {
    email,
    password: pass,
  });
  expect(response.status).toBe(200);
  return {
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; "),
    response,
  };
}
function accountRequest(
  userId: string,
  cookie?: string,
  input?: unknown,
  origin = runtime.origin,
) {
  return handleAccountRequest(
    runtime,
    new Request(`${runtime.origin}/api/account/${userId}`, {
      method: input === undefined ? "GET" : "PATCH",
      headers: {
        origin,
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    }),
    userId,
  );
}
beforeAll(() => {
  if (process.env.APP_ENV !== "test")
    throw new Error("Integration tests require the isolated test environment.");
  owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
  runtime = createLocalAuth(process.env);
});
beforeEach(async () => {
  // Dedicated synthetic test database only, checked before any connection is made.
  await owner.pool.query(
    'TRUNCATE TABLE "user", rate_limit, verification CASCADE',
  );
});
afterAll(async () => {
  await runtime?.pool.end();
  await owner?.pool.end();
});

describe("real PostgreSQL identity lifecycle", () => {
  it("requires verification, captures locally, starts without roles, and uses private cookies", async () => {
    const account = await register(false);
    expect(
      (await authRequest("sign-in/email", { email: account.email, password }))
        .status,
    ).toBe(403);
    const mail = await messageFor(account.email, "verification");
    expect(new URL(mail.url).origin).toBe(runtime.origin);
    await handleAuthRequest(runtime, new Request(mail.url));
    const { cookie, response } = await login(account.email);
    const sessionCookie = response.headers
      .getSetCookie()
      .find((value) => value.includes("session_token"));
    expect(!!sessionCookie?.includes("HttpOnly")).toBe(true);
    expect(!!sessionCookie?.toLowerCase().includes("samesite=lax")).toBe(true);
    const own = await accountRequest(account.id, cookie);
    expect(own.headers.get("cache-control")).toContain("no-store");
    expect(await own.json()).toMatchObject({
      id: account.id,
      email: account.email,
      roles: [],
      timezone: "UTC",
    });
    const audit = await owner.pool.query(
      "SELECT action FROM audit_events WHERE target_user_id = $1",
      [account.id],
    );
    expect(audit.rows).toContainEqual({ action: "account.created" });
    expect(
      (
        await owner.pool.query(
          "SELECT password FROM account WHERE user_id = $1",
          [account.id],
        )
      ).rows[0].password === password,
    ).toBe(false);
  });

  it("rejects non-synthetic signup, client role/status injection, and weak passwords", async () => {
    const base = { email: "new@learli.test", name: "Test", password };
    for (const patch of [
      { email: "real@example.com" },
      { role: "admin" },
      { emailVerified: true },
      { status: "active" },
      { password: "weak" },
    ]) {
      expect(
        (await authRequest("sign-up/email", { ...base, ...patch })).status,
      ).toBe(400);
    }
    expect(
      (await owner.pool.query('SELECT count(*) FROM "user"')).rows[0].count,
    ).toBe("0");
  });

  it("does not reveal whether a signup or reset address already exists", async () => {
    const account = await register();
    const duplicate = await authRequest("sign-up/email", {
      email: account.email,
      name: "Test",
      password,
    });
    const fresh = await authRequest("sign-up/email", {
      email: `new-${randomUUID()}@learli.test`,
      name: "Test",
      password,
    });
    expect(duplicate.status).toBe(fresh.status);
    expect(Object.keys(await duplicate.json()).sort()).toEqual(
      Object.keys(await fresh.json()).sort(),
    );
    const known = await authRequest("request-password-reset", {
      email: account.email,
      redirectTo: "/reset-password",
    });
    const unknown = await authRequest("request-password-reset", {
      email: "missing@learli.test",
      redirectTo: "/reset-password",
    });
    expect(known.status).toBe(unknown.status);
    expect(await known.json()).toEqual(await unknown.json());
  });

  it("resets once, rejects old passwords, and revokes existing sessions", async () => {
    const account = await register();
    const { cookie } = await login(account.email);
    await authRequest("request-password-reset", {
      email: account.email,
      redirectTo: "/reset-password",
    });
    const mail = await messageFor(account.email, "reset");
    const callback = await handleAuthRequest(runtime, new Request(mail.url));
    const location = callback.headers.get("location");
    expect(!!location).toBe(true);
    const token = new URL(location!, runtime.origin).searchParams.get("token");
    const newPassword = "Another-synthetic-passphrase-456";
    expect(
      (await authRequest("reset-password", { token, newPassword })).status,
    ).toBe(200);
    expect(
      (await authRequest("reset-password", { token, newPassword })).status,
    ).toBe(400);
    expect((await accountRequest(account.id, cookie)).status).toBe(401);
    expect(
      (await authRequest("sign-in/email", { email: account.email, password }))
        .status,
    ).toBe(401);
    await login(account.email, newPassword);
  });

  it("rejects invalid/expired reset tokens and expired sessions", async () => {
    const account = await register();
    const { cookie } = await login(account.email);
    expect(
      (
        await authRequest("reset-password", {
          token: "invalid-synthetic-token",
          newPassword: password,
        })
      ).status,
    ).toBe(400);
    await authRequest("request-password-reset", {
      email: account.email,
      redirectTo: "/reset-password",
    });
    const mail = await messageFor(account.email, "reset");
    await owner.db.update(verification).set({ expiresAt: new Date(0) });
    const expired = await handleAuthRequest(runtime, new Request(mail.url));
    const target = expired.headers.get("location") ?? "";
    expect(target.includes("INVALID_TOKEN")).toBe(true);
    await owner.db
      .update(session)
      .set({ expiresAt: new Date(0) })
      .where(eq(session.userId, account.id));
    expect((await accountRequest(account.id, cookie)).status).toBe(401);
  });

  it("logout revokes the session even if the old cookie is replayed", async () => {
    const account = await register();
    const { cookie } = await login(account.email);
    expect((await authRequest("sign-out", {}, cookie)).status).toBe(200);
    expect((await accountRequest(account.id, cookie)).status).toBe(401);
    expect(
      (await accountRequest(account.id, "better-auth.session_token=forged"))
        .status,
    ).toBe(401);
  });
});

describe("server permissions, validation and database boundaries", () => {
  it("denies anonymous and cross-account reads/writes, including admin ownership bypass", async () => {
    const a = await register();
    const b = await register();
    const { cookie } = await login(a.email);
    expect((await accountRequest(a.id)).status).toBe(401);
    expect((await accountRequest(b.id, cookie)).status).toBe(404);
    expect(
      (await accountRequest(b.id, cookie, { name: "Changed", timezone: "UTC" }))
        .status,
    ).toBe(404);
    await owner.db.insert(userRoles).values({ userId: a.id, role: "admin" });
    expect((await accountRequest(b.id, cookie)).status).toBe(404);
    expect(
      (await owner.db.select().from(user).where(eq(user.id, b.id)))[0].name,
    ).toBe("Synthetic learner");
  });

  it("honors trusted multi-role grants, denies wrong roles, and immediately denies suspended/unverified accounts", async () => {
    const account = await register();
    const { cookie } = await login(account.email);
    const headers = new Headers({ cookie });
    await expect(requireRole(runtime, headers, "admin")).rejects.toMatchObject({
      status: 403,
    });
    await owner.db.insert(userRoles).values([
      { userId: account.id, role: "parent" },
      { userId: account.id, role: "tutor" },
    ]);
    expect((await requireRole(runtime, headers, "parent")).roles).toEqual(
      expect.arrayContaining(["parent", "tutor"]),
    );
    await requireRole(runtime, headers, "tutor");
    await owner.db
      .update(user)
      .set({ emailVerified: false })
      .where(eq(user.id, account.id));
    expect((await accountRequest(account.id, cookie)).status).toBe(403);
    await owner.db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, account.id));
    await owner.db
      .update(userAccess)
      .set({ status: "suspended" })
      .where(eq(userAccess.userId, account.id));
    expect((await accountRequest(account.id, cookie)).status).toBe(403);
    expect(
      (await authRequest("sign-in/email", { email: account.email, password }))
        .status,
    ).not.toBe(200);
  });

  it("updates only permitted own settings, audits the change, and rejects extra fields/timezone offsets", async () => {
    const account = await register();
    const { cookie } = await login(account.email);
    expect(
      (
        await accountRequest(account.id, cookie, {
          name: "  Updated learner  ",
          timezone: "Asia/Manila",
        })
      ).status,
    ).toBe(200);
    expect(
      await (await accountRequest(account.id, cookie)).json(),
    ).toMatchObject({ name: "Updated learner", timezone: "Asia/Manila" });
    for (const input of [
      { name: "X", timezone: "UTC", role: "admin" },
      { name: "X", timezone: "Mars/Planet" },
      { name: "X", timezone: "+08:00" },
      { name: " ", timezone: "UTC" },
    ])
      expect((await accountRequest(account.id, cookie, input)).status).toBe(
        400,
      );
    expect(
      (
        await owner.pool.query(
          "SELECT count(*) FROM audit_events WHERE action='account.updated' AND target_user_id=$1",
          [account.id],
        )
      ).rows[0].count,
    ).toBe("1");
  });

  it("blocks remote/missing origins, forbidden auth endpoints and external redirects", async () => {
    const account = await register();
    const { cookie } = await login(account.email);
    expect(
      (await authRequest("sign-out", {}, cookie, "https://attacker.test"))
        .status,
    ).toBe(403);
    expect((await authRequest("sign-out", {}, cookie, "")).status).toBe(403);
    expect(
      (
        await accountRequest(
          account.id,
          cookie,
          { name: "X", timezone: "UTC" },
          "https://attacker.test",
        )
      ).status,
    ).toBe(403);
    expect(
      (await authRequest("update-user", { name: "Bypass" }, cookie)).status,
    ).toBe(404);
    expect(
      (
        await authRequest("request-password-reset", {
          email: account.email,
          redirectTo: "https://attacker.test",
        })
      ).status,
    ).toBe(403);
  });

  it("accepts Next's internal localhost URL only with the configured Host", async () => {
    const internal = new URL(runtime.origin);
    internal.hostname = "localhost";
    const body = JSON.stringify({
      email: `next-${randomUUID()}@learli.test`,
      password,
      name: "Synthetic Next request",
    });
    const request = (host: string, origin = runtime.origin) =>
      new Request(`${internal.origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { host, origin, "content-type": "application/json" },
        body,
      });
    expect(
      (await handleAuthRequest(runtime, request("attacker.test"))).status,
    ).toBe(403);
    expect(
      (
        await handleAuthRequest(
          runtime,
          request(new URL(runtime.origin).host, "https://attacker.test"),
        )
      ).status,
    ).toBe(403);
    expect(
      (await handleAuthRequest(runtime, request(new URL(runtime.origin).host)))
        .status,
    ).toBe(200);
  });

  it("rejects tampered verification callbacks before redirecting", async () => {
    const account = await register(false);
    const capture = await messageFor(account.email, "verification");
    const tampered = new URL(capture.url);
    tampered.searchParams.set("callbackURL", "https://attacker.test");
    expect(
      (await handleAuthRequest(runtime, new Request(tampered))).status,
    ).toBe(403);
  });

  it("throttles repeated sign-in requests using persisted records", async () => {
    const codes = [];
    for (let i = 0; i < 11; i++)
      codes.push(
        (
          await authRequest("sign-in/email", {
            email: "missing@learli.test",
            password,
          })
        ).status,
      );
    expect(codes.at(-1)).toBe(429);
    expect(
      (await owner.pool.query("SELECT count(*) FROM rate_limit")).rows[0].count,
    ).not.toBe("0");
  });

  it("enforces runtime privileges, role uniqueness/checks, and transactional rollback in PostgreSQL", async () => {
    const account = await register();
    await expect(
      runtime.pool.query("CREATE TABLE forbidden_table (id int)"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      runtime.pool.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')",
        [account.id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      runtime.pool.query("UPDATE user_access SET status = 'active'"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      runtime.pool.query("DELETE FROM audit_events"),
    ).rejects.toMatchObject({ code: "42501" });
    await owner.db
      .insert(userRoles)
      .values({ userId: account.id, role: "student" });
    await expect(
      owner.pool.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, 'student')",
        [account.id],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      owner.pool.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, 'superadmin')",
        [account.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      runtime.db.transaction(async (tx) => {
        await tx
          .update(user)
          .set({ name: "Must roll back" })
          .where(eq(user.id, account.id));
        throw new Error("deliberate test rollback");
      }),
    ).rejects.toThrow("deliberate test rollback");
    expect(
      (await owner.db.select().from(user).where(eq(user.id, account.id)))[0]
        .name,
    ).toBe("Synthetic learner");
  });

  it("returns a safe unavailable response when unconfigured or disconnected", async () => {
    expect(
      (
        await handleAuthRequest(
          null,
          new Request(`${runtime.origin}/api/auth/get-session`),
        )
      ).status,
    ).toBe(503);
    const unavailableUrl = new URL(process.env.DATABASE_URL!);
    // This local test deliberately targets a closed port, independent of the cluster port.
    unavailableUrl.port = "1";
    const unavailable = createLocalAuth({
      ...process.env,
      DATABASE_URL: unavailableUrl.toString(),
    });
    try {
      const response = await handleAuthRequest(
        unavailable,
        new Request(`${runtime.origin}/api/auth/sign-in/email`, {
          method: "POST",
          headers: {
            origin: runtime.origin,
            "content-type": "application/json",
          },
          body: JSON.stringify({ email: "missing@learli.test", password }),
        }),
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        message: "Account service is unavailable. Try again later.",
      });
    } finally {
      await unavailable.pool.end();
    }
  });
});
