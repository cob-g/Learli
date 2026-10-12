import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("node:crypto"), async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, randomUUID: vi.fn(original.randomUUID) };
});

let emit: typeof import("@/lib/diagnostics.server").emitDiagnostic;
beforeEach(async () => {
  vi.resetModules();
  vi.spyOn(performance, "now").mockReturnValue(0);
  emit = (await import("@/lib/diagnostics.server")).emitDiagnostic;
});
afterEach(() => vi.restoreAllMocks());

describe("closed diagnostic output", () => {
  it("emits only fixed categories and distinct generated event identifiers", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const categories = [
      "mutation.failed",
      "mutation.unavailable",
      "database.pool_failed",
      "database.setup_failed",
    ] as const;
    categories.forEach(emit);
    const identifiers = new Set<string>();
    for (const [index, args] of log.mock.calls.entries()) {
      expect(args.length).toBe(1);
      const record = JSON.parse(args[0] as string);
      expect(Object.keys(record).sort()).toEqual(["correlationId", "event"]);
      expect(record.event).toBe(categories[index]);
      expect(record.correlationId).toMatch(
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
      );
      identifiers.add(record.correlationId);
    }
    expect(identifiers.size).toBe(4);
  });

  it("ignores invalid runtime categories without inspecting or coercing objects", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const inspect = vi.fn(() => {
      throw new Error("Synthetic forbidden inspection");
    });
    for (const value of [
      "mutation.failed\nsecret-like-token",
      "https://meet.google.com/synthetic-private",
      undefined,
      null,
      { toString: inspect, toJSON: inspect },
      new Proxy({}, { get: inspect }),
    ])
      emit(value as Parameters<typeof emit>[0]);
    expect(log).not.toHaveBeenCalled();
    expect(inspect).not.toHaveBeenCalled();
  });

  it("bounds combined categories and resumes only at a monotonic window boundary", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let index = 0; index < 100; index++)
      emit(index % 2 ? "mutation.failed" : "database.pool_failed");
    expect(log).toHaveBeenCalledTimes(20);
    vi.mocked(performance.now).mockReturnValue(59_999);
    emit("mutation.unavailable");
    expect(log).toHaveBeenCalledTimes(20);
    vi.mocked(performance.now).mockReturnValue(60_000);
    emit("mutation.unavailable");
    expect(log).toHaveBeenCalledTimes(21);
  });

  it("swallows logger failure and budgets failed attempts too", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("Synthetic logger failure");
    });
    for (let index = 0; index < 30; index++)
      expect(() => emit("mutation.failed")).not.toThrow();
    expect(log).toHaveBeenCalledTimes(20);
  });

  it("swallows UUID generation failure without sending its error to the logger", async () => {
    const crypto = await import("node:crypto");
    vi.mocked(crypto.randomUUID).mockImplementationOnce(() => {
      throw new Error("Synthetic UUID failure");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => emit("database.pool_failed")).not.toThrow();
    expect(log).not.toHaveBeenCalled();
  });
});
