// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  bookingStatusLabel,
  PrivateWorkflowNotice,
} from "@/features/private-workflow/notice";
import {
  FamilyDashboard,
  type DashboardData,
} from "@/features/family-dashboard/dashboard";
import { reservationView } from "@/features/family-dashboard/model";
import {
  TutorBookingAgenda,
  type TutorAgendaBooking,
} from "@/features/tutors/booking-agenda";
import { WorkflowRequestForm } from "@/features/booking-workflows/forms";
import { BookingMeetingSection } from "@/features/booking-meeting-links/meeting-section";
import { formatLessonTime } from "@/features/bookings/format-time";
import { ReviewNotice } from "@/features/tutors/review-notice";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
afterEach(() => vi.restoreAllMocks());

const checkedAt = formatLessonTime(
  new Date("2026-11-01T01:00:00Z"),
  new Date("2026-11-01T01:00:00Z"),
  "Asia/Manila",
);
const time = formatLessonTime(
  new Date("2026-11-01T03:00:00Z"),
  new Date("2026-11-01T04:00:00Z"),
  "Asia/Manila",
);
const learner = {
  id: "8882c040-903c-4fb4-82b1-03c57b82e31d",
  displayName: "Fictional learner",
  level: "high_school" as const,
};
const row = reservationView(
  {
    id: "e5697a4c-0fd7-4372-8a3d-5ff50703be96",
    learner,
    tutorName: "Fictional tutor",
    subjectName: "Math",
    startAtUtc: time.startAtUtc,
    endAtUtc: time.endAtUtc,
    expiresAt: "2026-11-01T01:10:00Z",
    state: "confirmed",
  },
  "Asia/Manila",
);
const dashboard: DashboardData = {
  workspace: "parent",
  learners: [learner],
  query: {},
  active: [row],
  history: [],
  activeHasNext: false,
  historyHasNext: false,
  checkedAt,
};

