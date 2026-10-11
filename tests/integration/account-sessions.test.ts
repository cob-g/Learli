import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createLocalAuth } from "@/lib/auth-factory";
import { handleAuthRequest } from "@/lib/auth-handler";
import { handleAccountRequest } from "@/features/account/handler";
import { handleAccountSessions } from "@/features/account-sessions/handler";
import { handleDemoBookingCreate } from "@/features/bookings/handler";
import { handleSupportRequest } from "@/features/support/handler";
import { randomUUID } from "node:crypto";
import type { AccountSession } from "@/features/account-sessions/model";
import { session, user, userAccess } from "@/lib/db/schema";
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
async function secondSession(account: TestAccount) {
  const response = await handleAuthRequest(
    world.runtime,
    jsonRequest(world, "/api/auth/sign-in/email", {
      body: { email: account.email, password },
    }),
  );
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { cookie, headers: new Headers({ cookie }) };
}
async function providerSession(headers: Headers) {
  const value = await world.runtime.auth.api.getSession({ headers });
  if (!value) throw new Error("Expected a synthetic test session.");
  return value.session;
}
const list = (cookie?: string) =>
  handleAccountSessions(
    world.runtime,
    jsonRequest(world, "/api/account/sessions", { method: "GET", cookie }),
    "list",
  );
const revoke = (cookie: string | undefined, body: unknown, origin?: string) =>
  handleAccountSessions(
    world.runtime,
    jsonRequest(world, "/api/account/sessions/revoke", {
      cookie,
      body,
      origin,
    }),
    "revoke",
  );

