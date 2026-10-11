import { describe, expect, it } from "vitest";
import {
  reportedDevice,
  revokeSessionInput,
  sessionTimestamp,
} from "@/features/account-sessions/model";

describe("account session input and safe presentation", () => {
  it("accepts only a bounded opaque session ID", () => {
    expect(revokeSessionInput.parse({ sessionId: "aB12_-" })).toEqual({
      sessionId: "aB12_-",
    });
  });
  it.each(["token", "userId", "current", "role"])(
    "rejects untrusted %s",
    (key) => {
      expect(
        revokeSessionInput.safeParse({ sessionId: "own", [key]: "forged" })
          .success,
      ).toBe(false);
    },
  );
  it.each([
    "",
    " ",
    "x".repeat(129),
    "https://example.test",
    "../foreign",
    "id\nother",
  ])("rejects invalid ID %s", (sessionId) => {
    expect(revokeSessionInput.safeParse({ sessionId }).success).toBe(false);
  });
  it.each([
    [undefined, "Browser details unavailable"],
    [null, "Browser details unavailable"],
    ["secret-untrusted-header<script>", "Browser details unavailable"],
    [
      "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36",
      "Chrome on Windows",
    ],
    [
      "Mozilla/5.0 (Macintosh) Chrome/130.0 Safari/537.36 Edg/130.0",
      "Edge on macOS",
    ],
    ["Mozilla/5.0 (Android) Chrome/130.0 OPR/90.0", "Opera on Android"],
    ["Mozilla/5.0 (iPhone) FxiOS/10.0", "Firefox on iOS"],
    ["Mozilla/5.0 (Macintosh) Version/17.0 Safari/600.0", "Safari on macOS"],
    ["Linux UnknownApp/1.0 private-data", "Unknown browser on Linux"],
  ])("returns fixed labels for reported UA", (agent, expected) => {
    expect(reportedDevice(agent)).toBe(expected);
  });
  it("formats dated zone-aware times using each instant's DST offset", () => {
    const before = sessionTimestamp("2026-11-01T05:30:00Z", "America/New_York");
    const after = sessionTimestamp("2026-11-01T06:30:00Z", "America/New_York");
    expect(before).toContain("Nov 1, 2026");
    expect(before).toContain("GMT-4");
    expect(after).toContain("GMT-5");
    expect(sessionTimestamp("2026-10-11T09:00:00Z", "Asia/Manila")).toContain(
      "GMT+8",
    );
  });
});
