// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  WorkflowActionForm,
  WorkflowRequestForm,
} from "@/features/booking-workflows/forms";
import { AdmissionReviewForms } from "@/features/learner-admission/forms";
import { ScreeningForm } from "@/features/tutor-screening/forms";
import { ClaimLocalReview } from "@/features/local-workflow/review-forms";
import { workspaceLinks } from "@/components/workspace/navigation";
import { formatLessonTime } from "@/features/bookings/format-time";
import { DemoNotice } from "@/features/support/presentation";
import { CaseForm } from "@/features/support/case-form";
import { ChangeAccessForm } from "@/features/account-restrictions/change-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
afterEach(() => vi.restoreAllMocks());
const id = "8d360e91-9f98-44bb-8685-853a4d737638";
const time = formatLessonTime(
  new Date("2030-10-18T03:00:00Z"),
  new Date("2030-10-18T04:00:00Z"),
  "Asia/Manila",
);

describe("ordinary local workflow controls", () => {
  it("requests the selected interval through the ordinary endpoint and reports conflict without success", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json(
          { message: "That time is no longer available." },
          { status: 409 },
        ),
      );
    const choice = {
      learnerId: id,
      tutorSlug: "math-tutor",
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
        source="local_operation"
      />,
    );
    expect(screen.getByRole("radio")).toBeChecked();
    await userEvent.click(
      screen.getByRole("button", { name: "Request booking" }),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("/api/bookings");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      ...choice,
      startAtUtc: time.startAtUtc,
      endAtUtc: time.endAtUtc,
      idempotencyKey: expect.any(String),
    });
    expect(screen.getByRole("alert")).toHaveTextContent("no longer available");
    expect(document.body).not.toHaveTextContent(
      /simulat|synthetic|private staging/i,
    );
  });

  it("cancels with the operating source reason and retains the saved revision", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json(
          { message: "This booking changed. Reload its details." },
          { status: 409 },
        ),
      );
    render(
      <WorkflowActionForm
        bookingId={id}
        revision={7}
        action="cancel"
        scope="guardian"
        privateWorkflow
        source="local_operation"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Cancel booking" }),
    );
    expect(fetcher.mock.calls[0][0]).toBe(
      `/api/bookings/${id}/workflow/cancel`,
    );
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      expectedRevision: 7,
      reasonCode: "local_participant_change",
      requestId: expect.any(String),
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Reload");
    expect(document.body).not.toHaveTextContent(
      /staging changes|synthetic|simulation/i,
    );
  });

  it("submits the same validated IANA timezone used to display a replacement", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json(
          { message: "That time is no longer available." },
          { status: 409 },
        ),
      );
    render(
      <WorkflowActionForm
        bookingId={id}
        revision={2}
        action="reschedule"
        scope="student"
        times={[time]}
        displayTimezone="Asia/Manila"
        privateWorkflow
        source="local_operation"
      />,
    );
    await userEvent.click(screen.getByRole("radio"));
    await userEvent.click(
      screen.getByRole("button", { name: "Reschedule booking" }),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      expectedRevision: 2,
      reasonCode: "local_participant_change",
      requestId: expect.any(String),
      startAtUtc: time.startAtUtc,
      endAtUtc: time.endAtUtc,
      displayTimezone: "Asia/Manila",
    });
  });

  it("claims only the selected exact request and reuses its key after an uncertain result", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("connection interrupted"))
      .mockResolvedValueOnce(
        Response.json(
          { message: "Request is already assigned." },
          { status: 409 },
        ),
      );
    render(<ClaimLocalReview kind="admission" targetId={id} />);
    await userEvent.click(screen.getByRole("button", { name: "Claim review" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "couldn't confirm the assignment",
    );
    await userEvent.click(screen.getByRole("button", { name: "Claim review" }));
    const first = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(first).toEqual({
      kind: "admission",
      targetId: id,
      requestId: expect.any(String),
    });
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual(first);
    expect(screen.getByRole("alert")).toHaveTextContent("already assigned");
    expect(
      screen.queryByRole("button", { name: /approve/i }),
    ).not.toBeInTheDocument();
  });

  it("asks the assigned reviewer for actual local review references without fabricating evidence", () => {
    render(
      <AdmissionReviewForms
        admission={{
          id,
          management: "guardian",
          state: "pending",
          revision: 0,
          policyVersion: "local-admission-v1",
          createdAt: new Date(),
          learner: {
            id,
            displayName: "Learner",
            management: "guardian",
            level: "middle_school",
            grade: 8,
            timezone: "Asia/Manila",
          },
          next: null,
          currentAccess: false,
          evidence: [],
        }}
        privateWorkflow
      />,
    );
    expect(
      screen.getByRole("group", { name: "Record review evidence" }),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Evidence reference" }),
    ).toHaveValue("");
    expect(
      screen.getByRole("option", { name: "Guardian authority" }),
    ).toHaveValue("guardian_authority");
    expect(
      screen.getByRole("option", { name: "Authorize learner access" }),
    ).toHaveValue("authorize");
    expect(document.body).not.toHaveTextContent(
      /fictional|test evidence|synthetic/i,
    );
  });

  it("retains required checks and manual outcomes in ordinary Tutor screening", () => {
    render(
      <ScreeningForm
        tutorId={id}
        detail={{
          state: "pending",
          round: 1,
          revision: 0,
          requiredCodes: ["identity", "eligibility"],
          checks: [],
        }}
        privateWorkflow
        localWorkflow
      />,
    );
    expect(screen.getByRole("button", { name: "Record check" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Approve screening" }),
    ).toBeVisible();
    expect(
      screen.queryByLabelText("Evidence reference"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Checked at")).toHaveAttribute(
      "type",
      "datetime-local",
    );
    expect(screen.getByLabelText("Expires at")).toHaveAttribute(
      "type",
      "datetime-local",
    );
    expect(document.body).toHaveTextContent(
      "current evidence for every required check",
    );
    expect(document.body).not.toHaveTextContent(/fictional|synthetic/i);
  });

  it("keeps saved support actionable without a monitored emergency-service claim", () => {
    render(
      <>
        <DemoNotice localWorkflow />
        <CaseForm localWorkflow />
      </>,
    );
    expect(screen.getByRole("button", { name: "Save report" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue(
      "",
    );
    expect(document.body).toHaveTextContent("not an emergency channel");
    expect(document.body).not.toHaveTextContent(
      /fictional|simulation|Private test/i,
    );
  });

  it("offers operating account reasons without the legacy test reasons", () => {
    render(
      <ChangeAccessForm
        targetId="local-account-id"
        name="Account"
        status="active"
        revision={3}
        localWorkflow
      />,
    );
    expect(
      screen.getByRole("option", { name: "Account restriction" }),
    ).toHaveValue("local_restrict");
    expect(
      screen.getByRole("button", { name: "Suspend account" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("option", { name: /test/i }),
    ).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/fictional|simulat|synthetic/i);
  });

  it("exposes in-app review work only in ordinary Admin navigation and preserves Parent Bookings", () => {
    const normal = {
      privateWorkflow: true,
      privateAccounts: true,
      localWorkflow: true,
    };
    expect(workspaceLinks("admin", normal)).toContainEqual({
      href: "/admin/requests",
      label: "Unassigned reviews",
    });
    expect(
      workspaceLinks("admin", { privateWorkflow: true }),
    ).not.toContainEqual(expect.objectContaining({ href: "/admin/requests" }));
    expect(workspaceLinks("parent", normal)).toContainEqual({
      href: "/bookings?scope=guardian",
      label: "Bookings",
      exact: true,
    });
    expect(workspaceLinks("parent", normal)).not.toContainEqual(
      expect.objectContaining({ href: "/learner-admission" }),
    );
    expect(workspaceLinks("student", normal)).not.toContainEqual(
      expect.objectContaining({ href: "/learner-admission" }),
    );
    expect(workspaceLinks("admin", normal)).toContainEqual({
      href: "/admin/learner-admission",
      label: "Assigned learner review records",
    });
    expect(workspaceLinks("student", { privateWorkflow: true })).toContainEqual(
      {
        href: "/learner-admission",
        label: "Learner requests",
      },
    );
    expect(workspaceLinks("parent", normal)).toContainEqual({
      href: "/bookings/new?scope=guardian",
      label: "Book a session",
      exact: true,
    });
    expect(workspaceLinks("student", normal)).toContainEqual({
      href: "/bookings/new?scope=student",
      label: "Book a session",
      exact: true,
    });
    expect(workspaceLinks("admin", normal)).not.toContainEqual(
      expect.objectContaining({ href: "/admin/safeguarding" }),
    );
  });
});
