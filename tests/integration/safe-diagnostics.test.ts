import { afterEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { createLocalAuth } from "@/lib/auth-factory";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { GET as health } from "@/app/api/health/route";

afterEach(() => vi.restoreAllMocks());

describe("safe diagnostics with isolated real PostgreSQL", () => {
  it("contains a real transaction failure, rolls back and preserves liveness and closed-pool response", async () => {
    if (process.env.APP_ENV !== "test" || process.env.AUTH_MODE !== "local")
      throw new Error("Dedicated local test configuration required.");
    const runtime = createLocalAuth(process.env);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const options = {
      method: "POST" as const,
      invalid: () => ({ message: "Check input." }),
    };
    const request = () =>
      new Request(`${runtime.origin}/api/synthetic?token=synthetic-query`, {
        method: "POST",
        headers: {
          origin: runtime.origin,
          "content-type": "application/json",
          cookie: "synthetic=secret-like",
          "x-correlation-id": "synthetic-caller-id",
        },
        body: JSON.stringify({ privatePayload: "synthetic-support-payload" }),
      });
    try {
      await runtime.pool.query("SELECT 1");
      const response = await handleJsonMutation(
        runtime,
        request(),
        options,
        async () => {
          await runtime.db.transaction(async (tx) => {
            // No persisted fixture writes. A SQL failure after a local setting proves
            // this boundary neither retries nor interferes with transaction rollback.
            await tx.execute(
              sql`SET LOCAL application_name = 'synthetic-diagnostic-transaction'`,
            );
            await tx.execute(
              sql`SELECT CAST('synthetic-secret-like-value' AS integer)`,
            );
          });
        },
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        message: "This service is unavailable. Try again later.",
      });
      const remaining = await runtime.pool.query(
        "SELECT current_setting('application_name') AS name",
      );
      expect(
        remaining.rows[0].name === "synthetic-diagnostic-transaction",
      ).toBe(false);
      await runtime.pool.end();
      const disconnected = await handleJsonMutation(
        runtime,
        request(),
        options,
        async () => runtime.db.execute(sql`SELECT 1`),
      );
      expect(disconnected.status).toBe(503);
      expect(await disconnected.json()).toEqual({
        message: "This service is unavailable. Try again later.",
      });
      expect(disconnected.headers.get("cache-control")).toBe(
        "private, no-store, max-age=0",
      );
      const liveness = health();
      expect(liveness.status).toBe(200);
      expect(await liveness.json()).toEqual({ status: "ok" });
      expect(log.mock.calls.length).toBe(2);
      for (const args of log.mock.calls) {
        expect(args.length).toBe(1);
        const output = args[0] as string;
        const record = JSON.parse(output);
        expect(Object.keys(record).sort()).toEqual(["correlationId", "event"]);
        expect(record.event).toBe("mutation.failed");
        expect(record.correlationId).toMatch(/^[a-f0-9-]{36}$/);
        expect(output.includes("synthetic")).toBe(false);
        expect(output.includes("CAST")).toBe(false);
        expect(output.includes(process.env.DATABASE_URL!)).toBe(false);
        expect(output.includes(process.env.BETTER_AUTH_SECRET!)).toBe(false);
      }
    } finally {
      if (!runtime.pool.ended) await runtime.pool.end();
    }
  });
});
