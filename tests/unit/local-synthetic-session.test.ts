import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { AccessError } from "@/lib/permissions/access";
import { resolveLocalSyntheticSession } from "@/lib/permissions/local-synthetic-session";
import {
  listParticipantBookings,
  listParticipantBookingOverview,
  readParticipantBooking,
} from "@/features/bookings/read-service";
import {
  readPrivateMeetingLink,
  savePrivateMeetingLink,
} from "@/features/booking-meeting-links/service";

function providerSession(email = "owner@example.test") {
  return {
    user: { id: "provider-user", email, emailVerified: false },
    session: { id: "provider-session", userId: "provider-user" },
  };
}

function fixture(environment = "test", origin = "http://127.0.0.1:3030") {
  const getSession = vi
    .fn<
      (options: {
        headers: Headers;
        query: { disableCookieCache: boolean };
      }) => Promise<ReturnType<typeof providerSession> | null>
    >()
    .mockResolvedValue(providerSession());
  const db = { execute: vi.fn(), transaction: vi.fn() };
  // Deliberately provide no account/role query implementation: preflight only
  // reads the provider, while each feature retains its own final SQL authority.
  const runtime = {
    environment,
    origin,
    auth: { api: { getSession } },
    db,
    userId: "forged-runtime-user",
    sessionId: "forged-runtime-session",
  } as unknown as AuthRuntime;
  const headers = new Headers({
    cookie: "synthetic-session-cookie",
    "x-user-id": "forged-header-user",
    "x-session-id": "forged-header-session",
  });
  return { runtime, headers, getSession, db };
}

