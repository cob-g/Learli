// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccessError } from "@/lib/permissions/access";
import type { CaseDetail } from "@/features/support/service";

const mocks = vi.hoisted(() => ({
  runtime: { name: "domain runtime" },
  headers: new Headers(),
  runtimeRead: vi.fn(),
  privateMode: vi.fn(),
  load: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  dispatchList: vi.fn(),
  dispatchDetail: vi.fn(),
  booking: vi.fn(),
  push: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => mocks.headers }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: vi.fn() }),
}));
vi.mock("@/lib/auth", () => ({
  getDomainAuthRuntime: mocks.runtimeRead,
}));
vi.mock("@/features/private-workflow/runtime", () => ({
  isPrivateWorkflow: mocks.privateMode,
}));
vi.mock("@/lib/permissions/workspace", () => ({ loadPrivatePage: mocks.load }));
vi.mock("@/features/support/service", () => ({
  listCases: mocks.list,
  readCase: mocks.detail,
}));
vi.mock("@/features/support/dispatch-service", () => ({
  listDispatchCases: mocks.dispatchList,
  readDispatchCase: mocks.dispatchDetail,
}));
vi.mock("@/features/support-bookings/service", () => ({
  readBookingForReport: mocks.booking,
}));
vi.mock("@/features/admin/admin-shell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { DemoNotice } from "@/features/support/presentation";
import { SupportEntry } from "@/features/support/entry";
import { SupportBookingSection } from "@/features/support-bookings/presentation";
import {
  BookingDetailView,
  BookingHistoryView,
} from "@/features/bookings/read-presentation";
import { formatLessonTime } from "@/features/bookings/format-time";
import type {
  BookingDetail,
  BookingPage,
} from "@/features/bookings/read-model";
import type { SupportBookingContext } from "@/features/support-bookings/model";
import ReportsPage from "@/app/(workspace)/support/page";
import ReportPage from "@/app/(workspace)/support/[caseId]/page";
import AssignedReportsPage from "@/app/(workspace)/admin/support/page";
import AssignedReportPage from "@/app/(workspace)/admin/support/[caseId]/page";
import DispatchPage from "@/app/(workspace)/admin/support/dispatch/page";
import AssignmentPage from "@/app/(workspace)/admin/support/dispatch/[caseId]/page";

const caseId = "4f1b2c3d-1111-4222-8333-444455556666";
const savedAt = new Date("2026-10-12T12:00:00Z");
const time = formatLessonTime(
  new Date("2026-11-01T03:00:00Z"),
  new Date("2026-11-01T04:00:00Z"),
  "Asia/Manila",
);
const relatedBooking = {
  available: true,
  source: "synthetic_readiness",
  tutorName: "Fictional tutor",
  subjectName: "Math",
  state: "confirmed",
  time,
  events: [{ event: "workflow_confirmed", time }],
} satisfies SupportBookingContext;
const bookingDetail = {
  id: caseId,
  source: "synthetic_readiness",
  tutor: { displayName: relatedBooking.tutorName, slug: "fictional-tutor" },
  subject: { name: relatedBooking.subjectName, slug: "math" },
  learner: {
    id: caseId,
    displayName: "Fictional learner",
    level: "college_support",
  },
  state: "confirmed",
  persistedState: "confirmed",
  snapshotAtUtc: savedAt.toISOString(),
  expiresAtUtc: savedAt.toISOString(),
  expiryMaterialized: false,
  time,
  expires: time,
  viewerTimezone: "Asia/Manila",
  events: [],
} satisfies BookingDetail;
const summary = {
  id: caseId,
  subject: "Fictional account question",
  category: "account" as const,
  status: "open" as const,
  revision: 2,
  createdAt: savedAt,
  updatedAt: savedAt,
};
const detail = {
  ...summary,
  body: "Fictional report description.",
  history: [],
  booking: relatedBooking,
} satisfies CaseDetail;
const assignment = {
  id: caseId,
  category: "account" as const,
  status: "open" as const,
  revision: 2,
  assigned: false,
  reviewer: null,
};
const params = () => Promise.resolve({ caseId });
const searchParams = () => Promise.resolve({ page: "3" });
const routes = [
  {
    name: "requester list",
    path: "/support",
    page: () => ReportsPage({ searchParams: searchParams() }),
    read: mocks.list,
    args: ["requester", 3],
    title: "Your reports",
    unavailable: "Support cases unavailable",
  },
  {
    name: "requester detail",
    path: `/support/${caseId}`,
    page: () => ReportPage({ params: params() }),
    read: mocks.detail,
    args: [caseId, "requester"],
    title: summary.subject,
    unavailable: "Case unavailable",
  },
  {
    name: "assigned reviewer list",
    path: "/admin/support",
    page: () => AssignedReportsPage({ searchParams: searchParams() }),
    read: mocks.list,
    args: ["reviewer", 3],
    title: "Assigned support cases",
    unavailable: "Support cases unavailable",
  },
  {
    name: "assigned reviewer detail",
    path: `/admin/support/${caseId}`,
    page: () => AssignedReportPage({ params: params() }),
    read: mocks.detail,
    args: [caseId, "reviewer"],
    title: summary.subject,
    unavailable: "Case unavailable",
  },
  {
    name: "dispatch list",
    path: "/admin/support/dispatch",
    page: () => DispatchPage({ searchParams: searchParams() }),
    read: mocks.dispatchList,
    args: [3],
    title: "Local support assignments",
    unavailable: "Assignments unavailable",
  },
  {
    name: "dispatch detail",
    path: `/admin/support/dispatch/${caseId}`,
    page: () =>
      AssignmentPage({ params: params(), searchParams: searchParams() }),
    read: mocks.dispatchDetail,
    args: [caseId, 3],
    title: "Local case assignment",
    unavailable: "Assignment unavailable",
  },
];
const modes = [
  { name: "private", privateWorkflow: true },
  { name: "default", privateWorkflow: false },
];

function expectNotice(privateWorkflow: boolean) {
  const notice = screen.getByText(
    privateWorkflow
      ? /^Private test reports only\./
      : /^Local demo for fictional reports only\./,
  );
  expect(notice).toBeVisible();
  expect(notice).toHaveTextContent(
    "This is not monitored and is not an emergency reporting channel. Do not enter real personal details, dates of birth, school names or private meeting links.",
  );
  expect(
    screen.queryByText(
      privateWorkflow
        ? /^Local demo for fictional reports only\./
        : /^Private test reports only\./,
    ),
  ).not.toBeInTheDocument();
}

function expectRelatedBooking(privateWorkflow: boolean) {
  const booking = screen.getByRole("region", {
    name: privateWorkflow
      ? "Related booking"
      : "Related synthetic readiness booking",
  });
  expect(within(booking).getByText(relatedBooking.tutorName)).toBeVisible();
  expect(within(booking).getByText(relatedBooking.subjectName)).toBeVisible();
  expect(booking).toHaveTextContent(
    privateWorkflow ? "Confirmed" : "Synthetic booking confirmed",
  );
  expect(booking).toHaveTextContent(
    privateWorkflow ? "confirmation saved" : "Synthetic confirmation saved",
  );
  expect(booking).toHaveTextContent(
    privateWorkflow
      ? "Saved booking history"
      : "Saved administrative booking history",
  );
  expect(booking).toHaveTextContent(
    privateWorkflow
      ? "Booking status does not establish payment or attendance"
      : "Confirmation does not establish payment or attendance",
  );
  if (privateWorkflow)
    expect(booking).not.toHaveTextContent(/simulat|synthetic/i);
  expect(within(booking).queryByRole("link")).not.toBeInTheDocument();
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.runtimeRead.mockResolvedValue(mocks.runtime);
  mocks.privateMode.mockReturnValue(false);
  mocks.load.mockImplementation(
    async (
      _path: string,
      load: (runtime: unknown, headers: Headers) => Promise<unknown>,
    ) => {
      try {
        return await load(mocks.runtime, mocks.headers);
      } catch {
        return null;
      }
    },
  );
  mocks.list.mockResolvedValue({ cases: [summary], page: 3, hasMore: true });
  mocks.detail.mockResolvedValue(detail);
  mocks.booking.mockResolvedValue(relatedBooking);
  mocks.dispatchList.mockResolvedValue({
    cases: [assignment],
    page: 3,
    hasMore: true,
  });
  mocks.dispatchDetail.mockResolvedValue({
    ...assignment,
    choices: [],
    history: [],
    page: 3,
    hasMore: true,
  });
});

