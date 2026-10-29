import { describe, expect, it } from "vitest";
import {
  formatTimeInputValue,
  parseTimeInputValue,
} from "../../src/features/availability/time-input";

describe("availability time inputs", () => {
  it.each([
    [0, "00:00"],
    [540, "09:00"],
    [1380, "23:00"],
    [1440, "00:00"],
    [1500, "01:00"],
    [2879, "23:59"],
  ])("formats minute %i as %s", (minute, value) => {
    expect(formatTimeInputValue(minute)).toBe(value);
  });

  it.each([
    ["00:00", 0],
    ["09:00", 540],
    ["23:59", 1439],
  ])("parses %s as minute %i", (value, minute) => {
    expect(parseTimeInputValue(value)).toBe(minute);
  });

  it.each(["", "9:00", "24:00", "12:60", "not-a-time"])(
    "rejects invalid draft %j",
    (value) => {
      expect(parseTimeInputValue(value)).toBeNull();
    },
  );

  it.each([-1, 1.5, 2880, Number.NaN])(
    "does not format invalid minute %s",
    (minute) => {
      expect(formatTimeInputValue(minute)).toBe("");
    },
  );
});
