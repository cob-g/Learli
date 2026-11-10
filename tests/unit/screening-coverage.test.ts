import { describe, expect, it } from "vitest";
import {
  screeningCoversLesson,
  screeningValidityMillis,
} from "@/features/tutor-screening/coverage";

describe("screening coverage", () => {
  it("treats the expiry as exclusive and rejects invalid or absent bounds", () => {
    const end = new Date("2026-11-11T10:00:00Z");
    expect(
      screeningCoversLesson(
        screeningValidityMillis("2026-11-11T10:00:01Z"),
        end,
      ),
    ).toBe(true);
    expect(
      screeningCoversLesson(
        screeningValidityMillis("2026-11-11T10:00:00Z"),
        end,
      ),
    ).toBe(false);
    expect(screeningCoversLesson(screeningValidityMillis(null), end)).toBe(
      false,
    );
    expect(screeningCoversLesson(screeningValidityMillis("invalid"), end)).toBe(
      false,
    );
    expect(
      screeningCoversLesson(screeningValidityMillis("infinity"), end),
    ).toBe(true);
  });
});