describe("explicit private workflow presentation", () => {
  it("makes fictional-only scope and disabled payments visible without an action", () => {
    render(<PrivateWorkflowNotice />);
    const notice = screen.getByRole("complementary", {
      name: "Private staging",
    });
    expect(notice).toHaveTextContent("fictional test data only");
    expect(notice).toHaveTextContent("Payments are disabled");
    expect(within(notice).queryByRole("button")).not.toBeInTheDocument();
  });

  it("requires an explicit display flag and preserves historical fixture semantics", () => {
    expect(bookingStatusLabel("confirmed")).toMatch(/Synthetic/);
    expect(bookingStatusLabel("confirmed", true)).toBe("Confirmed");
    expect(bookingStatusLabel("completed", true)).toBe("Completed");
    expect(bookingStatusLabel("demo_confirmed", true)).toBe(
      bookingStatusLabel("demo_confirmed"),
    );
    expect(bookingStatusLabel("demo_completed", true)).toMatch(/Fixture/);
  });

  it("directs a Parent with no authorized learner to review rather than fixture creation", () => {
    render(
      <FamilyDashboard
        data={{ ...dashboard, learners: [], active: [] }}
        privateWorkflow
      />,
    );
    expect(screen.getByRole("link", { name: "Add a learner" })).toHaveAttribute(
      "href",
      "/learner-admission/new",
    );
    expect(
      screen.getByRole("link", { name: "View admission requests" }),
    ).toHaveAttribute("href", "/learner-admission");
    expect(
      screen.queryByRole("link", { name: "New booking" }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/learners/new"]')).toBeNull();
    expect(
      screen.getByText(/Pending requests grant no learner or booking access/),
    ).toBeVisible();
  });

  it("shows confirmed session coordination without an expiry or direct meeting access", () => {
    render(<FamilyDashboard data={dashboard} privateWorkflow />);
    const next = screen
      .getByRole("heading", { name: "Next session" })
      .closest("section")!;
    expect(within(next).getByText("Confirmed")).toBeVisible();
    expect(next).not.toHaveTextContent(/deadline|expires at/i);
    expect(
      within(next).getByRole("link", { name: /View booking for/ }),
    ).toHaveAttribute("href", `/bookings/${row.id}?scope=guardian`);
    expect(
      within(next).queryByRole("link", { name: /meeting|join/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New booking" })).toHaveAttribute(
      "href",
      "/bookings/new",
    );
  });

  it("keeps Tutor status and history visible without adding an acceptance action", () => {
    const booking: TutorAgendaBooking = {
      id: row.id,
      detailHref: `/bookings/${row.id}?scope=tutor`,
      state: "confirmed",
      learnerLabel: learner.displayName,
      learnerLevel: "High School",
      subject: "Math",
      time,
      expiry: row.expiry,
    };
    render(
      <TutorBookingAgenda
        active={[booking]}
        history={[{ ...booking, id: "completed", state: "completed" }]}
        evaluatedAt={checkedAt.startAtUtc}
        hasMoreActive={false}
        hasMoreHistory={false}
        privateWorkflow
      />,
    );
    expect(screen.getByText("Confirmed")).toBeVisible();
    expect(screen.getByText("Completed")).toBeVisible();
    expect(screen.getByRole("heading", { name: "History" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /accept|confirm|pay/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Simulation expires at/)).not.toBeInTheDocument();
  });

  it("does not equate profile approval with current screened eligibility", () => {
    render(<ReviewNotice status="approved" privateWorkflow />);
    expect(
      screen.getByText(/Current screening is also required/),
    ).toBeVisible();
    expect(screen.queryByText(/profile is listed/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /approve|accept/i }),
    ).not.toBeInTheDocument();
  });

  it("submits the selected interval through the existing provisional booking endpoint", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json(
          { message: "The selected time is unavailable." },
          { status: 409 },
        ),
      );
    const choice = {
      learnerId: learner.id,
      tutorSlug: "fictional-tutor",
      subjectSlug: "math",
      displayTimezone: "Asia/Manila",
    };
    render(
      <WorkflowRequestForm
        choice={choice}
        times={[time]}
        requestedTime={time}
        scope="guardian"
        privateWorkflow
      />,
    );
    expect(screen.getByRole("radio")).toBeChecked();
    await userEvent.click(
      screen.getByRole("button", { name: "Request booking" }),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [endpoint, request] = fetcher.mock.calls[0];
    expect(endpoint).toBe("/api/bookings/demo");
    expect(request?.method).toBe("POST");
    expect(JSON.parse(String(request?.body))).toEqual({
      ...choice,
      startAtUtc: time.startAtUtc,
      endAtUtc: time.endAtUtc,
      idempotencyKey: expect.any(String),
    });
    expect(screen.getByRole("alert")).toHaveTextContent("unavailable");
    expect(
      screen.queryByRole("button", { name: /confirm|pay/i }),
    ).not.toBeInTheDocument();
  });

  it("opens a participant link through the authorization endpoint and keeps editing scoped", () => {
    render(
      <BookingMeetingSection
        bookingId={row.id}
        initial={{
          state: "present",
          canEdit: false,
          provider: "google_meet",
          revision: 1,
          url: "https://meet.google.com/abc-defg-hij",
        }}
        privateWorkflow
      />,
    );
    const link = screen.getByRole("link", { name: /Open meeting on/ });
    expect(link).toHaveAttribute(
      "href",
      `/api/bookings/${row.id}/meeting-link?open=1`,
    );
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Save|Replace/ }),
    ).not.toBeInTheDocument();
  });

  it("saves a Tutor-provided link without a meeting-arranged or attendance claim", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(
        Response.json({
          state: "present",
          canEdit: true,
          provider: "zoom",
          revision: 1,
          url: "https://zoom.us/j/123456789",
        }),
      );
    render(
      <BookingMeetingSection
        bookingId={row.id}
        initial={{ state: "missing", canEdit: true, revision: 0 }}
        privateWorkflow
      />,
    );
    await userEvent.type(
      screen.getByRole("textbox"),
      "https://zoom.us/j/123456789",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save meeting link" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Private meeting link saved.",
      ),
    );
    expect(fetcher.mock.calls[0][0]).toBe(
      `/api/bookings/${row.id}/meeting-link`,
    );
    expect(fetcher.mock.calls[0][1]?.method).toBe("PUT");
    expect(
      screen.getByRole("button", { name: "Replace meeting link" }),
    ).toBeEnabled();
    expect(
      screen.getByText(
        /does not host calls, check meeting settings or verify attendance/,
      ),
    ).toBeVisible();
    expect(screen.getByRole("status")).not.toHaveTextContent(
      /arranged|attendance/,
    );
  });
});