describe("local synthetic session preflight", () => {
  it.each([
    ["production", "http://127.0.0.1:3030"],
    ["staging", "http://localhost:3030"],
    ["test", "https://localhost:3030"],
    ["development", "http://example.test"],
    ["test", "http://localhost.example.test"],
    ["test", "http://user:password@localhost:3030"],
    ["test", "http://localhost:3030/private"],
    ["test", "http://localhost:3030?query=1"],
    ["test", "not-an-origin"],
  ])("denies %s / %s with 503 before provider I/O", async (env, origin) => {
    const { runtime, headers, getSession, db } = fixture(env, origin);
    getSession.mockRejectedValue(new Error("Provider must not be reached."));
    await expect(
      resolveLocalSyntheticSession(runtime, headers),
    ).rejects.toMatchObject({
      status: 503,
      message: new AccessError(503).message,
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(db.execute).not.toHaveBeenCalled();
  });

  it.each([
    ["development", "http://127.0.0.1:3030"],
    ["test", "http://localhost:3030"],
    ["test", "http://[::1]:3030"],
  ])("resolves provider IDs only on %s / %s", async (env, origin) => {
    const { runtime, headers, getSession, db } = fixture(env, origin);
    await expect(
      resolveLocalSyntheticSession(runtime, headers),
    ).resolves.toEqual({
      userId: "provider-user",
      sessionId: "provider-session",
    });
    expect(getSession).toHaveBeenCalledExactlyOnceWith({
      headers,
      query: { disableCookieCache: true },
    });
    expect(getSession.mock.calls[0][0].headers).toBe(headers);
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 401 for a missing provider session", async () => {
    const { runtime, headers, getSession } = fixture();
    getSession.mockResolvedValue(null);
    await expect(
      resolveLocalSyntheticSession(runtime, headers),
    ).rejects.toMatchObject({
      status: 401,
      message: new AccessError(401).message,
    });
    expect(getSession).toHaveBeenCalledOnce();
  });

  it.each(["owner@example.com", "owner@test", "owner@example.test.invalid"])(
    "returns 404 for nonsynthetic provider email %s",
    async (email) => {
      const { runtime, headers, getSession } = fixture();
      getSession.mockResolvedValue(providerSession(email));
      await expect(
        resolveLocalSyntheticSession(runtime, headers),
      ).rejects.toMatchObject({
        status: 404,
        message: new AccessError(404).message,
      });
      expect(getSession).toHaveBeenCalledOnce();
    },
  );

  it.each([
    new Error("Provider unavailable"),
    { status: 403, code: "PROVIDER" },
  ])("propagates the original provider rejection unchanged", async (error) => {
    const { runtime, headers, getSession } = fixture();
    getSession.mockRejectedValue(error);
    await expect(resolveLocalSyntheticSession(runtime, headers)).rejects.toBe(
      error,
    );
  });

  it("reads each call afresh, including changed IDs and a revoked session", async () => {
    const { runtime, headers, getSession } = fixture();
    const changed = providerSession();
    changed.user.id = "next-provider-user";
    changed.session.id = "next-provider-session";
    changed.session.userId = changed.user.id;
    getSession
      .mockResolvedValueOnce(providerSession())
      .mockResolvedValueOnce(changed)
      .mockResolvedValueOnce(null);
    expect(await resolveLocalSyntheticSession(runtime, headers)).toEqual({
      userId: "provider-user",
      sessionId: "provider-session",
    });
    expect(await resolveLocalSyntheticSession(runtime, headers)).toEqual({
      userId: "next-provider-user",
      sessionId: "next-provider-session",
    });
    await expect(
      resolveLocalSyntheticSession(runtime, headers),
    ).rejects.toMatchObject({
      status: 401,
      message: new AccessError(401).message,
    });
    expect(getSession).toHaveBeenCalledTimes(3);
    for (const [options] of getSession.mock.calls)
      expect(options).toEqual({ headers, query: { disableCookieCache: true } });
  });
});

const malformedOperations: {
  name: string;
  run: (runtime: AuthRuntime, headers: Headers) => Promise<unknown>;
  inputError: typeof AccessError | typeof ZodError;
}[] = [
  {
    name: "booking list",
    run: (runtime, headers) => listParticipantBookings(runtime, headers, {}),
    inputError: ZodError,
  },
  {
    name: "booking overview",
    run: (runtime, headers) =>
      listParticipantBookingOverview(runtime, headers, {}),
    inputError: ZodError,
  },
  {
    name: "booking detail",
    run: (runtime, headers) =>
      readParticipantBooking(runtime, headers, "malformed", "guardian"),
    inputError: AccessError,
  },
  {
    name: "meeting read",
    run: (runtime, headers) =>
      readPrivateMeetingLink(runtime, headers, "malformed"),
    inputError: AccessError,
  },
  {
    name: "meeting edit",
    run: (runtime, headers) =>
      savePrivateMeetingLink(runtime, headers, "malformed", {}),
    inputError: AccessError,
  },
];

describe.each(malformedOperations)(
  "$name preflight precedence",
  ({ run, inputError }) => {
    it.each([503, 401, 404] as const)(
      "returns preflight %s before feature input validation or database access",
      async (status) => {
        const { runtime, headers, getSession, db } = fixture(
          status === 503 ? "production" : "test",
        );
        getSession.mockResolvedValue(
          status === 401 ? null : providerSession("owner@example.com"),
        );
        await expect(run(runtime, headers)).rejects.toMatchObject({
          status,
          message: new AccessError(status).message,
        });
        expect(getSession).toHaveBeenCalledTimes(status === 503 ? 0 : 1);
        expect(db.execute).not.toHaveBeenCalled();
        expect(db.transaction).not.toHaveBeenCalled();
      },
    );

    it("validates feature inputs after successful preflight and before database I/O", async () => {
      const { runtime, headers, getSession, db } = fixture();
      const result = run(runtime, headers);
      await expect(result).rejects.toBeInstanceOf(inputError);
      if (inputError === AccessError)
        await expect(result).rejects.toMatchObject({ status: 404 });
      expect(getSession).toHaveBeenCalledOnce();
      expect(db.execute).not.toHaveBeenCalled();
      expect(db.transaction).not.toHaveBeenCalled();
    });
  },
);
