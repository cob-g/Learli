// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => "/",
}));

import { BookingReadStatus } from "@/features/bookings/read-status";
import {
  DemoCancelControl,
  DemoRescheduleForm,
} from "@/features/bookings/lifecycle-controls";
import { BookingMeetingSection } from "@/features/booking-meeting-links/meeting-section";
import TutorError from "@/app/(workspace)/tutor/error";
import LearnerAdmissionError from "@/app/(workspace)/learner-admission/error";
import AdminAdmissionError from "@/app/(workspace)/admin/learner-admission/error";
import { TimeOffForm } from "@/features/time-off/time-off-form";
import { SessionList } from "@/features/account-sessions/session-list";
import type { BookingDetail } from "@/features/bookings/read-model";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  refresh.mockClear();
});

const time = {
  startAtUtc: "2026-10-17T02:00:00.000Z",
  endAtUtc: "2026-10-17T03:00:00.000Z",
  date: "Saturday, October 17, 2026",
  time: "10:00 – 11:00 AM",
  zone: "Philippine Standard Time (GMT+8)",
};
const id = "b24ff392-fdbb-4ae1-9fa3-a7c750c70737";
const booking = {
  id,
  source: "local_simulation",
  logicalBookingId: id,
  revision: 0,
  currentHeadId: id,
  tutor: { displayName: "T", slug: "t" },
  subject: { name: "Math", slug: "math" },
  learner: { id: "l", displayName: "L", level: "elementary" },
  state: "demo_reserved",
  persistedState: "demo_reserved",
  snapshotAtUtc: "2026-10-12T00:00:00.000Z",
  expiresAtUtc: "2026-10-12T00:10:00.000Z",
  expiryMaterialized: false,
  time,
  expires: time,
  viewerTimezone: "Asia/Manila",
  events: [],
} as unknown as BookingDetail;

describe("read status expiry", () => {
  it("refreshes the server page once when the deadline passes", () => {
    vi.useFakeTimers();
    render(<BookingReadStatus booking={booking} />);
    expect(refresh).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Simulation expired")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("lifecycle non-JSON refusals", () => {
  it("keeps cancel retryable after a non-JSON refusal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>", { status: 502 })),
    );
    const { container } = render(
      <DemoCancelControl booking={booking} scope="guardian" />,
    );
    const details = container.querySelector("details");
    details?.setAttribute("open", "");
    const button = screen.getByRole("button", {
      name: "Confirm simulated cancellation",
    });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "could not be changed",
      ),
    );
    expect(button).toBeEnabled();
  });
  it("treats a non-JSON reschedule refusal as a definite result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("oops", { status: 500 })),
    );
    render(
      <DemoRescheduleForm booking={booking} scope="guardian" times={[time]} />,
    );
    await userEvent.click(screen.getByRole("radio"));
    await userEvent.click(
      screen.getByRole("button", { name: "Move simulated reservation" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("could not be moved"),
    );
    expect(screen.getByRole("radio")).toBeEnabled();
  });
});

describe("meeting link save", () => {
  it("confirms the save even when the reload fails", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetch);
    render(
      <BookingMeetingSection
        bookingId={id}
        initial={{ state: "missing", canEdit: true, revision: 0 } as never}
      />,
    );
    const input = screen.getByLabelText(/test link/i);
    await waitFor(() => expect(input).toBeEnabled());
    await userEvent.type(input, "https://zoom.us/j/123");
    await userEvent.click(
      screen.getByRole("button", { name: "Save test meeting link" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /saved.*could not be reloaded/i,
      ),
    );
  });
});

describe("error boundaries", () => {
  it("tutor error is generic and retries", async () => {
    const reset = vi.fn();
    render(<TutorError reset={reset} />);
    expect(screen.queryByText(/bookings/i)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalled();
  });
  it.each([
    ["learner", LearnerAdmissionError],
    ["admin", AdminAdmissionError],
  ])("%s admission error offers a working retry", async (_n, Page) => {
    const reset = vi.fn();
    render(<Page reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(reset).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalled();
  });
});

describe("time off pending", () => {
  it("explains a Remove click while an add is saving", async () => {
    let release!: (r: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((r) => (release = r))),
    );
    render(
      <TimeOffForm
        zoneLabel="Manila"
        initial={
          {
            timezone: "Asia/Manila",
            version: 1,
            exceptions: [
              {
                id: "e1",
                startAtUtc: "2026-11-01T00:00:00.000Z",
                endAtUtc: "2026-11-02T00:00:00.000Z",
              },
            ],
          } as never
        }
      />,
    );
    fireEvent.change(screen.getByLabelText("Start date and time"), {
      target: { value: "2026-12-01T09:00" },
    });
    fireEvent.change(screen.getByLabelText("End date and time"), {
      target: { value: "2026-12-02T09:00" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Add time off" }));
    const remove = screen.getByRole("button", {
      name: /Remove time off starting/,
    });
    await waitFor(() =>
      expect(remove).toHaveAttribute("aria-disabled", "true"),
    );
    fireEvent.click(remove);
    expect(
      screen.getByText("Wait for the current change to finish."),
    ).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(1);
    release(new Response("{}", { status: 400 }));
  });
});

describe("session list", () => {
  const session = (sid: string) => ({
    id: sid,
    current: sid === "c",
    reportedDevice: "Chrome",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    expiresAt: "2026-11-01T00:00:00.000Z",
  });
  it("ignores a stale response and reports non-JSON errors honestly", async () => {
    const resolvers: ((r: Response) => void)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((r) => resolvers.push(r))),
    );
    render(<SessionList />);
    // Initial load pending; a second load must supersede it.
    await act(async () => {});
    expect(resolvers).toHaveLength(1);
    // Resolve first with a list, then trigger refresh via Refresh button.
    await act(async () => {
      resolvers[0](
        new Response(
          JSON.stringify({ sessions: [session("c"), session("o")] }),
        ),
      );
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Refresh sessions" }),
    );
    expect(resolvers).toHaveLength(2);
    await act(async () => {
      resolvers[1](new Response("<html>", { status: 500 }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sessions could not be loaded. Try again.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("connection");
  });
});
