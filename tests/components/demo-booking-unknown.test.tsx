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
  await act(async () => {
    fireEvent.submit(button.closest("form")!);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}
const saved = {
  id: "synthetic-reservation",
  state: "demo_reserved",
  time,
  tutorTime: time,
  expires: time,
};
const stub = (...responses: Array<Response | Error>) => {
  const fetch = vi.fn(async () => {
    const next = responses.shift()!;
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

it.each([
  [
    "a 4xx JSON rejection",
    () => Response.json({ message: "Nope." }, { status: 400 }),
  ],
  [
    "an app 503 raised before any reservation",
    () =>
      Response.json(
        { message: "This service is unavailable." },
        { status: 503 },
      ),
  ],
] as const)("keeps the form usable after %s", async (_name, make) => {
  stub(make());
  render(<DemoBookingForm {...props} />);
  await submit("Create simulated reservation");
  expect(screen.getByRole("alert")).not.toHaveTextContent("unknown");
  expect(screen.getByLabelText("Tutor")).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Create simulated reservation" }),
  ).toBeInTheDocument();
});

it.each([
  ["a fetch rejection", () => new Error("offline")],
  [
    "a non-JSON 502",
    () => new Response("<html>Bad gateway</html>", { status: 502 }),
  ],
  [
    "the generic app 503 that can follow a failed commit",
    () =>
      Response.json(
        { message: "This service is unavailable. Try again later." },
        { status: 503 },
      ),
  ],
] as const)("locks to the same request after %s", async (_name, make) => {
  const fetch = stub(
    make(),
    Response.json({ message: "Nope." }, { status: 409 }),
  );
  render(<DemoBookingForm {...props} />);
  await submit("Create simulated reservation");
  expect(screen.getByLabelText("Tutor")).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("result is unknown");
  expect(
    screen.getByRole("link", { name: "Check my bookings" }),
  ).toHaveAttribute("href", "/bookings?scope=guardian");
  // A definite answer to the replay leaves the unknown state.
  await submit("Retry same request");
  expect(fetch.mock.calls[1]).toEqual(fetch.mock.calls[0]);
  expect(screen.getByLabelText("Tutor")).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Create simulated reservation" }),
  ).toBeInTheDocument();
});

it("shows the saved result when the replay succeeds", async () => {
  stub(new Error("offline"), Response.json(saved));
  render(<DemoBookingForm {...props} />);
  await submit("Create simulated reservation");
  await submit("Retry same request");
  expect(
    screen.getByRole("heading", { name: "Simulated reservation saved" }),
  ).toBeInTheDocument();
});
