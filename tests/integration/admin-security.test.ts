import { afterAll, beforeAll, beforeEach, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { localMailbox, type LocalMessage } from "@/lib/email/local-mail";
import { createLocalAuth, type LocalAuthRuntime } from "@/lib/auth-factory";
import { createDatabase } from "@/lib/db/connection";
import { handleAuthRequest } from "@/lib/auth-handler";
import { requireAdminAssurance } from "@/features/admin-security/assurance";
import { readAdminSecurity } from "@/features/admin-security/state";
import {
  renameSpecializedSubject,
  createSpecializedSubject,
  listSubjectsForAdmin,
} from "@/features/subjects/service";
import { requireIdentity } from "@/lib/permissions/access";
import { queryModeratorReviews } from "@/features/private-reviews/query";
import { mergeCookies, mfaRequest, totpCode } from "../support/admin-mfa";

let runtime: LocalAuthRuntime, owner: ReturnType<typeof createDatabase>;
const password = "Synthetic-W1-passphrase-123";
const headers = (cookie: string) =>
  new Headers({ cookie, origin: runtime.origin });
function call(route: string, body: unknown, cookie = "") {
  return handleAuthRequest(
    runtime,
    new Request(`${runtime.origin}/api/auth/${route}`, {
      method: "POST",
      headers: {
        origin: runtime.origin,
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
}
async function actor(admin = true) {
  const email = `w1-${randomUUID()}@learli.test`;
  const signup = await call("sign-up/email", {
    email,
    password,
    name: "Synthetic W1 admin",
  });
  if (!signup.ok) throw new Error("Synthetic provider signup refused.");
  const id = (await signup.json()).user.id as string;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    id,
  ]);
  if (admin)
    await owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
      [id],
    );
  const response = await call("sign-in/email", { email, password });
  if (!response.ok) throw new Error("Synthetic provider sign-in refused.");
  return { email, id, cookie: mergeCookies("", response) };
}
async function enrolled() {
  const a = await actor();
  const oldCookie = a.cookie;
  const enabled = await mfaRequest(runtime, "enable", a.cookie, { password });
  if (!enabled.ok) throw new Error("Synthetic enrollment refused.");
  const setup = (await enabled.json()) as {
    secret: string;
    backupCodes: string[];
  };
  a.cookie = mergeCookies(a.cookie, enabled);
  const verified = await mfaRequest(runtime, "verify-totp", a.cookie, {
    code: totpCode(setup.secret),
  });
  if (!verified.ok) throw new Error("Synthetic verification refused.");
  a.cookie = mergeCookies(a.cookie, verified);
  return { ...a, ...setup, oldCookie };
}
async function pending(a: { email: string; cookie: string }) {
  await call("sign-out", {}, a.cookie);
  const response = await call("sign-in/email", { email: a.email, password });
  expect(response.status).toBe(200);
  expect((await response.json()).twoFactorRedirect).toBe(true);
  return mergeCookies("", response);
}
async function capture(email: string, kind: LocalMessage["kind"]) {
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
  throw new Error("Owned synthetic provider capture missing.");
}
beforeAll(() => {
  owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
  runtime = createLocalAuth(process.env);
});
beforeEach(async () => {
  await owner.pool.query("UPDATE rate_limit SET count=0");
});
afterAll(async () => {
  await runtime.pool.end();
  await owner.pool.end();
});
describe("actual provider administrator MFA", () => {
  it.each([
    ["generate-backup-codes", "session"],
    ["generate-backup-codes", "role"],
    ["generate-backup-codes", "suspension"],
    ["generate-backup-codes", "freshness"],
    ["generate-backup-codes", "epoch"],
    ["disable", "role"],
    ["disable", "freshness"],
    ["enable", "session"],
    ["enable", "role"],
    ["enable", "verification"],
    ["enable", "suspension"],
  ])(
    "factor %s denies %s loss after an actually observed epoch-row wait",
    async (action, revocation) => {
      const a = action === "enable" ? await actor() : await enrolled();
      if (action === "enable")
        await owner.pool.query(
          "INSERT INTO admin_security_epochs(user_id,epoch) VALUES($1,1)",
          [a.id],
        );
      const snapshot = async () =>
        (
          await owner.pool.query(
            `SELECT
      (SELECT epoch FROM admin_security_epochs WHERE user_id=$1) AS epoch,
      (SELECT count(*)::int FROM admin_security_events WHERE user_id=$1) AS events,
      (SELECT md5(secret||backup_codes) FROM two_factor WHERE user_id=$1) AS factor,
      (SELECT two_factor_enabled FROM "user" WHERE id=$1) AS enabled`,
            [a.id],
          )
        ).rows[0];
      const blocker = await owner.pool.connect();
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT user_id FROM admin_security_epochs WHERE user_id=$1 FOR UPDATE",
        [a.id],
      );
      const attempt = mfaRequest(runtime, action, a.cookie, { password });
      try {
        let observed = false;
        for (let i = 0; i < 100; i++) {
          const r = await owner.pool.query(
            "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND usename='learli_app' AND wait_event_type='Lock' AND query LIKE '%admin_security_epochs%' LIMIT 1",
          );
          if (r.rowCount) {
            observed = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        if (!observed) throw new Error("Actual epoch-row wait not observed.");
        const statements: Record<string, string> = {
          session: "DELETE FROM session WHERE user_id=$1",
          role: "DELETE FROM user_roles WHERE user_id=$1 AND role='admin'",
          suspension:
            "UPDATE user_access SET status='suspended' WHERE user_id=$1",
          verification: 'UPDATE "user" SET email_verified=false WHERE id=$1',
          freshness:
            "UPDATE admin_assurance_receipts SET verified_at=now()-interval '6 minutes' WHERE user_id=$1",
          epoch:
            "UPDATE admin_security_epochs SET epoch=epoch+1 WHERE user_id=$1",
        };
        if (revocation === "epoch")
          await blocker.query(statements[revocation], [a.id]);
        else await owner.pool.query(statements[revocation], [a.id]);
        const expected =
          revocation === "epoch"
            ? (
                await blocker.query(
                  "SELECT epoch FROM admin_security_epochs WHERE user_id=$1",
                  [a.id],
                )
              ).rows[0].epoch
            : (await snapshot()).epoch;
        const before = await snapshot();
        await blocker.query("COMMIT");
        expect((await attempt).status).toBe(403);
        expect(await snapshot()).toEqual({ ...before, epoch: expected });
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
      }
    },
  );
  it("actual provider MFA HTTP throttling remains active for repeated wrong codes", async () => {
    const a = await enrolled(),
      cookie = await pending(a);
    await owner.pool.query("UPDATE rate_limit SET count=0");
    const code = totpCode(a.secret, Date.now() - 300000);
    for (let i = 0; i < 3; i++)
      expect(
        (await mfaRequest(runtime, "verify-totp", cookie, { code })).status,
      ).toBe(401);
    expect(
      (await mfaRequest(runtime, "verify-totp", cookie, { code })).status,
    ).toBe(429);
    expect(
      await runtime.auth.api.getSession({ headers: headers(cookie) }),
    ).toBeNull();
  });
  it("reset-password and email verification never grant assurance or bypass the retained factor", async () => {
    const a = await enrolled();
    expect(
      (
        await call("request-password-reset", {
          email: a.email,
          redirectTo: "/reset-password",
        })
      ).status,
    ).toBe(200);
    const reset = await capture(a.email, "reset"),
      token = new URL(reset.url).pathname.split("/").at(-1)!;
    const changed = await call("reset-password", {
      token,
      newPassword: password,
    });
    expect(changed.status).toBe(200);
    await expect(
      requireAdminAssurance(runtime, headers(a.cookie)),
    ).rejects.toBeDefined();
    const verification = await capture(a.email, "verification");
    const verify = await handleAuthRequest(
      runtime,
      new Request(verification.url),
    );
    expect([200, 302]).toContain(verify.status);
    const signIn = await call("sign-in/email", { email: a.email, password });
    expect((await signIn.json()).twoFactorRedirect).toBe(true);
    const challenge = mergeCookies("", signIn);
    expect(
      await runtime.auth.api.getSession({ headers: headers(challenge) }),
    ).toBeNull();
    expect(
      (
        await mfaRequest(runtime, "verify-totp", challenge, {
          code: totpCode(a.secret),
        })
      ).status,
    ).toBe(200);
  });
  it("a revoked admin role can still complete its actual factor for ordinary account access without assurance", async () => {
    const a = await enrolled();
    await owner.pool.query(
      "DELETE FROM user_roles WHERE user_id=$1 AND role='admin'",
      [a.id],
    );
    const cookie = await pending(a),
      result = await mfaRequest(runtime, "verify-totp", cookie, {
        code: totpCode(a.secret),
      });
    expect(result.status).toBe(200);
    const signed = mergeCookies(cookie, result);
    expect(
      await runtime.auth.api.getSession({ headers: headers(signed) }),
    ).not.toBeNull();
    await owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
      [a.id],
    );
    await expect(
      requireAdminAssurance(runtime, headers(signed)),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("provider session-creation partial failure never grants administrator access", async () => {
    const a = await enrolled(),
      cookie = await pending(a);
    await owner.pool.query("REVOKE INSERT ON public.session FROM learli_app");
    try {
      expect(
        (
          await mfaRequest(runtime, "verify-totp", cookie, {
            code: totpCode(a.secret),
          })
        ).status,
      ).toBe(503);
    } finally {
      await owner.pool.query("GRANT INSERT ON public.session TO learli_app");
    }
    expect(
      await runtime.auth.api.getSession({ headers: headers(cookie) }),
    ).toBeNull();
    const retry = await pending(a),
      result = await mfaRequest(runtime, "verify-totp", retry, {
        code: totpCode(a.secret),
      });
    expect(result.status).toBe(200);
  });
  it("denies existing and newly granted ordinary sessions until verified enrollment replaces the session", async () => {
    const a = await actor(false);
    await owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
      [a.id],
    );
    await expect(
      requireAdminAssurance(runtime, headers(a.cookie)),
    ).rejects.toMatchObject({ status: 403 });
    const enabled = await mfaRequest(runtime, "enable", a.cookie, { password });
    expect(enabled.status).toBe(200);
    const setup = await enabled.json();
    expect((await readAdminSecurity(runtime, headers(a.cookie))).assured).toBe(
      false,
    );
    expect(
      (
        await mfaRequest(runtime, "verify-totp", a.cookie, {
          code: totpCode(setup.secret, Date.now() - 300000),
        })
      ).status,
    ).toBe(401);
    await expect(
      listSubjectsForAdmin(runtime, headers(a.cookie)),
    ).rejects.toMatchObject({ status: 403 });
    const success = await mfaRequest(runtime, "verify-totp", a.cookie, {
      code: totpCode(setup.secret),
    });
    expect(success.status).toBe(200);
    expect(await success.json()).toEqual({ verified: true });
    const cookie = mergeCookies(a.cookie, success);
    expect((await requireAdminAssurance(runtime, headers(cookie))).userId).toBe(
      a.id,
    );
    await expect(
      requireAdminAssurance(runtime, headers(a.cookie)),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("password challenge has no authenticated session and only real TOTP grants access", async () => {
    const a = await enrolled(),
      cookie = await pending(a);
    expect(
      await runtime.auth.api.getSession({ headers: headers(cookie) }),
    ).toBeNull();
    const result = await mfaRequest(runtime, "verify-totp", cookie, {
      code: totpCode(a.secret),
    });
    expect(result.status).toBe(200);
    const verifiedCookie = mergeCookies(cookie, result);
    expect(
      (await requireAdminAssurance(runtime, headers(verifiedCookie))).userId,
    ).toBe(a.id);
    const subject = await createSpecializedSubject(
      runtime,
      headers(verifiedCookie),
      { name: `Synthetic ${randomUUID()}` },
    );
    expect(subject.category).toBe("specialized");
  });
  it("refuses missing, foreign-factor, expired and reused challenges", async () => {
    const a = await enrolled(),
      b = await enrolled();
    await owner.pool.query("UPDATE rate_limit SET count=0");
    const c = await pending(a);
    expect(
      (
        await mfaRequest(runtime, "verify-totp", "", {
          code: totpCode(a.secret),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await mfaRequest(runtime, "verify-totp", c, {
          code: totpCode(b.secret),
        })
      ).status,
    ).toBe(401);
    await owner.pool.query(
      "UPDATE verification SET expires_at=now()-interval '1 minute' WHERE value=$1",
      [a.id],
    );
    expect(
      (
        await mfaRequest(runtime, "verify-totp", c, {
          code: totpCode(a.secret),
        })
      ).status,
    ).toBe(403);
    await owner.pool.query("UPDATE rate_limit SET count=0");
    const d = await pending(b),
      success = await mfaRequest(runtime, "verify-totp", d, {
        code: totpCode(b.secret),
      });
    expect(success.status).toBe(200);
    expect(
      (
        await mfaRequest(runtime, "verify-totp", d, {
          code: totpCode(b.secret),
        })
      ).status,
    ).toBe(403);
  });
  it("provider recovery is single-use under concurrent requests and later reuse", async () => {
    const a = await enrolled(),
      cookie = await pending(a);
    const results = await Promise.all([
      mfaRequest(runtime, "verify-backup-code", cookie, {
        code: a.backupCodes[0],
      }),
      mfaRequest(runtime, "verify-backup-code", cookie, {
        code: a.backupCodes[0],
      }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    const success = results.find((r) => r.ok)!;
    const verifiedCookie = mergeCookies(cookie, success);
    await requireAdminAssurance(runtime, headers(verifiedCookie));
    const next = await pending({ ...a, cookie: verifiedCookie });
    expect(
      (
        await mfaRequest(runtime, "verify-backup-code", next, {
          code: a.backupCodes[0],
        })
      ).status,
    ).toBe(401);
    expect(
      await runtime.auth.api.getSession({ headers: headers(next) }),
    ).toBeNull();
  });
  it("requires actual password and fresh factor for rotation; invalidates old receipts/codes", async () => {
    const a = await enrolled();
    expect(
      (
        await mfaRequest(runtime, "generate-backup-codes", a.cookie, {
          password: "wrong",
        })
      ).status,
    ).toBe(400);
    await requireAdminAssurance(runtime, headers(a.cookie));
    await owner.pool.query(
      "UPDATE admin_assurance_receipts SET verified_at=now()-interval '6 minutes' WHERE user_id=$1",
      [a.id],
    );
    expect(
      (
        await mfaRequest(runtime, "generate-backup-codes", a.cookie, {
          password,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await mfaRequest(runtime, "verify-totp", a.cookie, {
          code: totpCode(a.secret),
        })
      ).status,
    ).toBe(200);
    const rotate = await mfaRequest(
      runtime,
      "generate-backup-codes",
      a.cookie,
      { password },
    );
    expect(rotate.status).toBe(200);
    const codes = (await rotate.json()).backupCodes;
    await expect(
      requireAdminAssurance(runtime, headers(a.cookie)),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (
        await mfaRequest(runtime, "verify-backup-code", a.cookie, {
          code: a.backupCodes[0],
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await mfaRequest(runtime, "verify-backup-code", a.cookie, {
          code: codes[0],
        })
      ).status,
    ).toBe(200);
  });
  it("disable removes assurance and replacement enrollment never creates a password-only admin window", async () => {
    const a = await enrolled();
    const disabled = await mfaRequest(runtime, "disable", a.cookie, {
      password,
    });
    expect(disabled.status).toBe(200);
    const cookie = mergeCookies(a.cookie, disabled);
    await expect(
      requireAdminAssurance(runtime, headers(cookie)),
    ).rejects.toMatchObject({ status: 403 });
    expect((await readAdminSecurity(runtime, headers(cookie))).enrolled).toBe(
      false,
    );
    expect(
      (await mfaRequest(runtime, "disable", cookie, { password })).status,
    ).toBe(403);
    const setup = await mfaRequest(runtime, "enable", cookie, { password });
    expect(setup.status).toBe(200);
    await expect(
      requireAdminAssurance(runtime, headers(cookie)),
    ).rejects.toMatchObject({ status: 403 });
    const secret = (await setup.json()).secret;
    expect(
      (
        await mfaRequest(runtime, "verify-totp", cookie, {
          code: totpCode(secret),
        })
      ).status,
    ).toBe(200);
  });
  it("no fallback, trust-device, disableSession, issuer, forged role or raw provider API bypass", async () => {
    const a = await enrolled();
    for (const [path, input] of [
      ["send-otp", {}],
      ["verify-otp", { code: "123456" }],
      ["verify-totp", { code: "123456", trustDevice: true }],
      ["verify-backup-code", { code: a.backupCodes[0], disableSession: true }],
      ["enable", { password, issuer: "Other" }],
    ] as const)
      expect([400, 404]).toContain(
        (await mfaRequest(runtime, path, a.cookie, input)).status,
      );
    await expect(
      runtime.auth.api.verifyTOTP({
        headers: headers(a.cookie),
        body: { code: totpCode(a.secret) },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    const nonAdmin = await actor(false);
    expect(
      (await mfaRequest(runtime, "enable", nonAdmin.cookie, { password }))
        .status,
    ).toBe(403);
  });
  it.each([
    "epoch",
    "role",
    "time",
    "future",
    "session",
    "suspension",
    "verification",
    "factor",
  ])("rechecks current %s and SQL projection", async (kind) => {
    const a = await enrolled(),
      identity = await requireIdentity(runtime, headers(a.cookie));
    const statements: Record<string, string> = {
      epoch: "UPDATE admin_security_epochs SET epoch=epoch+1 WHERE user_id=$1",
      role: "DELETE FROM user_roles WHERE user_id=$1 AND role='admin'",
      time: "UPDATE admin_assurance_receipts SET verified_at=now()-interval '9 hours' WHERE user_id=$1",
      future:
        "UPDATE admin_assurance_receipts SET verified_at=now()+interval '1 minute' WHERE user_id=$1",
      session:
        "UPDATE session SET expires_at=now()-interval '1 minute' WHERE user_id=$1",
      suspension: "UPDATE user_access SET status='suspended' WHERE user_id=$1",
      verification: 'UPDATE "user" SET email_verified=false WHERE id=$1',
      factor: "UPDATE two_factor SET verified=false WHERE user_id=$1",
    };
    await owner.pool.query(statements[kind], [a.id]);
    await expect(
      requireAdminAssurance(runtime, headers(a.cookie)),
    ).rejects.toBeDefined();
    expect(await queryModeratorReviews(runtime.db, identity)).toEqual([]);
    expect(
      (
        await runtime.pool.query(
          "SELECT public.has_admin_assurance($1,$2,28800) AS allowed",
          [a.id, identity.sessionId],
        )
      ).rows[0].allowed,
    ).toBe(false);
  });
  it("a new role grant cannot reuse prior assurance", async () => {
    const a = await enrolled();
    await owner.pool.query(
      "DELETE FROM user_roles WHERE user_id=$1 AND role='admin'",
      [a.id],
    );
    await owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
      [a.id],
    );
    await expect(
      requireAdminAssurance(runtime, headers(a.cookie)),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("partial assurance failure forwards provider cookies but denies access and can safely retry real verification", async () => {
    const a = await enrolled(),
      cookie = await pending(a);
    await owner.pool.query(
      "CREATE FUNCTION public.w1_fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic failure'; END $$; CREATE TRIGGER w1_receipt_failure BEFORE INSERT OR UPDATE ON public.admin_assurance_receipts FOR EACH ROW EXECUTE FUNCTION public.w1_fail_receipt()",
    );
    let result: Response;
    try {
      result = await mfaRequest(runtime, "verify-totp", cookie, {
        code: totpCode(a.secret),
      });
      expect(result.status).toBe(503);
      expect(result.headers.getSetCookie().length).toBeGreaterThan(0);
    } finally {
      await owner.pool.query(
        "DROP TRIGGER w1_receipt_failure ON public.admin_assurance_receipts; DROP FUNCTION public.w1_fail_receipt()",
      );
    }
    const newCookie = mergeCookies(cookie, result!);
    expect(
      await runtime.auth.api.getSession({ headers: headers(newCookie) }),
    ).not.toBeNull();
    await expect(
      requireAdminAssurance(runtime, headers(newCookie)),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (
        await mfaRequest(runtime, "verify-totp", newCookie, {
          code: totpCode(a.secret),
        })
      ).status,
    ).toBe(200);
    await requireAdminAssurance(runtime, headers(newCookie));
  });
  it("rechecks revocation after waiting for an administrative domain lock", async () => {
    const a = await enrolled(),
      subject = await createSpecializedSubject(runtime, headers(a.cookie), {
        name: `Wait ${randomUUID()}`,
      });
    const lock = await owner.pool.connect();
    await lock.query("BEGIN");
    await lock.query("SELECT id FROM subjects WHERE id=$1 FOR UPDATE", [
      subject.id,
    ]);
    const attempt = renameSpecializedSubject(
      runtime,
      headers(a.cookie),
      subject.id,
      { name: "Forbidden after wait", expectedRevision: 0 },
    ).then(
      () => ({ ok: true }),
      () => ({ ok: false }),
    );
    try {
      for (let i = 0; i < 100; i++) {
        const waiting = await owner.pool.query(
          "SELECT 1 FROM pg_stat_activity WHERE usename='learli_app' AND wait_event_type='Lock' AND query LIKE '%subjects%' LIMIT 1",
        );
        if (waiting.rowCount) break;
        await new Promise((r) => setTimeout(r, 10));
        if (i === 99) throw new Error("Owned domain wait unobserved.");
      }
      await owner.pool.query(
        "UPDATE admin_security_epochs SET epoch=epoch+1 WHERE user_id=$1",
        [a.id],
      );
      await lock.query("COMMIT");
      expect((await attempt).ok).toBe(false);
      expect(
        (
          await owner.pool.query("SELECT name FROM subjects WHERE id=$1", [
            subject.id,
          ])
        ).rows[0].name,
      ).toBe(subject.name);
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
    }
  });
});
