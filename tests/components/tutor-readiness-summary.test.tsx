// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildTutorReadiness,
  queueScreeningStatus,
  screeningProgress,
  TutorReadinessSummary,
} from "@/features/tutors/readiness-summary";
import { TutorBookingAgenda } from "@/features/tutors/booking-agenda";

afterEach(cleanup);

const approvedProfile = {
  reviewStatus: "approved" as const,
  slug: "sample-tutor",
};
const currentScreening = {
  state: "approved" as const,
  requiredCodes: ["identity", "eligibility"],
  checks: [
    { code: "identity", outcome: "passed", current: true },
    { code: "eligibility", outcome: "passed", current: true },
  ],
};

describe("Tutor readiness", () => {
  it("keeps the sequence explicit and routes first use to profile setup", () => {
    const readiness = buildTutorReadiness({
      profile: null,
      screening: null,
      hasAvailability: false,
      publicListing: false,
    });
    render(<TutorReadinessSummary readiness={readiness} />);
    const list = screen.getByRole("list");
    expect(
      within(list)
        .getAllByText(/^(Profile|Screening|Availability|Public listing)$/)
        .map((label) => label.textContent),
    ).toEqual(["Profile", "Screening", "Availability", "Public listing"]);
    expect(
      screen.getByRole("link", { name: "Complete profile" }),
    ).toHaveAttribute("href", "/tutor/profile");
  });

  it("does not equate profile approval or current checks with approved current screening", () => {
    const checksReady = {
      ...currentScreening,
      state: "pending" as const,
    };
    expect(screeningProgress(checksReady)).toMatchObject({
      current: false,
      readyForDecision: true,
      currentCount: 2,
      requiredCount: 2,
    });
    const readiness = buildTutorReadiness({
      profile: approvedProfile,
      screening: checksReady,
      hasAvailability: true,
      publicListing: false,
    });
    expect(readiness.nextAction).toEqual({
      href: "/tutor/screening",
      label: "Continue screening",
    });
    expect(readiness.items.find((item) => item.key === "screening")).toEqual(
      expect.objectContaining({ complete: false }),
    );
  });

  it("keeps availability separate from the authoritative public listing result", () => {
    const readiness = buildTutorReadiness({
      profile: approvedProfile,
      screening: currentScreening,
      hasAvailability: false,
      publicListing: true,
    });
    expect(readiness.items.find((item) => item.key === "availability")).toEqual(
      expect.objectContaining({ complete: false }),
    );
    expect(
      readiness.items.find((item) => item.key === "public-listing"),
    ).toEqual(expect.objectContaining({ complete: true }));
    expect(readiness.nextAction).toEqual({
      href: "/tutor/availability",
      label: "Set availability",
    });
  });

  it("keeps a single setup action in the empty agenda when the readiness action is hidden", () => {
    const readiness = buildTutorReadiness({
      profile: approvedProfile,
      screening: currentScreening,
      hasAvailability: false,
      publicListing: true,
    });
    render(
      <>
        <TutorReadinessSummary readiness={readiness} showAction={false} />
        <TutorBookingAgenda
          active={[]}
          history={[]}
          hasMoreActive={false}
          hasMoreHistory={false}
          privateWorkflow
          emptyAction={readiness.nextAction}
        />
      </>,
    );
    expect(screen.getByRole("heading", { name: "Tutor setup" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "No upcoming sessions" }),
    ).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "Set availability" }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "Set availability" }),
    ).toHaveAttribute("href", "/tutor/availability");
    expect(
      within(screen.getByRole("list")).getByText("Availability"),
    ).toBeVisible();
  });

  it("does not link to an unavailable screening workflow", () => {
    const readiness = buildTutorReadiness({
      profile: approvedProfile,
      screening: null,
      screeningAvailable: false,
      hasAvailability: false,
      publicListing: false,
    });
    expect(readiness.nextAction).toEqual({
      href: "/tutor/availability",
      label: "Set availability",
    });
    expect(readiness.items.find((item) => item.key === "screening")).toEqual(
      expect.objectContaining({
        complete: false,
        detail: "Screening is unavailable in this environment",
      }),
    );
  });

  it("uses the public profile only after every displayed step is complete", () => {
    const readiness = buildTutorReadiness({
      profile: approvedProfile,
      screening: currentScreening,
      hasAvailability: true,
      publicListing: true,
    });
    expect(readiness.items.every((item) => item.complete)).toBe(true);
    expect(readiness.nextAction).toEqual({
      href: "/tutors/sample-tutor",
      label: "View public profile",
    });
  });
});

describe("Admin queue screening summaries", () => {
  it("provides useful next steps from safe count and state fields", () => {
    expect(queueScreeningStatus(null)).toBe(
      "No current screening case — open application",
    );
    expect(
      queueScreeningStatus({
        state: "pending",
        currentCount: 1,
        requiredCount: 2,
      }),
    ).toBe("1 of 2 checks current — record remaining required checks");
    expect(
      queueScreeningStatus({
        state: "pending",
        currentCount: 2,
        requiredCount: 2,
      }),
    ).toBe("2 of 2 checks current — ready for decision");
    expect(
      queueScreeningStatus({
        state: "approved",
        currentCount: 2,
        requiredCount: 2,
      }),
    ).toBe("Screening current");
    expect(
      queueScreeningStatus({
        state: "approved",
        currentCount: 1,
        requiredCount: 2,
      }),
    ).toBe("1 of 2 checks current — renew remaining required checks");
  });
});
