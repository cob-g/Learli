import { describe, expect, it } from "vitest";
import {
  availabilityInput,
  describeAvailabilityIssues,
} from "@/features/availability/input";
const window = { isoWeekday: 1, startMinute: 540, endMinute: 600 };
const input = { timezone: "Asia/Manila", version: 0, windows: [window] };
describe("weekly availability boundary", () => {
  it.each([
    {},
    { windows: [] },
    { windows: [{ ...window, startMinute: 541 }] },
    { windows: [{ isoWeekday: 7, startMinute: 1380, endMinute: 1500 }] },
    { windows: [{ ...window, endMinute: 1980 }] },
    { windows: [window, { ...window, startMinute: 600, endMinute: 660 }] },
    {
      windows: [
        { isoWeekday: 7, startMinute: 1380, endMinute: 1500 },
        { isoWeekday: 1, startMinute: 60, endMinute: 120 },
      ],
    },
  ])(
    "accepts precise minutes, empty, adjacent and overnight windows: %j",
    (patch) => {
      expect(availabilityInput.safeParse({ ...input, ...patch }).success).toBe(
        true,
      );
    },
  );
  it.each([
    { timezone: "EST" },
    { timezone: "Not/AZone" },
    { version: -1 },
    { version: 0.5 },
    { userId: "someone-else" },
    { tutorId: "someone-else" },
    { reviewStatus: "approved" },
    { windows: [{ ...window, isoWeekday: 0 }] },
    { windows: [{ ...window, isoWeekday: 8 }] },
    { windows: [{ ...window, startMinute: 540.5 }] },
    { windows: [{ ...window, startMinute: -1 }] },
    { windows: [{ ...window, startMinute: 1440, endMinute: 1500 }] },
    { windows: [{ ...window, endMinute: 540 }] },
    { windows: [{ ...window, endMinute: 539 }] },
    { windows: [{ ...window, endMinute: 1981 }] },
    { windows: [{ ...window, id: "forged" }] },
    { windows: [window, window] },
    { windows: [window, { ...window, startMinute: 599 }] },
    {
      windows: [
        { isoWeekday: 7, startMinute: 1380, endMinute: 1500 },
        { isoWeekday: 1, startMinute: 30, endMinute: 120 },
      ],
    },
    {
      windows: [
        { isoWeekday: 2, startMinute: 1380, endMinute: 1500 },
        { isoWeekday: 3, startMinute: 30, endMinute: 120 },
      ],
    },
    {
      windows: Array.from({ length: 43 }, (_, i) => ({
        ...window,
        startMinute: i * 2,
        endMinute: i * 2 + 1,
      })),
    },
  ])("rejects invalid or forged schedules: %j", (patch) => {
    expect(availabilityInput.safeParse({ ...input, ...patch }).success).toBe(
      false,
    );
  });
  it("points errors to the invalid fields without reflecting input", () => {
    const result = availabilityInput.safeParse({
      ...input,
      timezone: "secret-invalid-zone",
      windows: [window, window],
    });
    if (result.success) throw new Error("Expected invalid input");
    const issues = describeAvailabilityIssues(result.error);
    expect(issues.fields).toHaveProperty("timezone");
    expect(issues.fields["windows.0.startMinute"]).toContain("overlap");
    expect(JSON.stringify(issues)).not.toContain("secret-invalid-zone");
  });
});
