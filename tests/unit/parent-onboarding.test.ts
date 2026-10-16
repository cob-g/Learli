import { describe, expect, it } from "vitest";
import {
  isParentOnboardingPath,
  parentContinuation,
  parentOnboardingHref,
} from "@/features/parent-onboarding/continuation";
import { safeHostedCallback } from "@/features/hosted-auth/callback";
import { bookingSelectionHref } from "@/features/bookings/selection";

describe("parent onboarding intent and continuation", () => {
  it.each([
    undefined,
    "",
    "/account",
    "https://unrelated.test",
    "//unrelated.test",
    "/api/account",
  ])(
    "uses the parent workspace for an absent or unsafe destination %s",
    (value) => {
      expect(parentContinuation(value)).toBe("/parent");
      expect(parentOnboardingHref(value)).toBe("/parent/onboarding");
    },
  );
  it("preserves a selected public tutor and time through setup and a hosted email callback", () => {
    const next = bookingSelectionHref({
      tutorSlug: "math-tutor",
      subjectSlug: "math",
      level: "middle_school",
      displayTimezone: "Asia/Manila",
      startAtUtc: "2030-10-16T03:00:00.000Z",
      endAtUtc: "2030-10-16T04:00:00.000Z",
    });
    const href = parentOnboardingHref(next);
    expect(parentContinuation(href)).toBe(next);
    expect(isParentOnboardingPath(href)).toBe(true);
    expect(parentOnboardingHref(href)).toBe(href);
    expect(
      safeHostedCallback(
        `/sign-in?verified=1&${new URLSearchParams({ next: href })}`,
        "https://staging.example.test",
      ),
    ).toBe(true);
    // Forged private fields invalidate the selection instead of entering setup.
    expect(
      parentContinuation(parentOnboardingHref(`${next}&learnerId=foreign`)),
    ).toBe("/bookings/demo");
  });
  it.each([
    "/parent/onboarding?next=https%3A%2F%2Funrelated.test",
    "/parent/onboarding?next=%2Fparent%2Fonboarding",
    "/parent/onboarding?next=%2Fparent%2Fonboarding%3Fnext%3D%252Fparent%252Fonboarding",
    "/parent/onboarding?next=%2Ftutors&next=%2Fadmin",
  ])(
    "rejects recursive, duplicate and unsafe nested continuation %s",
    (value) => {
      expect(parentContinuation(value)).toBe("/parent");
    },
  );
  it("does not confuse another role path with parent setup", () => {
    expect(isParentOnboardingPath("/admin")).toBe(false);
    expect(isParentOnboardingPath("/parent")).toBe(false);
    expect(isParentOnboardingPath("/parent/onboarding-other")).toBe(false);
  });
});
