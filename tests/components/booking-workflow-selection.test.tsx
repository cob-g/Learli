// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowRequestForm } from "@/features/booking-workflows/forms";
import { formatLessonTime } from "@/features/bookings/format-time";
const times = Array.from({ length: 30 }, (_, i) =>
  formatLessonTime(
    new Date(Date.UTC(2026, 9, 14, i)),
    new Date(Date.UTC(2026, 9, 14, i + 1)),
    "UTC",
  ),
);
const choice = {
  learnerId: "synthetic-learner",
  tutorSlug: "synthetic-tutor",
  subjectSlug: "math",
  displayTimezone: "UTC",
};
describe("policy booking selected-time handoff", () => {
  it("keeps an exact current selection visible and selected even beyond the first page of times", () => {
    render(
      <WorkflowRequestForm
        choice={choice}
        times={times}
        scope="guardian"
        requestedTime={times[29]}
      />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toHaveAttribute("value", times[29].startAtUtc);
    expect(radios[0]).toBeChecked();
    expect(radios.filter((r) => (r as HTMLInputElement).checked)).toHaveLength(
      1,
    );
  });
  it("does not silently select a stale interval sharing only the original start", () => {
    render(
      <WorkflowRequestForm
        choice={choice}
        times={times}
        scope="guardian"
        requestedTime={{ ...times[0], endAtUtc: times[2].endAtUtc }}
      />,
    );
    expect(
      screen
        .getAllByRole("radio")
        .every((r) => !(r as HTMLInputElement).checked),
    ).toBe(true);
  });
});
