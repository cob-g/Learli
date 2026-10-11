import { describe, it, expect } from "vitest";
import { meetingEditInput } from "@/features/booking-meeting-links/input";
describe("meeting edit boundary", () => {
  const requestId = "e302935a-28a5-4a00-9695-7b0706d67d50";
  it("accepts bounded explicit initial/replacement revisions and rejects authority overrides", () => {
    expect(
      meetingEditInput.safeParse({
        url: "https://meet.google.com/abc-defg-hij",
        expectedRevision: 0,
        requestId,
      }).success,
    ).toBe(true);
    for (const extra of [
      { userId: "other" },
      { provider: "zoom" },
      { bookingId: requestId },
    ])
      expect(
        meetingEditInput.safeParse({
          url: "https://meet.google.com/abc-defg-hij",
          expectedRevision: 1,
          requestId,
          ...extra,
        }).success,
      ).toBe(false);
  });
  it("rejects absent/unbounded/stale-shape revisions and request identities", () => {
    for (const expectedRevision of [-1, 0.1, "1", 2147483647, undefined])
      expect(
        meetingEditInput.safeParse({
          url: "https://zoom.us/j/12345678901",
          expectedRevision,
          requestId,
        }).success,
      ).toBe(false);
    expect(
      meetingEditInput.safeParse({
        url: "https://zoom.us/j/12345678901",
        expectedRevision: 0,
        requestId: "fake",
      }).success,
    ).toBe(false);
  });
});
