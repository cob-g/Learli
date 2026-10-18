import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { type LocalAuthRuntime } from "@/lib/auth-factory";
import { createDatabase } from "@/lib/db/connection";
import { handleAuthRequest } from "@/lib/auth-handler";
import { handleAccountEmail } from "@/features/account-email/handler";
import { readAccount } from "@/features/account/service";
import { type LocalMessage } from "@/lib/email/local-mail";
import { openOperationFixture } from "./support";

let runtime: LocalAuthRuntime;
let owner: ReturnType<typeof createDatabase>;
let fixture: string;
const password = "Local-fixture-only-passphrase-123";
const mailFiles = new Set<string>();

function cookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((part) => part.split(";")[0])
    .join("; ");
}
function authRequest(route: string, body?: unknown, currentCookie?: string) {
  return handleAuthRequest(
    runtime,
    new Request(`${runtime.origin}/api/auth/${route}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        origin: runtime.origin,
        "content-type": "application/json",
        ...(currentCookie ? { cookie: currentCookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function capture(email: string, kind: LocalMessage["kind"]) {
  const directory = path.join(fixture, ".local/mail/development");
  for (const file of (await readdir(directory))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse()) {
    const mail = JSON.parse(
      await readFile(path.join(directory, file), "utf8"),
    ) as LocalMessage;
    if (mail.to === email && mail.kind === kind) {
      mailFiles.add(file);
      return mail;
    }
  }
  throw new Error("Expected an actual private fixture capture.");
}
async function register(verify = true) {
  const email = `local-${randomUUID()}@example.invalid`;
  const response = await authRequest("sign-up/email", {
    name: "Local fixture account",
    email,
    password,
    callbackURL: "/account",
  });
  expect(response.status).toBe(200);
  const body = await response.json();
  if (verify) {
    const mail = await capture(email, "verification");
    expect(
      (await handleAuthRequest(runtime, new Request(mail.url))).status,
    ).toBe(302);
  }
  return { email, id: body.user.id as string };
}
async function login(email: string, currentPassword = password) {
  const response = await authRequest("sign-in/email", {
    email,
    password: currentPassword,
  });
  expect(response.status).toBe(200);
  return cookie(response);
}
function emailChange(currentCookie: string, body: unknown) {
  return handleAccountEmail(
    runtime,
    new Request(`${runtime.origin}/api/account/email`, {
      method: "POST",
      headers: {
        origin: runtime.origin,
        cookie: currentCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
}

beforeAll(() => {
  const world = openOperationFixture();
  ({ fixture, owner, runtime } = world);
  // Captures belong to this test fixture, never the user's operating mailbox.
  vi.spyOn(process, "cwd").mockReturnValue(fixture);
});
afterAll(async () => {
  vi.restoreAllMocks();
  await runtime?.pool.end();
  await owner?.pool.end();
});

describe("actual provider ordinary local account lifecycle on isolated PostgreSQL", () => {
  it("requires actual verification, starts without roles and preserves duplicate privacy", async () => {
    const account = await register(false);
    expect(
      (await authRequest("sign-in/email", { email: account.email, password }))
        .status,
    ).toBe(403);
    const mail = await capture(account.email, "verification");
    expect(new URL(mail.url).origin).toBe(runtime.origin);
    expect(
      (await handleAuthRequest(runtime, new Request(mail.url))).status,
    ).toBe(302);
    const currentCookie = await login(account.email);
    expect(
      await readAccount(runtime, new Headers({ cookie: currentCookie })),
    ).toMatchObject({ id: account.id, email: account.email, roles: [] });
    const created = await owner.pool.query(
      "SELECT count(*)::int AS count FROM audit_events WHERE target_user_id=$1 AND action='account.created'",
      [account.id],
    );
    expect(created.rows[0].count).toBe(1);
    const duplicate = await authRequest("sign-up/email", {
      name: "Local fixture account",
      email: account.email,
      password,
      callbackURL: "/account",
    });
    const fresh = await authRequest("sign-up/email", {
      name: "Local fixture account",
      email: `local-${randomUUID()}@example.invalid`,
      password,
      callbackURL: "/account",
    });
    expect(duplicate.status).toBe(fresh.status);
    expect(Object.keys(await duplicate.json()).sort()).toEqual(
      Object.keys(await fresh.json()).sort(),
    );
  });

  it("recovers with one-use reset proof, revokes old sessions and ends current access on logout", async () => {
    const account = await register();
    const first = await login(account.email);
    const second = await login(account.email);
    const known = await authRequest("request-password-reset", {
      email: account.email,
      redirectTo: "/reset-password",
    });
    const unknown = await authRequest("request-password-reset", {
      email: `missing-${randomUUID()}@example.invalid`,
      redirectTo: "/reset-password",
    });
    expect(known.status).toBe(unknown.status);
    expect(await known.json()).toEqual(await unknown.json());
    const mail = await capture(account.email, "reset");
    const callback = await handleAuthRequest(runtime, new Request(mail.url));
    const token = new URL(
      callback.headers.get("location")!,
      runtime.origin,
    ).searchParams.get("token");
    const newPassword = "Local-new-fixture-passphrase-456";
    expect(
      (await authRequest("reset-password", { token, newPassword })).status,
    ).toBe(200);
    expect(
      (await authRequest("reset-password", { token, newPassword })).status,
    ).toBe(400);
    for (const old of [first, second])
      await expect(
        readAccount(runtime, new Headers({ cookie: old })),
      ).rejects.toMatchObject({ status: 401 });
    expect(
      (await authRequest("sign-in/email", { email: account.email, password }))
        .status,
    ).toBe(401);
    const current = await login(account.email, newPassword);
    expect((await authRequest("sign-out", {}, current)).status).toBe(200);
    await expect(
      readAccount(runtime, new Headers({ cookie: current })),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("binds both address proofs to the exact current session, keeps it and revokes other sessions", async () => {
    const account = await register();
    const current = await login(account.email);
    const other = await login(account.email);
    const newEmail = `changed-${randomUUID()}@example.invalid`;
    expect((await emailChange(current, { action: "start" })).status).toBe(200);
    const oldMail = await capture(account.email, "email-change-current");
    if (!("otp" in oldMail)) throw new Error("Expected current-address code.");
    expect(
      (
        await emailChange(other, {
          action: "request",
          newEmail,
          code: oldMail.otp,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await emailChange(current, {
          action: "request",
          newEmail,
          code: oldMail.otp,
        })
      ).status,
    ).toBe(200);
    const newMail = await capture(newEmail, "email-change-new");
    if (!("otp" in newMail)) throw new Error("Expected new-address code.");
    expect(
      (await readAccount(runtime, new Headers({ cookie: current }))).email,
    ).toBe(account.email);
    const response = await emailChange(current, {
      action: "confirm",
      newEmail,
      code: newMail.otp,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: true, stage: "complete" });
    const updatedCookie = cookie(response) || current;
    expect(
      (await readAccount(runtime, new Headers({ cookie: updatedCookie })))
        .email,
    ).toBe(newEmail);
    await expect(
      readAccount(runtime, new Headers({ cookie: other })),
    ).rejects.toMatchObject({ status: 401 });
    expect(
      (
        await emailChange(updatedCookie, {
          action: "confirm",
          newEmail,
          code: newMail.otp,
        })
      ).status,
    ).toBe(400);
    expect(
      (await authRequest("sign-in/email", { email: account.email, password }))
        .status,
    ).toBe(401);
    await login(newEmail);
  });

  it("reports an actual provider capture failure and recovers the already-saved unverified account", async () => {
    const failureRoot = await mkdtemp(path.join(fixture, "capture-refusal-"));
    await mkdir(path.join(failureRoot, ".local"), { mode: 0o755 });
    const email = `capture-failure-${randomUUID()}@example.invalid`;
    vi.mocked(process.cwd).mockReturnValue(failureRoot);
    let response: Response;
    try {
      response = await authRequest("sign-up/email", {
        name: "Capture recovery account",
        email,
        password,
        callbackURL: "/account",
      });
    } finally {
      vi.mocked(process.cwd).mockReturnValue(fixture);
    }
    expect(response.status).toBe(503);
    const saved = await owner.pool.query(
      'SELECT u.email_verified,(SELECT count(*)::int FROM user_roles r WHERE r.user_id=u.id) AS roles FROM "user" u WHERE email=$1',
      [email],
    );
    expect(saved.rows).toEqual([{ email_verified: false, roles: 0 }]);
    expect(await readdir(path.join(failureRoot, ".local"))).toEqual([]);
    expect(
      (
        await authRequest("send-verification-email", {
          email,
          callbackURL: "/account",
        })
      ).status,
    ).toBe(200);
    const message = await capture(email, "verification");
    expect(
      (await handleAuthRequest(runtime, new Request(message.url))).status,
    ).toBe(302);
    const verified = await owner.pool.query(
      'SELECT email_verified FROM "user" WHERE email=$1',
      [email],
    );
    expect(verified.rows).toEqual([{ email_verified: true }]);
  });
});