describe("real provider-owned account sessions", () => {
  beforeAll(() => {
    world = openWorld();
  });
  beforeEach(async () => {
    await world.owner.pool.query("UPDATE rate_limit SET count = 0");
  });
  afterAll(() => closeWorld(world));

  it("lists two independent sessions and only explicit safe fields, current first", async () => {
    const account = await createAccount(world);
    const other = await secondSession(account);
    const own = await providerSession(account.headers);
    const remote = await providerSession(other.headers);
    expect(own.id).not.toBe(remote.id);
    expect(own.token === remote.token).toBe(false);
    await world.owner.db
      .update(session)
      .set({
        userAgent: "Mozilla/5.0 (Macintosh) Chrome/130.0 private-ua-secret",
        ipAddress: "192.0.2.1",
      })
      .where(eq(session.id, remote.id));
    const response = await list(account.cookie);
    expect(response.status).toBe(200);
    const text = await response.text();
    for (const privateValue of [
      own.token,
      remote.token,
      account.id,
      "192.0.2.1",
      "private-ua-secret",
    ])
      expect(text.includes(privateValue)).toBe(false);
    const result = JSON.parse(text) as { sessions: AccountSession[] };
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0].id).toBe(own.id);
    expect(result.sessions[0].current).toBe(true);
    expect(result.sessions[1].current).toBe(false);
    expect(result.sessions[1].reportedDevice).toBe("Chrome on macOS");
    expect(Object.keys(result.sessions[0]).sort()).toEqual(
      [
        "id",
        "current",
        "reportedDevice",
        "createdAt",
        "updatedAt",
        "expiresAt",
      ].sort(),
    );
  });

  it("revokes own other session and immediately denies its cookie at protected reads/writes", async () => {
    const account = await createAccount(world);
    const other = await secondSession(account);
    const target = await providerSession(other.headers);
    expect(
      (await revoke(account.cookie, { sessionId: target.id })).status,
    ).toBe(200);
    expect(
      await world.runtime.auth.api.getSession({ headers: other.headers }),
    ).toBeNull();
    expect((await list(other.cookie)).status).toBe(401);
    // Integration boundary: revoked provider identity cannot reach newly imported services.
    expect(
      (
        await handleDemoBookingCreate(
          world.runtime,
          jsonRequest(world, "/api/bookings/demo", {
            cookie: other.cookie,
            body: {
              learnerId: randomUUID(),
              tutorSlug: "synthetic-tutor",
              subjectSlug: "math",
              displayTimezone: "UTC",
              startAtUtc: "2026-10-15T08:00:00.000Z",
              endAtUtc: "2026-10-15T09:00:00.000Z",
              idempotencyKey: randomUUID(),
            },
          }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await handleSupportRequest(
          world.runtime,
          jsonRequest(world, "/api/support", {
            cookie: other.cookie,
            body: {
              requestKey: randomUUID(),
              category: "general",
              subject: "Synthetic revoked request",
              body: "Fictional integration check",
            },
          }),
          "requester",
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await handleAccountRequest(
          world.runtime,
          jsonRequest(world, `/api/account/${account.id}`, {
            method: "GET",
            cookie: other.cookie,
          }),
          account.id,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await handleAccountRequest(
          world.runtime,
          jsonRequest(world, `/api/account/${account.id}`, {
            method: "PATCH",
            cookie: other.cookie,
            body: { name: "Forged", timezone: "UTC" },
          }),
          account.id,
        )
      ).status,
    ).toBe(401);
    expect((await list(account.cookie)).status).toBe(200);
    expect(
      (await revoke(account.cookie, { sessionId: target.id })).status,
    ).toBe(404);
  });

  it("gives identical foreign and missing refusal, including admin, and rejects token tampering", async () => {
    const attacker = await createAccount(world, ["admin"]);
    const victim = await createAccount(world);
    const target = await providerSession(victim.headers);
    const foreign = await revoke(attacker.cookie, { sessionId: target.id });
    const absent = await revoke(attacker.cookie, { sessionId: "missing" });
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toEqual(await absent.json());
    expect(
      (await revoke(attacker.cookie, { sessionId: target.token })).status,
    ).toBe(404);
    expect(
      (await revoke(attacker.cookie, { token: target.token })).status,
    ).toBe(400);
    expect(
      (
        await revoke(attacker.cookie, {
          sessionId: target.id,
          userId: victim.id,
        })
      ).status,
    ).toBe(400);
    expect(
      await world.runtime.auth.api.getSession({ headers: victim.headers }),
    ).not.toBeNull();
    const response = await list(attacker.cookie);
    expect((await response.json()).sessions).toHaveLength(1);
    // Raw token-based provider endpoints remain unavailable through public auth routing.
    expect(
      (
        await handleAuthRequest(
          world.runtime,
          jsonRequest(world, "/api/auth/revoke-session", {
            cookie: attacker.cookie,
            body: { token: target.token },
          }),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await handleAuthRequest(
          world.runtime,
          jsonRequest(world, "/api/auth/list-sessions", {
            method: "GET",
            cookie: attacker.cookie,
          }),
        )
      ).status,
    ).toBe(404);
  });

  it("refuses current-session removal while existing sign-out revokes it", async () => {
    const account = await createAccount(world);
    const current = await providerSession(account.headers);
    const response = await revoke(account.cookie, { sessionId: current.id });
    expect(response.status).toBe(409);
    expect((await response.json()).message).toContain("Sign out");
    expect((await list(account.cookie)).status).toBe(200);
    expect(
      (
        await handleAuthRequest(
          world.runtime,
          jsonRequest(world, "/api/auth/sign-out", {
            cookie: account.cookie,
            body: {},
          }),
        )
      ).status,
    ).toBe(200);
    expect((await list(account.cookie)).status).toBe(401);
  });

  it("excludes expired sessions and denies expired caller cookies", async () => {
    const account = await createAccount(world);
    const other = await secondSession(account);
    const target = await providerSession(other.headers);
    await world.owner.db
      .update(session)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(session.id, target.id));
    const response = await list(account.cookie);
    expect((await response.json()).sessions).toHaveLength(1);
    expect(
      (await revoke(account.cookie, { sessionId: target.id })).status,
    ).toBe(404);
    expect((await list(other.cookie)).status).toBe(401);
  });

  it("preserves the installed provider list freshness gate for list and revoke", async () => {
    const account = await createAccount(world);
    const other = await secondSession(account);
    const current = await providerSession(account.headers);
    const target = await providerSession(other.headers);
    await world.owner.db
      .update(session)
      .set({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(session.id, current.id));
    for (const response of [
      await list(account.cookie),
      await revoke(account.cookie, { sessionId: target.id }),
    ]) {
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        code: "SESSION_NOT_FRESH",
        message: "Sign out, then sign in again to manage your sessions.",
      });
    }
    expect(
      await world.runtime.auth.api.getSession({ headers: other.headers }),
    ).not.toBeNull();
    const fresh = await secondSession(account);
    expect((await list(fresh.cookie)).status).toBe(200);
  });

  it("denies anonymous, unverified and suspended callers on both operations", async () => {
    const account = await createAccount(world);
    const other = await secondSession(account);
    const target = await providerSession(other.headers);
    expect((await list()).status).toBe(401);
    expect((await revoke(undefined, { sessionId: target.id })).status).toBe(
      401,
    );
    await world.owner.db
      .update(user)
      .set({ emailVerified: false })
      .where(eq(user.id, account.id));
    expect((await list(account.cookie)).status).toBe(403);
    expect(
      (await revoke(account.cookie, { sessionId: target.id })).status,
    ).toBe(403);
    await world.owner.db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, account.id));
    await world.owner.db
      .update(userAccess)
      .set({ status: "suspended" })
      .where(eq(userAccess.userId, account.id));
    expect((await list(account.cookie)).status).toBe(403);
    expect(
      (await revoke(account.cookie, { sessionId: target.id })).status,
    ).toBe(403);
    expect(
      await world.owner.db
        .select()
        .from(session)
        .where(eq(session.id, target.id)),
    ).toHaveLength(1);
  });

  it("concurrent duplicate revocation safely ends only the target and leaves current access", async () => {
    const account = await createAccount(world);
    const other = await secondSession(account);
    const target = await providerSession(other.headers);
    const responses = await Promise.all([
      revoke(account.cookie, { sessionId: target.id }),
      revoke(account.cookie, { sessionId: target.id }),
    ]);
    expect(responses.some((response) => response.status === 200)).toBe(true);
    expect(
      responses.every((response) => [200, 404].includes(response.status)),
    ).toBe(true);
    expect(
      await world.runtime.auth.api.getSession({ headers: other.headers }),
    ).toBeNull();
    expect((await list(account.cookie)).status).toBe(200);
  });

  it("enforces origin, host, method, bounded input and private cache policy", async () => {
    const account = await createAccount(world);
    const other = await secondSession(account);
    const target = await providerSession(other.headers);
    expect(
      (
        await revoke(
          account.cookie,
          { sessionId: target.id },
          "https://foreign.test",
        )
      ).status,
    ).toBe(403);
    const missingOrigin = jsonRequest(world, "/api/account/sessions/revoke", {
      cookie: account.cookie,
      body: { sessionId: target.id },
    });
    missingOrigin.headers.delete("origin");
    expect(
      (await handleAccountSessions(world.runtime, missingOrigin, "revoke"))
        .status,
    ).toBe(403);
    const foreignHost = jsonRequest(world, "/api/account/sessions", {
      method: "GET",
      cookie: account.cookie,
    });
    foreignHost.headers.set("host", "foreign.test");
    expect(
      (await handleAccountSessions(world.runtime, foreignHost, "list")).status,
    ).toBe(403);
    expect(
      (
        await handleAccountSessions(
          world.runtime,
          jsonRequest(world, "/api/account/sessions", {
            method: "POST",
            cookie: account.cookie,
            body: {},
          }),
          "list",
        )
      ).status,
    ).toBe(405);
    for (const body of [
      {},
      { sessionId: "x".repeat(2048) },
      { sessionId: "../foreign" },
      { sessionId: target.id, role: "admin" },
    ])
      expect((await revoke(account.cookie, body)).status).toBe(400);
    for (const response of [
      await list(account.cookie),
      await list(),
      await revoke(account.cookie, { sessionId: "missing" }),
    ]) {
      expect(response.headers.get("cache-control")).toBe(
        "private, no-store, max-age=0",
      );
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    }
    expect(
      await world.runtime.auth.api.getSession({ headers: other.headers }),
    ).not.toBeNull();
  });

  it("returns safe unconfigured and real database outage errors without provider internals", async () => {
    const request = jsonRequest(world, "/api/account/sessions", {
      method: "GET",
    });
    expect((await handleAccountSessions(null, request, "list")).status).toBe(
      503,
    );
    const broken = createLocalAuth(process.env);
    await broken.pool.end();
    const response = await handleAccountSessions(broken, request, "list");
    expect(response.status).toBe(401); // No cookie: provider needs no database read.
    const account = await createAccount(world);
    const outage = await handleAccountSessions(
      broken,
      jsonRequest(world, "/api/account/sessions", {
        method: "GET",
        cookie: account.cookie,
      }),
      "list",
    );
    expect(outage.status).toBe(503);
    expect(await outage.json()).toEqual({
      message: "Account service is unavailable. Try again later.",
    });
  });
});
