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
    it("sends the real signup proof and verifies only its untampered link", async () => {
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
      } finally {
        await runtime.pool.end();
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
      }
    }, 30_000);
  },
);
