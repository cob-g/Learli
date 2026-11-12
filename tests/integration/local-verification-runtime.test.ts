import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { parse } from "dotenv";
import { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { createLocalAuth } from "@/lib/auth-factory";
import { handleAuthRequest } from "@/lib/auth-handler";

// Explicit isolated owner fixture only; never select a developer's default DB.
describe.skipIf(process.env.LEARLI_LOCAL_VERIFICATION_INTEGRATION !== "1")(
  "local verification runtime",
  () => {
    it("delivers real verification and reset proofs with uniform recovery and single-use reset", async () => {
      const source = parse(readFileSync(".env.local"));
      const database = new URL(source.DATABASE_URL);
      if (
        database.hostname !== "127.0.0.1" ||
        database.port !== "55438" ||
        database.pathname !== "/learli_dev" ||
        database.username !== "learli_app"
      )
        throw new Error("Isolated verification fixture required.");
      const direct = new URL(source.DATABASE_URL_DIRECT);
      if (
        direct.hostname !== "127.0.0.1" ||
        direct.port !== "55438" ||
        direct.pathname !== "/learli_dev" ||
        direct.username !== "learli_owner" ||
        direct.search ||
        direct.hash
      )
        throw new Error("Isolated verification owner fixture required.");
      const root = realpathSync(process.cwd());
      const dataDirectory = realpathSync(
        path.join(root, ".local/postgres/data"),
      );
      const markerPath = path.join(
        root,
        ".local/email-verification-fixture.json",
      );
      const descriptor = openSync(
        markerPath,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      let marker: unknown;
      try {
        const stat = fstatSync(descriptor);
        if (
          !stat.isFile() ||
          stat.uid !== process.getuid?.() ||
          (stat.mode & 0o7777) !== 0o600
        )
          throw new Error("Private fixture marker required.");
        marker = JSON.parse(readFileSync(descriptor, "utf8"));
      } finally {
        closeSync(descriptor);
      }
      if (
        !marker ||
        typeof marker !== "object" ||
        !("purpose" in marker) ||
        marker.purpose !== "resend-email-verification-isolated-test-v1" ||
        !("root" in marker) ||
        marker.root !== root ||
        !("dataDirectory" in marker) ||
        marker.dataDirectory !== dataDirectory ||
        !("systemIdentifier" in marker) ||
        typeof marker.systemIdentifier !== "string" ||
        !/^\d+$/.test(marker.systemIdentifier)
      )
        throw new Error("Isolated verification marker rejected.");
      const owner = new Pool({ connectionString: source.DATABASE_URL_DIRECT });
      try {
        const directory = await owner.query("SHOW data_directory");
        const identity = await owner.query(
          "SELECT system_identifier::text FROM pg_control_system()",
        );
        if (
          realpathSync(directory.rows[0]?.data_directory) !== dataDirectory ||
          identity.rows[0]?.system_identifier !== marker.systemIdentifier
        )
          throw new Error("Isolated verification server identity rejected.");
        await owner.query(
          "UPDATE rate_limit SET count = 0 WHERE key LIKE '%/sign-up/email%' OR key LIKE '%/send-verification-email%'",
        );
      } finally {
        await owner.end();
      }
      const email = `verification-${randomUUID()}@example.test`;
      const request = vi.fn<typeof fetch>(
        async () =>
          new Response(
            JSON.stringify({ id: "00000000-0000-4000-8000-000000000000" }),
            { status: 200 },
          ),
      );
      vi.stubGlobal("fetch", request);
      for (const [key, value] of Object.entries(source)) vi.stubEnv(key, value);
      vi.stubEnv("DATABASE_URL_DIRECT", undefined);
      vi.stubEnv("LOCAL_WORKFLOW_MODE", "enabled");
      vi.stubEnv("LOCAL_VERIFICATION_RESEND_KEY", "re_testkey123456");
      vi.stubEnv("LOCAL_VERIFICATION_RECIPIENT", email);
      const runtime = createLocalAuth({
        ...source,
        DATABASE_URL_DIRECT: undefined,
        LOCAL_WORKFLOW_MODE: "enabled",
        LOCAL_VERIFICATION_RESEND_KEY: "re_testkey123456",
        LOCAL_VERIFICATION_RECIPIENT: email,
      });
      try {
        const resend = (target: string, selected = runtime) =>
          handleAuthRequest(
            selected,
            new Request(`${selected.origin}/api/auth/send-verification-email`, {
              method: "POST",
              headers: {
                origin: selected.origin,
                "content-type": "application/json",
              },
              body: JSON.stringify({ email: target, callbackURL: "/sign-in" }),
            }),
          );
        const census: { actor: string; elapsed: number }[] = [];
        const timed = async (
          actor: string,
          target: string,
          selected = runtime,
        ) => {
          const start = performance.now();
          const response = await resend(target, selected);
          census.push({ actor, elapsed: performance.now() - start });
          return response;
        };
        const unknownAllowed = await timed("allowed unknown", email);
        expect(unknownAllowed.headers.get("cache-control")).toBe(
          "private, no-store, max-age=0",
        );
        expect(unknownAllowed.headers.get("referrer-policy")).toBe(
          "no-referrer",
        );
        const expected = {
          status: unknownAllowed.status,
          body: await unknownAllowed.text(),
        };
        expect(request).toHaveBeenCalledTimes(0);
        const response = await handleAuthRequest(
          runtime,
          new Request(`${runtime.origin}/api/auth/sign-up/email`, {
            method: "POST",
            headers: {
              origin: runtime.origin,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              name: "Synthetic owner",
              email,
              password: "Synthetic-only-passphrase-123",
              callbackURL: "/sign-in",
            }),
          }),
        );
        expect(response.status).toBe(200);
        expect(request).toHaveBeenCalledTimes(1);
        const body = JSON.parse(request.mock.calls[0]![1]!.body as string) as {
          to: string[];
          text: string;
        };
        expect(body.to).toEqual([email]);
        const link = body.text.match(/^http:\/\/127\.0\.0\.1:[^\s]+$/m)?.[0];
        expect(link).toBeDefined();
        if (!link)
          throw new Error("Verification proof missing from test mail.");
        request.mockResolvedValueOnce(
          new Response("private error", { status: 403 }),
        );
        const failure = await timed("allowed known", email);
        expect(failure.headers.get("cache-control")).toBe(
          "private, no-store, max-age=0",
        );
        expect(failure.headers.get("referrer-policy")).toBe("no-referrer");
        expect({ status: failure.status, body: await failure.text() }).toEqual(
          expected,
        );
        expect(request).toHaveBeenCalledTimes(2);
        const otherRecipient = `other-${randomUUID()}@example.test`;
        vi.stubEnv("LOCAL_VERIFICATION_RECIPIENT", otherRecipient);
        const otherRuntime = createLocalAuth({
          ...source,
          DATABASE_URL_DIRECT: undefined,
          LOCAL_WORKFLOW_MODE: "enabled",
          LOCAL_VERIFICATION_RESEND_KEY: "re_testkey123456",
          LOCAL_VERIFICATION_RECIPIENT: otherRecipient,
        });
        try {
          const known = await timed("disallowed known", email, otherRuntime);
          const unknown = await timed(
            "disallowed unknown",
            `missing-${randomUUID()}@example.test`,
            otherRuntime,
          );
          expect({ status: known.status, body: await known.text() }).toEqual(
            expected,
          );
          expect({
            status: unknown.status,
            body: await unknown.text(),
          }).toEqual(expected);
          expect(request).toHaveBeenCalledTimes(2);
          expect(census.map(({ actor }) => actor)).toEqual([
            "allowed unknown",
            "allowed known",
            "disallowed known",
            "disallowed unknown",
          ]);
          expect(census.every(({ elapsed }) => elapsed >= 3_450)).toBe(true);
        } finally {
          await otherRuntime.pool.end();
        }
        vi.stubEnv("LOCAL_VERIFICATION_RECIPIENT", email);
        const tampered = new URL(link);
        tampered.searchParams.set("token", "invalid-token-value");
        const invalid = await handleAuthRequest(runtime, new Request(tampered));
        expect(invalid.status).toBe(302);
        const before = await runtime.pool.query(
          'SELECT email_verified FROM "user" WHERE email = $1',
          [email],
        );
        expect(before.rows[0]?.email_verified).toBe(false);
        const valid = await handleAuthRequest(runtime, new Request(link));
        expect(valid.status).toBeLessThan(400);
        const result = await runtime.pool.query(
          'SELECT email_verified FROM "user" WHERE email = $1',
          [email],
        );
        expect(result.rows[0]?.email_verified).toBe(true);
        request.mockClear();
        const post = (route: string, body: object, selected = runtime) =>
          handleAuthRequest(
            selected,
            new Request(`${selected.origin}/api/auth/${route}`, {
              method: "POST",
              headers: {
                origin: selected.origin,
                "content-type": "application/json",
              },
              body: JSON.stringify(body),
            }),
          );
        const login = await post("sign-in/email", {
          email,
          password: "Synthetic-only-passphrase-123",
        });
        expect(login.status).toBe(200);
        const cookie = login.headers
          .getSetCookie()
          .map((value) => value.split(";")[0])
          .join("; ");
        const reset = (target: string, selected = runtime) =>
          post(
            "request-password-reset",
            { email: target, redirectTo: "/reset-password" },
            selected,
          );
        const accepted = await reset(email);
        expect(accepted.status).toBe(200);
        const received = await accepted.text();
        expect(request).toHaveBeenCalledTimes(1);
        const resetMail = JSON.parse(
          request.mock.calls[0]![1]!.body as string,
        ) as { subject: string; text: string; to: string[] };
        expect(resetMail.subject).toBe("Reset your Learli password");
        expect(resetMail.to).toEqual([email]);
        const resetUrl = resetMail.text.match(
          /^http:\/\/127\.0\.0\.1:[^\s]+$/m,
        )?.[0];
        if (!resetUrl) throw new Error("Synthetic reset proof missing.");
        const unknownEmail = `missing-${randomUUID()}@example.test`;
        vi.stubEnv("LOCAL_VERIFICATION_RECIPIENT", unknownEmail);
        const unknownRuntime = createLocalAuth({
          ...source,
          DATABASE_URL_DIRECT: undefined,
          LOCAL_WORKFLOW_MODE: "enabled",
          LOCAL_VERIFICATION_RESEND_KEY: "re_testkey123456",
          LOCAL_VERIFICATION_RECIPIENT: unknownEmail,
        });
        try {
          for (const target of [unknownEmail, email]) {
            const response = await reset(target, unknownRuntime);
            expect(response.status).toBe(200);
            expect(await response.text()).toBe(received);
            expect(response.headers.get("cache-control")).toBe(
              "private, no-store, max-age=0",
            );
          }
          expect(request).toHaveBeenCalledTimes(1);
        } finally {
          await unknownRuntime.pool.end();
        }
        vi.stubEnv("LOCAL_VERIFICATION_RECIPIENT", email);
        request.mockResolvedValueOnce(
          new Response("private provider failure", { status: 403 }),
        );
        const providerFailure = await reset(email);
        expect(providerFailure.status).toBe(200);
        expect(await providerFailure.text()).toBe(received);
        expect(request).toHaveBeenCalledTimes(2);
        // The original provider proof is still valid; a failed send never consumes it.
        const resetToken = new URL(resetUrl).pathname.split("/").at(-1)!;
        const replacementPassword = "Synthetic-replacement-passphrase-456";
        expect(
          (
            await post("reset-password", {
              token: "invalid-synthetic-token",
              newPassword: replacementPassword,
            })
          ).ok,
        ).toBe(false);
        const proofRedirect = await handleAuthRequest(
          runtime,
          new Request(resetUrl),
        );
        expect(
          new URL(proofRedirect.headers.get("location")!, runtime.origin)
            .pathname,
        ).toBe("/reset-password");
        expect(
          (
            await post("reset-password", {
              token: resetToken,
              newPassword: replacementPassword,
            })
          ).status,
        ).toBe(200);
        expect(
          (
            await post("reset-password", {
              token: resetToken,
              newPassword: replacementPassword,
            })
          ).ok,
        ).toBe(false);
        expect(
          (
            await post("sign-in/email", {
              email,
              password: "Synthetic-only-passphrase-123",
            })
          ).status,
        ).toBe(401);
        expect(
          (
            await post("sign-in/email", {
              email,
              password: replacementPassword,
            })
          ).status,
        ).toBe(200);
        const oldSession = await handleAuthRequest(
          runtime,
          new Request(`${runtime.origin}/api/auth/get-session`, {
            headers: { cookie },
          }),
        );
        expect(await oldSession.json()).toBeNull();
        expect((await reset(email)).status).toBe(200);
        expect((await reset(email)).status).toBe(429);
        const lastMail = JSON.parse(
          request.mock.calls.at(-1)![1]!.body as string,
        ) as { text: string };
        const expiredUrl = lastMail.text.match(
          /^http:\/\/127\.0\.0\.1:[^\s]+$/m,
        )?.[0];
        if (!expiredUrl) throw new Error("Synthetic expiry proof missing.");
        const expiredToken = new URL(expiredUrl).pathname.split("/").at(-1)!;
        const expirationOwner = new Pool({
          connectionString: source.DATABASE_URL_DIRECT,
        });
        try {
          const expired = await expirationOwner.query(
            "UPDATE verification SET expires_at=clock_timestamp()-interval '1 second' WHERE identifier=$1",
            [`reset-password:${expiredToken}`],
          );
          expect(expired.rowCount).toBe(1);
        } finally {
          await expirationOwner.end();
        }
        expect(
          (
            await post("reset-password", {
              token: expiredToken,
              newPassword: "Synthetic-never-applied-passphrase-789",
            })
          ).ok,
        ).toBe(false);
      } finally {
        await runtime.pool.end();
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
      }
    }, 60_000);
  },
);
