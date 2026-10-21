// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  bookingDiscoveryHref,
  bookingSelectionHref,
} from "@/features/bookings/selection";
import {
  independentAdmissionHref,
  studentAdmissionRequestHref,
  studentOnboardingHref,
} from "@/features/student-onboarding/continuation";

const reads = vi.hoisted(() => ({
  load: vi.fn(),
  onboarding: vi.fn(),
  studentReady: vi.fn(),
  intake: vi.fn(),
  admission: vi.fn(),
  account: vi.fn(),
  accountRuntime: vi.fn(),
  domainRuntime: vi.fn(),
  privateWorkflow: vi.fn(),
  localWorkflow: vi.fn(),
  identity: vi.fn(),
  list: vi.fn(),
  groups: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/permissions/workspace", () => ({ loadPrivatePage: reads.load }));
vi.mock("@/features/student-onboarding/read", () => ({
  readStudentOnboarding: reads.onboarding,
  canOpenStudentWorkspace: reads.studentReady,
}));
vi.mock("@/features/learner-admission/context", () => ({
  admissionContext: (runtime: unknown) => runtime,
}));
vi.mock("@/features/learner-admission/service", () => ({
  readAdmissionIntake: reads.intake,
  readMyAdmission: reads.admission,
  listMyAdmissions: reads.list,
}));
vi.mock("@/features/local-workflow/runtime", () => ({
  getLocalWorkflow: reads.localWorkflow,
}));
vi.mock("@/lib/permissions/access", async (original) => ({
  ...(await original<typeof import("@/lib/permissions/access")>()),
  requireIdentity: reads.identity,
}));
vi.mock("@/features/learners/composition", () => ({
  listLearnerGroups: reads.groups,
}));
vi.mock("@/features/learners/service", () => ({
  readLearnerCreationContext: vi.fn(),
}));
vi.mock("@/features/private-workflow/runtime", () => ({
  isPrivateWorkflow: reads.privateWorkflow,
}));
vi.mock("@/features/learner-admission/forms", () => ({
  AdmissionForm: ({
    initialManagement,
    next,
  }: {
    initialManagement: string;
    next?: string;
  }) => (
    <form
      aria-label="Admission details"
      data-management={initialManagement}
      data-next={next}
    />
  ),
}));
vi.mock("next/navigation", () => ({ redirect: reads.redirect }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/features/learners/learner-link", () => ({
  LearnerLink: ({ label, href }: { label: string; href: string }) => (
    <a href={href}>{label}</a>
  ),
}));
vi.mock("@/features/independent-learner/form", () => ({
  IndependentLearnerForm: ({ next }: { next?: string }) => (
    <form aria-label="College Student profile" data-next={next} />
  ),
}));
vi.mock("@/lib/auth", () => ({
  getAccountAuthRuntime: reads.accountRuntime,
  getDomainAuthRuntime: reads.domainRuntime,
}));
vi.mock("@/features/account/service", () => ({ readAccount: reads.account }));
vi.mock("@/features/account/account-form", () => ({
  AccountForm: () => <form aria-label="Account profile" />,
}));
vi.mock("@/features/account-password/password-form", () => ({
  PasswordForm: () => null,
}));
vi.mock("@/features/auth/sign-out", () => ({
  SignOut: () => <button>Sign out</button>,
}));
vi.mock("@/lib/time/zones", () => ({
  listTimeZoneOptions: () => [{ value: "UTC", label: "UTC" }],
}));

import StudentOnboardingPage from "@/app/(workspace)/student/onboarding/page";
import NewAdmissionPage from "@/app/(workspace)/learner-admission/new/page";
import AdmissionPage from "@/app/(workspace)/learner-admission/[admissionId]/page";
import AccountPage from "@/app/(workspace)/account/page";
import AdmissionListPage from "@/app/(workspace)/learner-admission/page";
import LearnersPage from "@/app/(workspace)/learners/page";

const choice = bookingSelectionHref(
  {
    tutorSlug: "college-science",
    subjectSlug: "science",
    level: "college_support",
    displayTimezone: "Asia/Manila",
    startAtUtc: "2030-10-16T03:00:00.000Z",
    endAtUtc: "2030-10-16T04:00:00.000Z",
  },
  true,
);
const originalChoice = bookingDiscoveryHref({
  tutorSlug: "original-tutor",
  subjectSlug: "math",
});
const requestHeaders = new Headers();
const runtime = {};
function admissionRow(
  state = "pending",
  currentAccess = false,
  management = "self",
) {
  return {
    id: "own-self-request",
    learner: {
      displayName: "Fictional College learner",
      level: "college_support",
    },
    state,
    currentAccess,
    management,
    policyVersion: "synthetic-admission-v1",
    next: originalChoice,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  reads.load.mockImplementation(
    (_path, load: (runtime: unknown, headers: Headers) => unknown) =>
      load(runtime, requestHeaders),
  );
  reads.onboarding.mockResolvedValue({
    kind: "legacy",
    enabled: true,
    admissionId: null,
    existingLearnerId: null,
  });
  reads.intake.mockResolvedValue({
    enabled: true,
    policyVersion: "synthetic-admission-v1",
    policyDigest: "a".repeat(64),
  });
  reads.admission.mockResolvedValue(admissionRow());
  reads.privateWorkflow.mockReturnValue(true);
  reads.localWorkflow.mockReturnValue(null);
  reads.identity.mockResolvedValue({ roles: [] });
  reads.list.mockResolvedValue({ items: [], nextCursor: null });
  reads.groups.mockResolvedValue({
    demo: [],
    readiness: [],
    demoAllowed: false,
    admissionEnabled: true,
  });
  reads.redirect.mockImplementation(() => {
    throw new Error("navigation redirect");
  });
  reads.accountRuntime.mockResolvedValue(runtime);
  reads.domainRuntime.mockResolvedValue(runtime);
  reads.account.mockResolvedValue({
    email: "college@example.test",
    timezone: "UTC",
    roles: [],
  });
  reads.studentReady.mockResolvedValue(false);
});

describe("College Student onboarding and admission pages", () => {
  it("describes a direct automatic-child receipt as consent, without inventing assigned review", async () => {
    reads.admission.mockResolvedValue({
      ...admissionRow("authorized", true, "guardian"),
      policyVersion: "local-guardian-admission-v2",
    });
    render(
      await AdmissionPage({
        params: Promise.resolve({ admissionId: "own-self-request" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Child profile consent record" }),
    ).toBeVisible();
    expect(
      screen.getByText(/guardian declaration, consent and current access/),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "My Children" })).toHaveAttribute(
      "href",
      "/parent/children",
    );
    expect(
      screen.queryByText(/learner’s review status|Assigned review is required/),
    ).toBeNull();
  });

  it("shows truthful disabled intake with no form or workspace link", async () => {
    reads.onboarding.mockResolvedValue({
      kind: "independent",
      enabled: false,
      admissionId: null,
      existingLearnerId: null,
    });
    render(
      await StudentOnboardingPage({
        searchParams: Promise.resolve({ next: choice }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Set up your Student profile" }),
    ).toBeVisible();
    expect(
      screen.getByText(/Independent Student setup is unavailable/),
    ).toHaveTextContent("No learner details are collected");
    expect(
      screen.queryByRole("link", { name: "Request independent admission" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Student workspace" }),
    ).not.toBeInTheDocument();
    expect(document.querySelector("form")).toBeNull();
  });
  it("guides a verified fresh account into self intake and preserves its safe sign-in recovery", async () => {
    reads.onboarding.mockResolvedValue({
      kind: "independent",
      enabled: true,
      admissionId: null,
      existingLearnerId: null,
      policyVersion: "local-independent-admission-v2",
      policyDigest: "b".repeat(64),
      noticeVersion: "local-independent-notice-v2",
      timezone: "Asia/Manila",
    });
    render(
      await StudentOnboardingPage({
        searchParams: Promise.resolve({ next: choice }),
      }),
    );
    expect(reads.load).toHaveBeenCalledWith(
      studentOnboardingHref(choice),
      reads.onboarding,
    );
    expect(
      screen.getByRole("form", { name: "College Student profile" }),
    ).toHaveAttribute("data-next", choice);
    expect(
      screen.getByText(/College Support is an education level/),
    ).toHaveTextContent("does not establish that you are an adult");
  });
  it("retains synthetic readiness intake outside the ordinary local workflow", async () => {
    render(
      await StudentOnboardingPage({
        searchParams: Promise.resolve({ next: choice }),
      }),
    );
    expect(
      screen.getByRole("link", { name: "Request independent admission" }),
    ).toHaveAttribute("href", independentAdmissionHref(choice));
  });
  it("reopens an existing self request with the current public choice", async () => {
    reads.onboarding.mockResolvedValue({
      kind: "legacy",
      enabled: false,
      admissionId: "own-self-request",
      existingLearnerId: null,
    });
    await expect(
      StudentOnboardingPage({
        searchParams: Promise.resolve({ next: choice }),
      }),
    ).rejects.toThrow("navigation redirect");
    expect(reads.redirect).toHaveBeenCalledWith(
      studentAdmissionRequestHref("own-self-request", choice),
    );
    expect(reads.intake).not.toHaveBeenCalled();
  });
  it("initializes the existing admission form to self without granting access and retains a canonical recovery path", async () => {
    render(
      await NewAdmissionPage({
        searchParams: Promise.resolve({ management: "self", next: choice }),
      }),
    );
    expect(
      screen.getByRole("form", { name: "Admission details" }),
    ).toHaveAttribute("data-management", "self");
    expect(
      screen.getByRole("form", { name: "Admission details" }),
    ).toHaveAttribute("data-next", choice);
    const recovery = new URL(
      reads.load.mock.calls[0][0],
      "http://learli.invalid",
    );
    expect(recovery.searchParams.get("management")).toBe("self");
    expect(recovery.searchParams.get("next")).toBe(
      choice.replace("/bookings/new", "/bookings/demo"),
    );
    expect(
      screen.queryByRole("link", { name: "Student workspace" }),
    ).not.toBeInTheDocument();
  });
  it.each(
    [undefined, "self", "guardian", ["self", "guardian"]].map((management) => ({
      management,
    })),
  )(
    "redirects a fresh ordinary non-parent to self-service instead of legacy intake: $management",
    async ({ management }) => {
      reads.localWorkflow.mockReturnValue({});
      await expect(
        NewAdmissionPage({
          searchParams: Promise.resolve({ management, next: choice }),
        }),
      ).rejects.toThrow("navigation redirect");
      expect(reads.redirect).toHaveBeenCalledWith(
        studentOnboardingHref(choice),
      );
      expect(reads.intake).not.toHaveBeenCalled();
    },
  );
  it("keeps ordinary Parent intake on Add Child while honoring explicit independent intent", async () => {
    reads.localWorkflow.mockReturnValue({});
    reads.identity.mockResolvedValue({ roles: ["parent"] });
    await expect(
      NewAdmissionPage({ searchParams: Promise.resolve({ next: choice }) }),
    ).rejects.toThrow("navigation redirect");
    expect(reads.redirect).toHaveBeenLastCalledWith(
      `/parent/children/new?next=${encodeURIComponent(choice)}`,
    );
    await expect(
      NewAdmissionPage({
        searchParams: Promise.resolve({ management: "self", next: choice }),
      }),
    ).rejects.toThrow("navigation redirect");
    expect(reads.redirect).toHaveBeenLastCalledWith(
      studentOnboardingHref(choice),
    );
    expect(reads.intake).not.toHaveBeenCalled();
  });
  it("retains ordinary historical request links without advertising new review intake", async () => {
    reads.localWorkflow.mockReturnValue({});
    reads.list.mockResolvedValue({
      items: [
        { ...admissionRow(), createdAt: new Date("2026-10-12T12:00:00Z") },
      ],
      nextCursor: null,
    });
    render(await AdmissionListPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("heading", { name: "Earlier learner review records" }),
    ).toBeVisible();
    expect(
      screen.getByText(/retained records cover earlier or exceptional/),
    ).toHaveTextContent("use self-service setup");
    expect(screen.getByRole("link", { name: "Open record" })).toHaveAttribute(
      "href",
      "/learner-admission/own-self-request",
    );
    expect(document.body).not.toHaveTextContent("Your admission requests");
    expect(
      screen.queryByRole("link", { name: "Request admission review" }),
    ).toBeNull();
  });
  it("points a fresh ordinary learner list to Student setup without manual-review advertisements", async () => {
    reads.localWorkflow.mockReturnValue({});
    render(await LearnersPage());
    expect(
      screen.getByRole("link", { name: "Set up your Student profile" }),
    ).toHaveAttribute("href", "/student/onboarding");
    expect(document.querySelector('a[href^="/learner-admission"]')).toBeNull();
    expect(document.body).not.toHaveTextContent(
      /Request an admission review|pending reviews/i,
    );
  });
  it("does not interpret duplicate management or forged private choice as admission authority", async () => {
    render(
      await NewAdmissionPage({
        searchParams: Promise.resolve({
          management: ["self", "guardian"],
          next: `${choice}&learnerId=foreign`,
        }),
      }),
    );
    expect(
      screen.getByRole("form", { name: "Admission details" }),
    ).toHaveAttribute("data-management", "guardian");
    expect(
      screen.getByRole("form", { name: "Admission details" }),
    ).not.toHaveAttribute("data-next");
    expect(reads.load.mock.calls[0][0]).toBe("/learner-admission/new");
  });
  it("retains a new public choice when reopening an old request without changing its saved selection or read authority", async () => {
    const row = admissionRow();
    reads.admission.mockResolvedValue(row);
    render(
      await AdmissionPage({
        params: Promise.resolve({ admissionId: row.id }),
        searchParams: Promise.resolve({ next: choice }),
      }),
    );
    expect(
      screen.getByRole("link", { name: "Return to selected tutor and time" }),
    ).toHaveAttribute("href", choice);
    expect(screen.getByText(/This visit’s public selection/)).toHaveTextContent(
      "without changing the saved admission request",
    );
    expect(row.next).toBe(originalChoice);
    expect(reads.admission).toHaveBeenCalledWith(
      runtime,
      requestHeaders,
      row.id,
    );
    const recovery = new URL(
      reads.load.mock.calls[0][0],
      "http://learli.invalid",
    );
    expect(recovery.searchParams.get("next")).toBe(
      choice.replace("/bookings/new", "/bookings/demo"),
    );
    expect(
      screen.queryByRole("link", { name: "Student workspace" }),
    ).not.toBeInTheDocument();
  });
  it.each(
    [
      [choice, choice],
      `${choice}&role=student`,
      "https://unrelated.test",
      "/student/onboarding?next=%2Fadmin",
    ].map((next) => ({ next })),
  )(
    "falls back to the immutable original choice for an unsafe detail continuation: $next",
    async ({ next }) => {
      render(
        await AdmissionPage({
          params: Promise.resolve({ admissionId: "own-self-request" }),
          searchParams: Promise.resolve({ next }),
        }),
      );
      expect(
        screen.getByRole("link", {
          name: "Return to selected tutor and subject",
        }),
      ).toHaveAttribute(
        "href",
        originalChoice.replace("/bookings/demo", "/bookings/new"),
      );
      expect(reads.load.mock.calls[0][0]).toBe(
        "/learner-admission/own-self-request",
      );
    },
  );
  it.each([
    ["pending", false, "self", false],
    ["rejected", false, "self", false],
    ["revoked", false, "self", false],
    ["authorized", false, "self", false],
    ["authorized", true, "guardian", false],
    ["authorized", true, "self", true],
  ] as const)(
    "shows Student workspace only for current self authorization: %s/%s/%s",
    async (state, current, management, visible) => {
      reads.admission.mockResolvedValue(
        admissionRow(state, current, management),
      );
      render(
        await AdmissionPage({
          params: Promise.resolve({ admissionId: "own-self-request" }),
          searchParams: Promise.resolve({}),
        }),
      );
      const link = screen.queryByRole("link", { name: "Student workspace" });
      if (visible) expect(link).toHaveAttribute("href", "/student");
      else expect(link).not.toBeInTheDocument();
    },
  );
});

describe("Account College Student access links", () => {
  it("labels retained review history neutrally in the ordinary local workflow", async () => {
    reads.localWorkflow.mockReturnValue({});
    render(await AccountPage());
    expect(
      screen.getByRole("link", { name: "Earlier learner review records" }),
    ).toHaveAttribute("href", "/learner-admission");
    expect(
      screen.queryByRole("link", { name: "Learner admission requests" }),
    ).not.toBeInTheDocument();
  });
  it("keeps a roleless hosted account usable without requiring a domain runtime", async () => {
    reads.domainRuntime.mockRejectedValue(new Error("domain unavailable"));
    render(await AccountPage());
    expect(screen.getByRole("heading", { name: "Your account" })).toBeVisible();
    expect(screen.getByRole("form", { name: "Account profile" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Set up College Student" }),
    ).toHaveAttribute("href", "/student/onboarding");
    expect(reads.domainRuntime).not.toHaveBeenCalled();
    expect(reads.studentReady).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    "shows a Student workspace only after current access is proven: %s",
    async (ready) => {
      reads.account.mockResolvedValue({
        email: "college@example.test",
        timezone: "UTC",
        roles: ["student"],
      });
      reads.studentReady.mockResolvedValue(ready);
      render(await AccountPage());
      expect(reads.studentReady).toHaveBeenCalledWith(
        runtime,
        expect.any(Headers),
      );
      expect(
        screen.getByRole("link", { name: "College Student setup and status" }),
      ).toHaveAttribute("href", "/student/onboarding");
      const link = screen.queryByRole("link", { name: "Student workspace" });
      if (ready) expect(link).toHaveAttribute("href", "/student");
      else {
        expect(link).not.toBeInTheDocument();
        expect(
          screen.getByText("No workspace with current access is available."),
        ).toBeVisible();
      }
    },
  );
  it.each(["unavailable", "error"])(
    "does not hide Parent/Tutor/Admin or account settings when Student authority is %s",
    async (failure) => {
      reads.account.mockResolvedValue({
        email: "college@example.test",
        timezone: "UTC",
        roles: ["student", "parent", "tutor", "admin"],
      });
      if (failure === "unavailable")
        reads.domainRuntime.mockResolvedValue(null);
      else
        reads.studentReady.mockRejectedValue(
          new Error("current learner authority unavailable"),
        );
      render(await AccountPage());
      expect(
        screen.queryByRole("link", { name: "Student workspace" }),
      ).not.toBeInTheDocument();
      for (const role of ["Parent", "Tutor", "Admin"])
        expect(
          screen.getByRole("link", {
            name: role === "Parent" ? "Parent Dashboard" : `${role} workspace`,
          }),
        ).toHaveAttribute("href", `/${role.toLowerCase()}`);
      expect(
        screen.getByRole("link", { name: "Administrator security" }),
      ).toBeVisible();
      expect(
        screen.getByRole("form", { name: "Account profile" }),
      ).toBeVisible();
      expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
    },
  );
});
