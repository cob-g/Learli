import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GoogleFailure,
  googleMeetProvider,
} from "@/features/google-meet/provider";
import { testMeetConfig } from "../support/google-meet";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const info = (reason: string, domain = "googleapis.com") => ({
  "@type": "type.googleapis.com/google.rpc.ErrorInfo",
  domain,
  reason,
  metadata: { email: "private-person@example.test", token: "private-token" },
});
describe("safe Google create diagnostics", () => {
  it("retains only recognized status/reason and HTTP status without replaying create", async () => {
    const send = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 403,
            status: "PERMISSION_DENIED",
            message: "private-person@example.test private-token",
            details: [info("ACCESS_TOKEN_SCOPE_INSUFFICIENT")],
          },
        }),
        { status: 403 },
      ),
    );
    vi.stubGlobal("fetch", send);
    const failure = await googleMeetProvider(testMeetConfig())
      .createSpace("private-access-token")
      .catch((e) => e);
    expect(failure).toBeInstanceOf(GoogleFailure);
    expect(failure.code).toBe("create_rejected");
    expect(failure.diagnostic).toEqual({
      httpStatus: 403,
      status: "PERMISSION_DENIED",
      reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
    });
    expect(Object.isFrozen(failure.diagnostic)).toBe(true);
    expect(JSON.stringify(failure)).not.toMatch(/private-|example\.test/);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it.each([
    { error: { status: "PRIVATE_SECRET", details: [info("PRIVATE_SECRET")] } },
    {
      error: {
        status: "PERMISSION_DENIED",
        details: [info("SERVICE_DISABLED", "untrusted.test")],
      },
    },
    {
      error: {
        status: "PERMISSION_DENIED",
        details: [{ ...info("SERVICE_DISABLED"), "@type": "untrusted" }],
      },
    },
  ])(
    "does not echo unknown statuses, reasons, domains or metadata",
    async (body) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify(body), { status: 403 }),
          ),
      );
      const failure = await googleMeetProvider(testMeetConfig())
        .createSpace("secret")
        .catch((e) => e);
      expect(failure.diagnostic.reason).toBe("UNCLASSIFIED");
      expect(JSON.stringify(failure)).not.toMatch(
        /PRIVATE_SECRET|untrusted|private-/,
      );
    },
  );
  it.each(["not json", "x".repeat(65537), null])(
    "keeps malformed, oversized and missing error bodies bounded and unclassified",
    async (body) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(body, { status: 403 })),
      );
      await expect(
        googleMeetProvider(testMeetConfig()).createSpace("secret"),
      ).rejects.toMatchObject({
        code: "create_rejected",
        diagnostic: {
          httpStatus: 403,
          status: "UNCLASSIFIED",
          reason: "UNCLASSIFIED",
        },
      });
    },
  );
  it("honors the response deadline even if stream cancellation never acknowledges", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const stream = new ReadableStream({ cancel });
    const send = vi
      .fn()
      .mockResolvedValue(new Response(stream, { status: 403 }));
    vi.stubGlobal("fetch", send);
    const result = googleMeetProvider(testMeetConfig()).createSpace("secret");
    await vi.waitFor(() => expect(stream.locked).toBe(true));
    controller.abort();
    await expect(result).rejects.toMatchObject({
      code: "create_rejected",
      diagnostic: { reason: "UNCLASSIFIED" },
    });
    expect(cancel).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
  });
  it("refuses diagnostic objects containing arbitrary extra data", () => {
    const failure = new GoogleFailure("create_rejected", {
      httpStatus: 403,
      status: "PERMISSION_DENIED",
      reason: "SERVICE_DISABLED",
      secret: "do-not-emit",
    } as never);
    expect(failure.diagnostic).toBeUndefined();
    expect(JSON.stringify(failure)).not.toContain("do-not-emit");
  });
});
