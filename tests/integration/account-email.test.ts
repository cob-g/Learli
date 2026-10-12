import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { handleAccountEmail } from "@/features/account-email/handler";
import { expectedProofIdentifiers } from "@/features/account-email/proof-context";
import { handleAuthRequest } from "@/lib/auth-handler";
import { localMailbox, type LocalMessage } from "@/lib/email/local-mail";
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
const target = () => `new-${randomUUID()}@learli.test`;
async function capture(to: string, kind: LocalMessage["kind"]) {
  const directory = localMailbox("test");
  for (const file of (await readdir(directory))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()) {
    const message = JSON.parse(
      await readFile(path.join(directory, file), "utf8"),
    ) as LocalMessage;
    if (message.to === to && message.kind === kind) return message;
  }
  throw Error("Expected owned private confirmation capture.");
}
async function code(
  to: string,
  kind: "email-change-current" | "email-change-new",
) {
  const message = await capture(to, kind);
  if (!("otp" in message)) throw Error("Expected private code capture.");
  expect(new URL(message.url).pathname).toBe("/account/email");
  expect(new URL(message.url).search).toBe("");
  return message.otp;
}
const change = (
  account: TestAccount | undefined,
  body: unknown = { action: "start" },
) =>
  handleAccountEmail(
    world.runtime,
    jsonRequest(world, "/api/account/email", { cookie: account?.cookie, body }),
  );
