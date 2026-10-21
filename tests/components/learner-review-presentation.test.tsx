// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({
  localWorkflow: true,
  privateWorkflow: true,
  admissions: vi.fn(),
}));

vi.mock("@/lib/permissions/workspace", () => ({
  loadPrivatePage: (
    _path: string,
    load: (runtime: object, headers: Headers) => unknown,
  ) => load({}, new Headers()),
}));
vi.mock("@/features/learner-admission/context", () => ({
  admissionContext: (runtime: unknown) => runtime,
}));
vi.mock("@/features/learner-admission/service", () => ({
  listAssignedAdmissions: reads.admissions,
}));
vi.mock("@/features/local-workflow/runtime", () => ({
  getLocalWorkflow: () => (reads.localWorkflow ? {} : null),
}));
vi.mock("@/features/local-workflow/presentation", () => ({
  hasPersistentWorkflow: () => reads.privateWorkflow,
}));
vi.mock("@/features/learners/learner-link", () => ({
  LearnerLink: ({ label, href }: { label: string; href: string }) => (
    <a href={href}>{label}</a>
  ),
}));

import AdminLearnerReviewPage from "@/app/(workspace)/admin/learner-admission/page";
import {
  AdmissionEntry,
  AdmissionReviewEntry,
} from "@/features/learner-admission/navigation";

beforeEach(() => {
  vi.clearAllMocks();
  reads.localWorkflow = true;
  reads.privateWorkflow = true;
  reads.admissions.mockResolvedValue({
    items: [
      {
        id: "retained-review",
        management: "guardian",
        state: "pending",
        policyVersion: "retained-policy-v1",
        createdAt: new Date("2026-10-17T00:00:00Z"),
      },
    ],
    nextCursor: null,
  });
});

describe("learner review presentation", () => {
  it("uses neutral local-workflow entry labels while retaining the same routes", () => {
    render(
      <>
        <AdmissionEntry localWorkflow />
        <AdmissionReviewEntry localWorkflow />
      </>,
    );
    expect(
      screen.getByRole("link", { name: "Earlier learner review records" }),
    ).toHaveAttribute("href", "/learner-admission");
    expect(
      screen.getByRole("link", { name: "Assigned learner review records" }),
    ).toHaveAttribute("href", "/admin/learner-admission");
  });

  it("presents assigned ordinary-workflow rows as retained review records", async () => {
    render(await AdminLearnerReviewPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("heading", { name: "Assigned learner review records" }),
    ).toBeVisible();
    expect(
      screen.getByText(/retained historical or exceptional learner cases/),
    ).toBeVisible();
    expect(screen.getByText(/use self-service onboarding/)).toBeVisible();
    expect(screen.getByText(/Guardian-managed record/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Open record" })).toHaveAttribute(
      "href",
      "/admin/learner-admission/retained-review",
    );
  });

  it("keeps the established admission wording outside the ordinary workflow", async () => {
    reads.localWorkflow = false;
    render(await AdminLearnerReviewPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("heading", { name: "Assigned admission reviews" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Open request" })).toHaveAttribute(
      "href",
      "/admin/learner-admission/retained-review",
    );
  });
});
