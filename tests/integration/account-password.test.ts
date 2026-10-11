import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { handleAccountPassword } from "@/features/account-password/handler";
import { handleAuthRequest } from "@/lib/auth-handler";
import { handleAccountRequest } from "@/features/account/handler";
import {
  closeWorld,
  createAccount,
  jsonRequest,
  openWorld,
  password,
  type TestAccount,
  type World,
} from "./support";

let world: World;
const replacement = "Changed-synthetic-passphrase-123";
const values = (currentPassword = password, newPassword = replacement) => ({
  currentPassword,
  newPassword,
  confirmPassword: newPassword,
});
const change = (account?: TestAccount, body: unknown = values()) =>
  handleAccountPassword(
    world.runtime,
    jsonRequest(world, "/api/account/password", {
      cookie: account?.cookie,
      body,
    }),
  );
async function login(account: TestAccount, pass: string) {
  return handleAuthRequest(
    world.runtime,
    jsonRequest(world, "/api/auth/sign-in/email", {
      body: { email: account.email, password: pass },
    }),
  );
}
const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
async function current(account: TestAccount) {
  const result = await world.runtime.auth.api.getSession({
    headers: account.headers,
  });
  if (!result) throw Error("Expected synthetic session");
  return result.session;
}
describe("real signed-in password changes", () => {
  beforeAll(() => {
    world = openWorld();
  });
  beforeEach(async () => {
    await world.owner.pool.query("UPDATE rate_limit SET count = 0");
  });
  afterAll(() => closeWorld(world));

  it("rotates password, revokes every old session, preserves the replacement cookie and strips actual tokens", async () => {
    const account = await createAccount(world);
    const other = await login(account, password);
    const otherCookie = cookieOf(other);
    const old = await world.owner.pool.query(
      "SELECT token FROM session WHERE user_id=$1",
      [account.id],
    );
    expect(old.rowCount).toBe(2);
    const response = await change(account);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ status: true });
    const newer = await world.owner.pool.query(
      "SELECT token FROM session WHERE user_id=$1",
      [account.id],
    );
    expect(newer.rowCount).toBe(1);
    for (const row of [...old.rows, ...newer.rows])
      expect(text.includes(row.token)).toBe(false);
    expect(text.includes(account.id)).toBe(false);
    for (const cookie of [account.cookie, otherCookie]) {
      expect(
        await world.runtime.auth.api.getSession({
          headers: new Headers({ cookie }),
        }),
      ).toBeNull();
      expect(
        (
          await handleAccountRequest(
            world.runtime,
            jsonRequest(world, `/api/account/${account.id}`, {
              method: "GET",
              cookie,
            }),
            account.id,
          )
        ).status,
      ).toBe(401);
    }
    const cookie = cookieOf(response);
    expect(cookie.length > 0).toBe(true);
    expect(
      (
        await handleAccountRequest(
          world.runtime,
          jsonRequest(world, `/api/account/${account.id}`, {
            method: "GET",
            cookie,
          }),
          account.id,
        )
      ).status,
    ).toBe(200);
    expect((await login(account, password)).status).toBe(401);
    expect((await login(account, replacement)).status).toBe(200);
  });

  it("wrong current password leaves hash and both sessions unchanged", async () => {
    const account = await createAccount(world);
    await login(account, password);
    const before = await world.owner.pool.query(
      "SELECT password FROM account WHERE user_id=$1",
      [account.id],
    );
    expect(
      (await change(account, values("Wrong synthetic password"))).status,
    ).toBe(400);
    const after = await world.owner.pool.query(
      "SELECT password FROM account WHERE user_id=$1",
      [account.id],
    );
    expect(after.rows[0].password === before.rows[0].password).toBe(true);
    expect(
      (
        await world.owner.pool.query("SELECT 1 FROM session WHERE user_id=$1", [
          account.id,
        ])
      ).rowCount,
    ).toBe(2);
    expect((await login(account, password)).status).toBe(200);
  });

  it("rejects malformed/mismatched/bounded input and client ownership/revocation overrides", async () => {
    const account = await createAccount(world, ["admin"]);
    const other = await createAccount(world);
    for (const body of [
      {},
      { ...values(), confirmPassword: "Mismatch synthetic password" },
      values(password, "short"),
      values(password, "x".repeat(129)),
      values("x".repeat(129)),
      { ...values(), userId: other.id },
      { ...values(), revokeOtherSessions: false },
      { ...values(), role: "admin" },
      { ...values(), newPassword: "x".repeat(4096) },
    ])
      expect((await change(account, body)).status).toBe(400);
    expect((await login(other, password)).status).toBe(200);
    expect((await login(account, password)).status).toBe(200);
    const raw = await handleAuthRequest(
      world.runtime,
      jsonRequest(world, "/api/auth/change-password", {
        cookie: account.cookie,
        body: values(),
      }),
    );
    expect(raw.status).toBe(404);
  });

  it("denies anonymous, expired, stale, unverified and suspended identities", async () => {
    expect((await change()).status).toBe(401);
    for (const state of [
      "expired",
      "stale",
      "unverified",
      "suspended",
    ] as const) {
      const account = await createAccount(world);
      const own = await current(account);
      if (state === "expired")
        await world.owner.pool.query(
          "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
          [own.id],
        );
      if (state === "stale")
        await world.owner.pool.query(
          "UPDATE session SET created_at=clock_timestamp()-interval '25 hours' WHERE id=$1",
          [own.id],
        );
      if (state === "unverified")
        await world.owner.pool.query(
          'UPDATE "user" SET email_verified=false WHERE id=$1',
          [account.id],
        );
      if (state === "suspended")
        await world.owner.pool.query(
          "UPDATE user_access SET status='suspended' WHERE user_id=$1",
          [account.id],
        );
      const response = await change(account);
      expect(response.status).toBe(state === "expired" ? 401 : 403);
      if (state === "stale")
        expect((await response.json()).code).toBe("SESSION_NOT_FRESH");
      expect(
        (
          await world.owner.pool.query("SELECT 1 FROM session WHERE id=$1", [
            own.id,
          ])
        ).rowCount,
      ).toBe(state === "expired" ? 0 : 1);
    }
  });

  it("fresh reauthentication after stale denial returns to a working change flow", async () => {
    const account = await createAccount(world);
    const own = await current(account);
    await world.owner.pool.query(
      "UPDATE session SET created_at=clock_timestamp()-interval '25 hours' WHERE id=$1",
      [own.id],
    );
    expect((await change(account)).status).toBe(403);
    const loginResponse = await login(account, password);
    const freshCookie = cookieOf(loginResponse);
    expect(
      (
        await change({
          ...account,
          cookie: freshCookie,
          headers: new Headers({ cookie: freshCookie }),
        })
      ).status,
    ).toBe(200);
  });

  it("retains origin/host/method/content bounds and private response policy", async () => {
    const account = await createAccount(world);
    for (const mode of [
      "foreign-origin",
      "missing-origin",
      "foreign-host",
      "wrong-method",
      "bad-json",
      "wrong-content",
    ] as const) {
      const request = jsonRequest(world, "/api/account/password", {
        cookie: account.cookie,
        body: values(),
      });
      if (mode === "foreign-origin")
        request.headers.set("origin", "https://foreign.test");
      if (mode === "missing-origin") request.headers.delete("origin");
      if (mode === "foreign-host") request.headers.set("host", "foreign.test");
      if (mode === "wrong-content")
        request.headers.set("content-type", "text/plain");
      const actual =
        mode === "wrong-method"
          ? jsonRequest(world, "/api/account/password", {
              method: "GET",
              cookie: account.cookie,
            })
          : mode === "bad-json"
            ? new Request(request.url, {
                method: "POST",
                headers: request.headers,
                body: "{",
              })
            : request;
      const response = await handleAccountPassword(world.runtime, actual);
      expect(response.status).toBe(
        mode.includes("origin") || mode === "foreign-host"
          ? 403
          : mode === "wrong-method"
            ? 405
            : 400,
      );
      expect(response.headers.get("cache-control")).toBe(
        "private, no-store, max-age=0",
      );
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    }
    expect(
      (
        await handleAccountPassword(
          null,
          jsonRequest(world, "/api/account/password", { body: values() }),
        )
      ).status,
    ).toBe(503);
  });

  it("executes real persisted HTTP throttling despite spoofed forwarded addresses", async () => {
    const account = await createAccount(world);
    for (let i = 0; i < 6; i++) {
      const request = jsonRequest(world, "/api/account/password", {
        cookie: account.cookie,
        body: values("Wrong synthetic password"),
      });
      request.headers.set("x-forwarded-for", `192.0.2.${i + 1}`);
      request.headers.set("x-learli-local-ip", `192.0.2.${i + 1}`);
      const response = await handleAccountPassword(world.runtime, request);
      expect(response.status).toBe(i < 5 ? 400 : 429);
      if (i === 5)
        expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    }
    const record = await world.owner.pool.query(
      "SELECT count FROM rate_limit WHERE key LIKE '%/change-password%'",
    );
    expect(record.rows.some((row) => row.count >= 5)).toBe(true);
    expect((await change(account)).status).toBe(429);
    expect((await login(account, password)).status).toBe(200);
  });

  it("concurrent changes do not both mutate credentials and replacement access stays valid", async () => {
    const account = await createAccount(world);
    const responses = await Promise.all([
      change(account, values(password, replacement)),
      change(account, values(password, "Alternate-synthetic-password-123")),
    ]);
    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    expect(responses.every((r) => [200, 401, 409].includes(r.status))).toBe(
      true,
    );
    const success = responses.find((r) => r.status === 200)!;
    expect(
      await world.runtime.auth.api.getSession({
        headers: new Headers({ cookie: cookieOf(success) }),
      }),
    ).not.toBeNull();
    expect((await login(account, password)).status).toBe(401);
  });

  it("held account lock conflicts without mutation then current suspension is denied", async () => {
    const account = await createAccount(world);
    const client = await world.owner.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(41004,hashtext($1))", [
        account.id,
      ]);
      expect((await change(account)).status).toBe(409);
      await client.query(
        "UPDATE user_access SET status='suspended' WHERE user_id=$1",
        [account.id],
      );
      await client.query("COMMIT");
      expect((await change(account)).status).toBe(403);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("bounds shared-pool capacity across five simultaneous distinct accounts", async () => {
    const accounts: TestAccount[] = [];
    for (let i = 0; i < 5; i++) accounts.push(await createAccount(world));
    const started = Date.now();
    const responses = await Promise.all(
      accounts.map((account) => change(account)),
    );
    expect(Date.now() - started).toBeLessThan(3000);
    expect(responses.some((response) => response.status === 200)).toBe(true);
    expect(
      responses.every((response) => [200, 409].includes(response.status)),
    ).toBe(true);
    for (let i = 0; i < responses.length; i++) {
      const cookie =
        responses[i].status === 200
          ? cookieOf(responses[i])
          : accounts[i].cookie;
      expect(
        await world.runtime.auth.api.getSession({
          headers: new Headers({ cookie }),
        }),
      ).not.toBeNull();
    }
  });

  it("rechecks current permission after a real database wait in the initial identity lookup", async () => {
    const account = await createAccount(world);
    const client = await world.owner.pool.connect();
    let result: Promise<Response> | undefined;
    try {
      await client.query("BEGIN");
      await client.query("LOCK TABLE user_roles IN ACCESS EXCLUSIVE MODE");
      result = change(account);
      let waiting = false;
      for (let i = 0; i < 100; i++) {
        const rows = await world.owner.pool.query(
          "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND usename='learli_app' AND wait_event_type='Lock' AND query LIKE '%user_roles%' AND pid<>pg_backend_pid()",
        );
        if (rows.rowCount) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
      await client.query(
        "UPDATE user_access SET status='suspended' WHERE user_id=$1",
        [account.id],
      );
      await client.query("COMMIT");
      expect((await result).status).toBe(403);
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await result;
    }
  });

  it("real replacement-session failure truthfully reports partial mutation and supports reset recovery", async () => {
    const account = await createAccount(world);
    const suffix = randomUUID().replaceAll("-", "");
    const name = `password_failure_${suffix}`;
    // Owned synthetic test instrumentation; serialized suite, guaranteed teardown.
    await world.owner.pool.query(
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN IF NEW.user_id=TG_ARGV[0] THEN RAISE EXCEPTION 'Synthetic replacement failure'; END IF; RETURN NEW; END $f$`,
    );
    try {
      await world.owner.pool.query(
        `CREATE TRIGGER ${name} BEFORE INSERT ON session FOR EACH ROW EXECUTE FUNCTION ${name}('${account.id}')`,
      );
      const response = await change(account);
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.code).toBe("CHANGE_UNCERTAIN");
      expect(body.message.includes("rollback")).toBe(false);
      expect(
        await world.runtime.auth.api.getSession({ headers: account.headers }),
      ).toBeNull();
    } finally {
      await world.owner.pool.query(`DROP TRIGGER IF EXISTS ${name} ON session`);
      await world.owner.pool.query(`DROP FUNCTION ${name}()`);
    }
    expect((await login(account, password)).status).toBe(401);
    expect((await login(account, replacement)).status).toBe(200);
  });
});
