// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { DemoBookingForm } from "@/features/bookings/demo-booking-form";

const time = {
  startAtUtc: "2026-10-15T10:00:00.000Z",
  endAtUtc: "2026-10-15T11:00:00.000Z",
  date: "Thursday, October 15, 2026",
  time: "10:00 AM – 11:00 AM",
  zone: "UTC (GMT)",
};
const props: ComponentProps<typeof DemoBookingForm> = {
  options: {
    timezone: "UTC",
    learners: [
      {
        id: "synthetic-learner",
        displayName: "Synthetic learner",
        management: "guardian",
        grade: null,
        level: "high_school",
        timezone: "UTC",
      },
    ],
    tutors: [
      {
        slug: "synthetic-tutor",
        displayName: "Synthetic tutor",
        headline: "Synthetic fixture",
        bio: "Synthetic fixture",
        teachingBackground: "Synthetic fixture",
        teachingLanguages: [],
        offerings: [
          {
            subjectSlug: "math",
            subjectName: "Math",
            levels: ["high_school"],
            specialty: null,
          },
        ],
      },
    ],
  },
  zones: [{ value: "UTC", label: "UTC" }],
  prefill: {
    tutorSlug: "synthetic-tutor",
    subjectSlug: "math",
    level: "high_school",
    displayTimezone: "UTC",
    startAtUtc: time.startAtUtc,
    endAtUtc: time.endAtUtc,
  },
  prefilledTimes: [{ ...time, tutorTime: time }],
  requestedTime: time,
};

afterEach(() => vi.unstubAllGlobals());

async function submit(name: string) {
  const button = screen.getByRole("button", { name });
  button.focus();
  await act(async () => {
    fireEvent.submit(button.closest("form")!);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

it.each([
  { state: "demo_reserved", retry: false, heading: "saved" },
  { state: "demo_expired", retry: false, heading: "expired" },
  { state: "demo_reserved", retry: true, heading: "saved" },
] as const)(
  "focuses the $heading result after commit (unknown-result retry: $retry)",
  async ({ state, retry, heading }) => {
    // An animation frame can arrive while React is batching async response work.
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      queueMicrotask(() => callback(performance.now()));
      return 1;
    });
    const fetch = vi.fn(async () =>
      Response.json({
        id: "synthetic-reservation",
        state,
        time,
        tutorTime: time,
        expires: time,
      }),
    );
    if (retry)
      fetch.mockRejectedValueOnce(new Error("Synthetic lost response"));
    vi.stubGlobal("fetch", fetch);
    render(<DemoBookingForm {...props} />);
    await submit("Create simulated reservation");
    if (retry) {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The request result is unknown",
      );
      await submit("Retry same request");
      expect(fetch.mock.calls[1]).toEqual(fetch.mock.calls[0]);
    }
    expect(
      screen.getByRole("heading", {
        name: `Simulated reservation ${heading}`,
      }),
    ).toHaveFocus();
    expect(fetch).toHaveBeenCalledTimes(retry ? 2 : 1);
  },
);