describe.each(modes)("$name Support copy", ({ privateWorkflow }) => {
  beforeEach(() => mocks.privateMode.mockReturnValue(privateWorkflow));

  it("keeps the reporting warnings in the explicit notice and default fallback", () => {
    render(privateWorkflow ? <DemoNotice privateWorkflow /> : <DemoNotice />);
    expectNotice(privateWorkflow);
  });

  it("uses the validated entry runtime without changing access or booking reads", async () => {
    render(await SupportEntry({ concern: true, bookingId: caseId }));
    expectNotice(privateWorkflow);
    expectRelatedBooking(privateWorkflow);
    expect(
      screen.getByRole("heading", { name: "Report a concern" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Save fictional report" }),
    ).toBeVisible();
    expect(mocks.privateMode).toHaveBeenCalledWith(mocks.runtime);
    expect(mocks.list).toHaveBeenCalledExactlyOnceWith(
      mocks.runtime,
      mocks.headers,
      "requester",
    );
    expect(mocks.booking).toHaveBeenCalledExactlyOnceWith(
      mocks.runtime,
      mocks.headers,
      caseId,
    );
  });

  it("keeps the authorized booking support destination and changes only its visible action", () => {
    render(
      <BookingDetailView
        booking={bookingDetail}
        scope="guardian"
        privateWorkflow={privateWorkflow}
      />,
    );
    expect(
      screen.getByRole("link", {
        name: privateWorkflow
          ? "Report a booking issue"
          : "Report a simulated booking issue",
      }),
    ).toHaveAttribute("href", `/contact?bookingId=${caseId}`);
    expect(
      screen.queryByRole("link", {
        name: privateWorkflow
          ? "Report a simulated booking issue"
          : "Report a booking issue",
      }),
    ).not.toBeInTheDocument();
  });

  it("uses the current mode for the active option while preserving filter values and navigation", async () => {
    const result = {
      items: [],
      learners: [bookingDetail.learner],
      scope: "guardian",
      filter: "active",
      page: 2,
      pageSize: 10,
      hasNext: true,
      viewerTimezone: "Asia/Manila",
      snapshotAtUtc: savedAt.toISOString(),
    } satisfies BookingPage;
    const props = { result, learnerId: bookingDetail.learner.id };
    render(
      privateWorkflow ? (
        <BookingHistoryView {...props} privateWorkflow />
      ) : (
        <BookingHistoryView {...props} />
      ),
    );
    const option = screen.getByRole("option", {
      name: privateWorkflow ? "Active bookings" : "Active simulations",
    });
    expect(option).toHaveAttribute("value", "active");
    expect(screen.getByRole("combobox", { name: "Booking view" })).toHaveValue(
      "active",
    );
    expect(
      screen.queryByRole("option", {
        name: privateWorkflow ? "Active simulations" : "Active bookings",
      }),
    ).not.toBeInTheDocument();
    for (const [name, page] of [
      ["Previous bookings", 1],
      ["Next bookings", 3],
    ] as const)
      expect(screen.getByRole("link", { name })).toHaveAttribute(
        "href",
        `/bookings?scope=guardian&filter=active&page=${page}&pageSize=10&learnerId=${caseId}`,
      );
    await userEvent.click(
      screen.getByRole("button", { name: "Apply booking view" }),
    );
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
      `/bookings?scope=guardian&pageSize=10&learnerId=${caseId}&filter=active`,
    );
  });

  it("keeps sign-in refusal and the intended booking return path", async () => {
    mocks.list.mockRejectedValue(new AccessError(401));
    render(await SupportEntry({ concern: true, bookingId: caseId }));
    expectNotice(privateWorkflow);
    expect(
      screen.getByRole("heading", { name: "Sign in for fictional testing" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        privateWorkflow
          ? "Use an active verified test account to save a fictional report."
          : "Use an active verified synthetic account to save a fictional report.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/sign-in?next=${encodeURIComponent(`/report-a-concern?bookingId=${caseId}`)}`,
    );
    expect(
      screen.queryByRole("button", { name: "Save fictional report" }),
    ).not.toBeInTheDocument();
    expect(mocks.booking).not.toHaveBeenCalled();
  });

  it.each(routes)(
    "propagates the validated mode through $name and preserves the scoped read",
    async ({ page, path, read, args, title }) => {
      render(await page());
      expectNotice(privateWorkflow);
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
      expect(mocks.load).toHaveBeenCalledExactlyOnceWith(
        path,
        expect.any(Function),
      );
      expect(mocks.privateMode).toHaveBeenCalledWith(mocks.runtime);
      expect(read).toHaveBeenCalledExactlyOnceWith(
        mocks.runtime,
        mocks.headers,
        ...args,
      );
      if (path.includes("/dispatch")) {
        expect(screen.queryByText(detail.body)).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: "Save case status" }),
        ).not.toBeInTheDocument();
      } else if (path.endsWith(caseId)) {
        expect(screen.getByText(detail.body)).toBeVisible();
        expectRelatedBooking(privateWorkflow);
        const statusButton = screen.queryByRole("button", {
          name: "Save case status",
        });
        if (path.startsWith("/admin")) expect(statusButton).toBeVisible();
        else expect(statusButton).not.toBeInTheDocument();
      } else {
        expect(
          screen.getByRole("link", { name: summary.subject }),
        ).toHaveAttribute("href", `${path}/${caseId}`);
      }
    },
  );

  it("keeps dispatch-only access separate from assigned case content", async () => {
    mocks.list.mockRejectedValue(new AccessError(403));
    render(await AssignedReportsPage({ searchParams: searchParams() }));
    expectNotice(privateWorkflow);
    expect(
      screen.getByRole("heading", { name: "No cases assigned to you" }),
    ).toBeVisible();
    expect(screen.queryByText(detail.body)).not.toBeInTheDocument();
    expect(mocks.dispatchList).toHaveBeenCalledExactlyOnceWith(
      mocks.runtime,
      mocks.headers,
    );
  });
});