async function prepare(account: TestAccount, newEmail = target()) {
  expect((await change(account)).status).toBe(200);
  const currentCode = await code(account.email, "email-change-current");
  const response = await change(account, {
    action: "request",
    newEmail,
    code: currentCode,
  });
  expect(response.status).toBe(200);
  const nextCode = await code(newEmail, "email-change-new");
  return {
    newEmail,
    currentCode,
    nextCode,
    body: { action: "confirm", newEmail, code: nextCode },
  };
}
async function login(account: TestAccount, email = account.email) {
  return handleAuthRequest(
    world.runtime,
    jsonRequest(world, "/api/auth/sign-in/email", {
      body: { email, password },
    }),
  );
}
const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
async function sessionId(account: TestAccount) {
  const value = await world.runtime.auth.api.getSession({
    headers: account.headers,
  });
  if (!value) throw Error("Expected owned synthetic session.");
  return value.session.id;
}
async function proofKey(account: TestAccount, newEmail?: string) {
  const value = {
    userId: account.id,
    sessionId: await sessionId(account),
    currentEmail: account.email,
    newEmail,
  };
  const expected = expectedProofIdentifiers(value);
  return world.runtime.emailProofBinding.withContext(value, () =>
    world.runtime.emailProofBinding.identifier(
      newEmail ? expected.next! : expected.current,
      world.runtime.auth.options.secret!,
      async () => false,
    ),
  );
}
async function saved(account: TestAccount) {
  return (
    await world.owner.pool.query(
      'SELECT email,email_verified FROM "user" WHERE id=$1',
      [account.id],
    )
  ).rows[0];
}
async function namedAccount(email: string) {
  const signup = await handleAuthRequest(
    world.runtime,
    jsonRequest(world, "/api/auth/sign-up/email", {
      body: { email, name: "Synthetic proof account", password },
    }),
  );
  expect(signup.status).toBe(200);
  const id = (await signup.json()).user.id as string;
  await handleAuthRequest(
    world.runtime,
    new Request((await capture(email, "verification")).url),
  );
  const partial = {
    id,
    email,
    name: "Synthetic proof account",
    cookie: "",
    headers: new Headers(),
  };
  const cookie = cookieOf(await login(partial));
  return { ...partial, cookie, headers: new Headers({ cookie }) };
}
describe("real provider signed-in email changes", () => {
  beforeAll(async () => {
    world = openWorld();
    const plain = await world.owner.pool.query(
      "SELECT 1 FROM verification WHERE identifier LIKE 'email-verification-%' OR identifier LIKE 'change-email-%'",
    );
    expect(plain.rowCount).toBe(0);
  });
  beforeEach(() => world.owner.pool.query("UPDATE rate_limit SET count=0"));
  afterAll(() => closeWorld(world));

  it("proves both addresses before mutation, retains current cookie and revokes others", async () => {
    const account = await createAccount(world);
    const otherCookie = cookieOf(await login(account));
    const ownSession = await sessionId(account);
    const pending = await prepare(account);
    expect((await saved(account)).email === account.email).toBe(true);
    expect((await login(account)).status).toBe(200);
    expect((await login(account, pending.newEmail)).status).toBe(401);
    const rows = await world.owner.pool.query(
      "SELECT value,identifier FROM verification WHERE identifier=$1",
      [await proofKey(account, pending.newEmail)],
    );
    expect(
      rows.rows.some(
        (r) => r.value.includes(pending.nextCode) || r.identifier.includes("@"),
      ),
    ).toBe(false);
    const response = await change(account, pending.body);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ status: true, stage: "complete" });
    expect(
      [
        pending.nextCode,
        pending.currentCode,
        pending.newEmail,
        account.id,
      ].some((v) => text.includes(v)),
    ).toBe(false);
    expect((await saved(account)).email === pending.newEmail).toBe(true);
    expect((await saved(account)).email_verified).toBe(true);
    expect(
      (
        await world.owner.pool.query(
          "SELECT id FROM session WHERE user_id=$1",
          [account.id],
        )
      ).rows.map((r) => r.id),
    ).toEqual([ownSession]);
    expect(
      Boolean(
        await world.runtime.auth.api.getSession({
          headers: new Headers({ cookie: otherCookie }),
        }),
      ),
    ).toBe(false);
    const current = await world.runtime.auth.api.getSession({
      headers: new Headers({ cookie: cookieOf(response) }),
    });
    expect(
      current?.session.id === ownSession &&
        current.user.email === pending.newEmail,
    ).toBe(true);
    expect((await login(account)).status).toBe(401);
    expect((await login(account, pending.newEmail)).status).toBe(200);
    expect((await change(account, pending.body)).status).toBe(400);
  });

  it("consumes current proof once and hides duplicate-target existence", async () => {
    const account = await createAccount(world);
    const existing = await createAccount(world);
    expect((await change(account)).status).toBe(200);
    const currentCode = await code(account.email, "email-change-current");
    const body = {
      action: "request",
      newEmail: existing.email,
      code: currentCode,
    };
    const response = await change(account, body);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: true, stage: "new" });
    expect((await change(account, body)).status).toBe(400);
    expect((await change(account, { ...body, action: "confirm" })).status).toBe(
      400,
    );
    expect((await saved(account)).email === account.email).toBe(true);
  });

  it("rejects same/malformed/foreign addresses and client actor/callback overrides", async () => {
    const account = await createAccount(world);
    for (const newEmail of [
      account.email.toUpperCase(),
      "bad",
      "person@example.com",
      "x".repeat(256) + "@learli.test",
    ])
      expect(
        (await change(account, { action: "request", newEmail, code: "123456" }))
          .status,
      ).toBe(400);
    for (const key of [
      "userId",
      "role",
      "callbackURL",
      "returnTo",
      "revokeOtherSessions",
    ])
      expect(
        (await change(account, { action: "start", [key]: "untrusted" })).status,
      ).toBe(400);
    for (const endpoint of [
      "change-email",
      "email-otp/send-verification-otp",
      "email-otp/request-email-change",
      "email-otp/change-email",
      "email-otp/verify-email",
      "sign-in/email-otp",
      "email-otp/reset-password",
    ])
      expect(
        (
          await handleAuthRequest(
            world.runtime,
            jsonRequest(world, `/api/auth/${endpoint}`, {
              cookie: account.cookie,
              body: {},
            }),
          )
        ).status,
      ).toBe(404);
  });

  it("rejects expired current and new proofs without email mutation", async () => {
    const account = await createAccount(world);
    expect((await change(account)).status).toBe(200);
    const currentCode = await code(account.email, "email-change-current");
    await world.owner.pool.query(
      "UPDATE verification SET expires_at=clock_timestamp()-interval '1 second' WHERE identifier=$1",
      [await proofKey(account)],
    );
    expect(
      (
        await change(account, {
          action: "request",
          newEmail: target(),
          code: currentCode,
        })
      ).status,
    ).toBe(400);
    const pending = await prepare(account);
    await world.owner.pool.query(
      "UPDATE verification SET expires_at=clock_timestamp()-interval '1 second' WHERE identifier=$1",
      [await proofKey(account, pending.newEmail)],
    );
    expect((await change(account, pending.body)).status).toBe(400);
    expect((await saved(account)).email === account.email).toBe(true);
  });

  it("wrong-code recreation keeps the namespace and provider attempt budget", async () => {
    const account = await createAccount(world);
    const pending = await prepare(account);
    const wrong = String((Number(pending.nextCode) + 1) % 1000000).padStart(
      6,
      "0",
    );
    expect(
      (await change(account, { ...pending.body, code: wrong })).status,
    ).toBe(400);
    const rows = await world.owner.pool.query(
      "SELECT value FROM verification WHERE identifier=$1",
      [await proofKey(account, pending.newEmail)],
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].value.endsWith(":1")).toBe(true);
    expect((await change(account, pending.body)).status).toBe(200);
    const nextAccount = await createAccount(world);
    const next = await prepare(nextAccount);
    for (let i = 0; i < 4; i++) {
      await world.owner.pool.query("UPDATE rate_limit SET count=0");
      expect(
        (
          await change(nextAccount, {
            ...next.body,
            code: String((Number(next.nextCode) + 1) % 1000000).padStart(
              6,
              "0",
            ),
          })
        ).status,
      ).toBe(i < 3 ? 400 : 403);
    }
    await world.owner.pool.query("UPDATE rate_limit SET count=0");
    expect((await change(nextAccount, next.body)).status).toBe(400);
  });

  it("concurrent final consumers cannot both succeed and capture contexts do not mix", async () => {
    const account = await createAccount(world);
    const pending = await prepare(account);
    const responses = await Promise.all([
      change(account, pending.body),
      change(account, pending.body),
    ]);
    expect(responses.filter((r) => r.status === 200).length).toBe(1);
    expect(responses.every((r) => [200, 400, 409].includes(r.status))).toBe(
      true,
    );
    const accounts = [await createAccount(world), await createAccount(world)];
    const parallel = await Promise.all(accounts.map((a) => change(a)));
    expect(parallel.every((r) => [200, 409].includes(r.status))).toBe(true);
    for (let i = 0; i < accounts.length; i++)
      if (parallel[i].status === 200)
        expect(
          (await capture(accounts[i].email, "email-change-current")).to ===
            accounts[i].email,
        ).toBe(true);
  });

  it.each([false, true])(
    "two valid collision-shaped flows stay isolated in reverse order %s",
    async (reverse) => {
      const tag = randomUUID().replaceAll("-", "");
      const left = await namedAccount(`a@${tag}.test`);
      const right = await namedAccount(`a@${tag}.test-x.test`);
      const leftTarget = `x.test-y@${tag}.test`;
      const rightTarget = `y@${tag}.test`;
      const ordered = reverse
        ? ([
            [right, rightTarget],
            [left, leftTarget],
          ] as const)
        : ([
            [left, leftTarget],
            [right, rightTarget],
          ] as const);
      const first = await prepare(ordered[0][0], ordered[0][1]);
      const second = await prepare(ordered[1][0], ordered[1][1]);
      expect(
        `change-email-otp-${left.email}-${leftTarget}` ===
          `change-email-otp-${right.email}-${rightTarget}`,
      ).toBe(true);
      expect(
        (await proofKey(left, leftTarget)) ===
          (await proofKey(right, rightTarget)),
      ).toBe(false);
      expect(
        (await change(ordered[0][0], { ...first.body, code: second.nextCode }))
          .status,
      ).toBe(400);
      expect(
        (await change(ordered[1][0], { ...second.body, code: first.nextCode }))
          .status,
      ).toBe(400);
      expect((await change(ordered[1][0], second.body)).status).toBe(200);
      await world.owner.pool.query("UPDATE rate_limit SET count=0");
      expect((await change(ordered[0][0], first.body)).status).toBe(200);
    },
  );

  it("binds both proof stages to the exact session and rejects address/code swaps", async () => {
    const account = await createAccount(world);
    const cookie = cookieOf(await login(account));
    const otherSession = {
      ...account,
      cookie,
      headers: new Headers({ cookie }),
    };
    expect((await change(account)).status).toBe(200);
    const currentCode = await code(account.email, "email-change-current");
    expect(
      (
        await change(otherSession, {
          action: "request",
          newEmail: target(),
          code: currentCode,
        })
      ).status,
    ).toBe(400);
    const pending = await prepare(account);
    expect((await change(otherSession, pending.body)).status).toBe(400);
    expect(
      (await change(account, { ...pending.body, newEmail: target() })).status,
    ).toBe(400);
    expect((await change(account, pending.body)).status).toBe(200);
  });

  it.each(["start", "request", "confirm"] as const)(
    "fresh active verified authorization is rechecked at %s",
    async (action) => {
      for (const state of [
        "stale",
        "expired",
        "revoked",
        "suspended",
        "unverified",
      ] as const) {
        await world.owner.pool.query("UPDATE rate_limit SET count=0");
        const account = await createAccount(world);
        let body: unknown = { action: "start" };
        if (action === "request") {
          await change(account);
          body = {
            action,
            newEmail: target(),
            code: await code(account.email, "email-change-current"),
          };
        }
        if (action === "confirm") body = (await prepare(account)).body;
        const id = await sessionId(account);
        if (state === "stale")
          await world.owner.pool.query(
            "UPDATE session SET created_at=clock_timestamp()-interval '25 hours' WHERE id=$1",
            [id],
          );
        if (state === "expired")
          await world.owner.pool.query(
            "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
            [id],
          );
        if (state === "revoked")
          await world.owner.pool.query("DELETE FROM session WHERE id=$1", [id]);
        if (state === "suspended")
          await world.owner.pool.query(
            "UPDATE user_access SET status='suspended' WHERE user_id=$1",
            [account.id],
          );
        if (state === "unverified")
          await world.owner.pool.query(
            'UPDATE "user" SET email_verified=false WHERE id=$1',
            [account.id],
          );
        expect((await change(account, body)).status).toBe(
          ["expired", "revoked"].includes(state) ? 401 : 403,
        );
        expect((await saved(account)).email === account.email).toBe(true);
      }
    },
  );

  it("old pending proof cannot apply after the current email changes", async () => {
    const account = await createAccount(world);
    const first = await prepare(account);
    const second = await prepare(account);
    expect((await change(account, second.body)).status).toBe(200);
    expect((await change(account, first.body)).status).toBe(400);
    expect((await saved(account)).email === second.newEmail).toBe(true);
  });

  it("fails closed on unexpected plain OTP records without consuming or rewriting them", async () => {
    const account = await createAccount(world);
    const pending = await prepare(account);
    const identifier = `change-email-otp-${account.email}-${pending.newEmail}`;
    const id = randomUUID();
    await world.owner.pool.query(
      "INSERT INTO verification(id,identifier,value,expires_at,created_at,updated_at) VALUES($1,$2,$3,clock_timestamp()+interval '5 minutes',clock_timestamp(),clock_timestamp())",
      [id, identifier, "synthetic-unusable"],
    );
    try {
      expect((await change(account, pending.body)).status).toBe(503);
      expect(
        (
          await world.owner.pool.query(
            "SELECT 1 FROM verification WHERE id=$1",
            [id],
          )
        ).rowCount,
      ).toBe(1);
      expect((await saved(account)).email === account.email).toBe(true);
    } finally {
      // Owned test-fixture teardown only, after proving rejection and preservation.
      // Application never deletes/re-writes a plain record to complete a change.
      await world.owner.pool.query("DELETE FROM verification WHERE id=$1", [
        id,
      ]);
    }
  });

  it("actual concurrent provider HTTP consumes a final proof only once", async () => {
    const account = await createAccount(world);
    const pending = await prepare(account);
    const context = {
      userId: account.id,
      sessionId: await sessionId(account),
      currentEmail: account.email,
      newEmail: pending.newEmail,
    };
    const direct = () =>
      world.runtime.emailProofBinding.withContext(context, () =>
        world.runtime.auth.handler(
          jsonRequest(world, "/api/auth/email-otp/change-email", {
            cookie: account.cookie,
            body: { newEmail: pending.newEmail, otp: pending.nextCode },
          }),
        ),
      );
    const responses = await Promise.all([direct(), direct()]);
    expect(responses.filter((r) => r.status === 200).length).toBe(1);
    expect(responses.every((r) => [200, 400].includes(r.status))).toBe(true);
    expect((await saved(account)).email === pending.newEmail).toBe(true);
  });

  it("two legitimate sessions cannot exchange codes for the same address pair", async () => {
    const account = await createAccount(world);
    const cookie = cookieOf(await login(account));
    const other = { ...account, cookie, headers: new Headers({ cookie }) };
    const newEmail = target();
    const first = await prepare(account, newEmail);
    const second = await prepare(other, newEmail);
    expect(
      (await change(account, { ...first.body, code: second.nextCode })).status,
    ).toBe(400);
    expect(
      (await change(other, { ...second.body, code: first.nextCode })).status,
    ).toBe(400);
    expect((await change(account, first.body)).status).toBe(200);
    expect((await change(other, second.body)).status).toBe(401);
  });

  it("interleaved requests and confirmations preserve each captured proof namespace", async () => {
    const first = await createAccount(world);
    const second = await createAccount(world);
    const pending = await prepare(first);
    await change(second);
    const request = {
      action: "request",
      newEmail: target(),
      code: await code(second.email, "email-change-current"),
    };
    const results = await Promise.all([
      change(first, pending.body),
      change(second, request),
    ]);
    expect(results.every((r) => [200, 409].includes(r.status))).toBe(true);
    if (results[0].status === 409)
      expect((await change(first, pending.body)).status).toBe(200);
    if (results[1].status === 409)
      expect((await change(second, request)).status).toBe(200);
    const next = await code(request.newEmail, "email-change-new");
    expect(
      (await change(second, { ...request, action: "confirm", code: next }))
        .status,
    ).toBe(200);
  });

  it("preserves origin/host/CSRF/method/body gates and actual provider throttles", async () => {
    const account = await createAccount(world);
    expect((await change(undefined)).status).toBe(401);
    for (const mode of [
      "origin",
      "missing",
      "host",
      "content",
      "bounds",
      "method",
    ]) {
      const request = jsonRequest(world, "/api/account/email", {
        cookie: account.cookie,
        body:
          mode === "method"
            ? undefined
            : mode === "bounds"
              ? { action: "start", pad: "x".repeat(3000) }
              : { action: "start" },
        method: mode === "method" ? "GET" : "POST",
      });
      if (mode === "origin")
        request.headers.set("origin", "https://foreign.test");
      if (mode === "missing") request.headers.delete("origin");
      if (mode === "host") request.headers.set("host", "foreign.test");
      if (mode === "content") request.headers.set("content-type", "text/plain");
      const response = await handleAccountEmail(world.runtime, request);
      expect(response.status).toBe(
        mode === "method"
          ? 405
          : ["content", "bounds"].includes(mode)
            ? 400
            : 403,
      );
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    }
    for (let i = 0; i < 4; i++) {
      const request = jsonRequest(world, "/api/account/email", {
        cookie: account.cookie,
        body: { action: "start" },
      });
      request.headers.set("x-learli-local-ip", `192.0.2.${i}`);
      request.headers.set("x-forwarded-for", `192.0.2.${i}`);
      const response = await handleAccountEmail(world.runtime, request);
      expect(response.status).toBe(i < 3 ? 200 : 429);
      if (i === 3)
        expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    }
  });

  it("real revocation failure reports partial completion and preserves current access for recovery", async () => {
    const account = await createAccount(world);
    await login(account);
    const pending = await prepare(account);
    const name = `email_failure_${randomUUID().replaceAll("-", "")}`;
    await world.owner.pool.query(
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN IF OLD.user_id=TG_ARGV[0] THEN RAISE EXCEPTION 'Synthetic revocation failure'; END IF; RETURN OLD; END $f$`,
    );
    try {
      await world.owner.pool.query(
        `CREATE TRIGGER ${name} BEFORE DELETE ON session FOR EACH ROW EXECUTE FUNCTION ${name}('${account.id}')`,
      );
      const response = await change(account, pending.body);
      expect(response.status).toBe(503);
      expect((await response.json()).code).toBe("CHANGE_UNCERTAIN");
      expect(response.headers.getSetCookie().length > 0).toBe(true);
      expect((await saved(account)).email === pending.newEmail).toBe(true);
      expect(
        (
          await world.owner.pool.query(
            "SELECT 1 FROM session WHERE user_id=$1",
            [account.id],
          )
        ).rowCount,
      ).toBe(2);
      expect(
        Boolean(
          await world.runtime.auth.api.getSession({ headers: account.headers }),
        ),
      ).toBe(true);
    } finally {
      await world.owner.pool.query(`DROP TRIGGER IF EXISTS ${name} ON session`);
      await world.owner.pool.query(`DROP FUNCTION ${name}()`);
    }
  });
});
