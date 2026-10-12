import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

vi.mock("pg", () => ({
  Pool: class extends EventEmitter {},
}));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: vi.fn(() => ({})) }));

import { createDatabase } from "@/lib/db/connection";

const url =
  "postgresql://synthetic:synthetic-password@127.0.0.1:55504/learli_test";
afterEach(() => vi.restoreAllMocks());

describe("connection diagnostic containment", () => {
  it("does not serialize or inspect idle-pool errors or their client objects", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const inspect = vi.fn(() => {
      throw new Error("Forbidden inspection");
    });
    const error = new Error(`Synthetic SQL/token/private URL: ${url}`, {
      cause: { secret: "synthetic" },
    });
    Object.defineProperties(error, {
      stack: { get: inspect },
      toJSON: { value: inspect },
    });
    const { pool } = createDatabase(url, true);
    expect(() =>
      pool.emit("error", error, new Proxy({}, { get: inspect })),
    ).not.toThrow();
    expect(inspect).not.toHaveBeenCalled();
    expect(log.mock.calls.length).toBe(1);
    expect(log.mock.calls[0].length).toBe(1);
    const output = log.mock.calls[0][0] as string;
    expect(output.includes(url)).toBe(false);
    expect(Object.keys(JSON.parse(output)).sort()).toEqual([
      "correlationId",
      "event",
    ]);
    expect(JSON.parse(output).event).toBe("database.pool_failed");
  });

  it("signals invalid local config but retains its sanitized error and refuses the pool", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => createDatabase(`${url}?password=synthetic`, true)).toThrow(
      "A dedicated local Learli database is required. Connection values omitted.",
    );
    expect(log.mock.calls.length).toBe(1);
    const output = log.mock.calls[0][0] as string;
    expect(output.includes(url)).toBe(false);
    expect(JSON.parse(output).event).toBe("database.setup_failed");
  });

  it("absorbs logger failures in the idle-pool listener", () => {
    vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("Synthetic log failure");
    });
    const { pool } = createDatabase(url, true);
    expect(() =>
      pool.emit("error", new Error("Synthetic driver failure")),
    ).not.toThrow();
  });
});