it("preserves legacy fixture labels and safe empty or unavailable related context", () => {
  const view = render(
    <SupportBookingSection
      booking={{
        ...relatedBooking,
        source: undefined,
        state: "demo_confirmed",
        events: [],
      }}
      privateWorkflow
    />,
  );
  expect(screen.getByText("Fixture confirmation")).toBeVisible();
  expect(
    screen.queryByText("Confirmed", { exact: true }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("No saved booking events.")).toBeVisible();
  view.rerender(
    <SupportBookingSection booking={{ available: false }} privateWorkflow />,
  );
  expect(
    screen.getByRole("heading", { name: "Related booking" }),
  ).toBeVisible();
  expect(screen.getByText(/Booking context is unavailable/)).toBeVisible();
  expect(screen.queryByText(relatedBooking.tutorName)).not.toBeInTheDocument();
  view.rerender(
    <SupportBookingSection booking={{ ...relatedBooking, events: [] }} />,
  );
  expect(screen.getByText("No saved simulation events.")).toBeVisible();
});

it.each(routes)(
  "preserves the unavailable result for $name without loading report content",
  async ({ page, read, unavailable }) => {
    mocks.privateMode.mockReturnValue(true);
    mocks.load.mockResolvedValue(null);
    render(await page());
    expect(screen.getByRole("heading", { name: unavailable })).toBeVisible();
    expect(
      screen.queryByText(/^Private test reports only\./),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(detail.body)).not.toBeInTheDocument();
    expect(read).not.toHaveBeenCalled();
  },
);

it("keeps the fallback entry notice when no domain runtime is available", async () => {
  mocks.runtimeRead.mockResolvedValue(null);
  mocks.privateMode.mockReturnValue(true);
  render(await SupportEntry({}));
  expectNotice(false);
  expect(
    screen.getByRole("heading", { name: "Local reporting unavailable" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Save fictional report" }),
  ).not.toBeInTheDocument();
  expect(mocks.privateMode).not.toHaveBeenCalled();
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.booking).not.toHaveBeenCalled();
});
