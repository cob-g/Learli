import Link from "next/link";
import { Check, CircleDashed } from "lucide-react";
import type { ReviewStatus } from "@/lib/db/schema/app";

export type ScreeningReadinessSource = {
  state: "pending" | "approved" | "rejected" | "suspended" | "revoked";
  requiredCodes: readonly string[];
  checks: readonly {
    code: string;
    outcome: string;
    current: boolean;
  }[];
};

export function screeningCheckLabel(code: string) {
  if (code === "identity") return "Identity check";
  if (code === "eligibility") return "Eligibility check";
  return code
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function screeningProgress(detail: ScreeningReadinessSource | null) {
  if (!detail)
    return {
      state: null,
      currentCount: 0,
      requiredCount: 0,
      current: false,
      readyForDecision: false,
      nextRequiredCode: null,
    } as const;
  const currentCodes = new Set(
    detail.checks
      .filter((check) => check.outcome === "passed" && check.current)
      .map((check) => check.code),
  );
  const currentCount = detail.requiredCodes.filter((code) =>
    currentCodes.has(code),
  ).length;
  const requiredCount = detail.requiredCodes.length;
  const allChecksCurrent = requiredCount > 0 && currentCount === requiredCount;
  return {
    state: detail.state,
    currentCount,
    requiredCount,
    current: detail.state === "approved" && allChecksCurrent,
    readyForDecision: detail.state === "pending" && allChecksCurrent,
    nextRequiredCode:
      detail.requiredCodes.find((code) => !currentCodes.has(code)) ?? null,
  };
}

export function queueScreeningStatus(
  summary: {
    state: ScreeningReadinessSource["state"];
    currentCount: number;
    requiredCount: number;
  } | null,
) {
  if (!summary) return "No current screening case — open application";
  const count = `${summary.currentCount} of ${summary.requiredCount} checks current`;
  if (
    summary.state === "approved" &&
    summary.currentCount === summary.requiredCount
  )
    return "Screening current";
  if (summary.state === "pending")
    return summary.currentCount === summary.requiredCount
      ? `${count} — ready for decision`
      : `${count} — record remaining required checks`;
  if (summary.state === "approved")
    return `${count} — renew remaining required checks`;
  return `Screening ${summary.state} — open application`;
}

export type TutorReadiness = {
  items: readonly {
    key: "profile" | "screening" | "availability" | "public-listing";
    label: string;
    complete: boolean;
    detail: string;
  }[];
  nextAction: { href: string; label: string };
  publicListing: boolean;
};

const reviewLabel: Record<ReviewStatus, string> = {
  pending: "submitted and awaiting review",
  approved: "approved",
  rejected: "not approved; update and resubmit it",
  suspended: "suspended; contact support before making changes",
};

function screeningDetail(
  source: ScreeningReadinessSource | null,
  available: boolean,
) {
  if (!available) return "Screening is unavailable in this environment";
  const progress = screeningProgress(source);
  if (!source) return "No current screening case";
  if (progress.current) return "Passed and current";
  if (progress.readyForDecision)
    return `${progress.currentCount} of ${progress.requiredCount} required checks current; awaiting a decision`;
  if (source.state !== "pending")
    return `Screening ${source.state}; review the screening page for the next available action`;
  return `${progress.currentCount} of ${progress.requiredCount} required checks current`;
}

export function buildTutorReadiness(input: {
  profile: { reviewStatus: ReviewStatus; slug: string } | null;
  screening: ScreeningReadinessSource | null;
  screeningAvailable?: boolean;
  hasAvailability: boolean;
  publicListing: boolean;
}): TutorReadiness {
  const screeningAvailable = input.screeningAvailable ?? true;
  const screening = screeningProgress(input.screening);
  const items: TutorReadiness["items"] = [
    {
      key: "profile",
      label: "Profile",
      complete: input.profile !== null,
      detail: input.profile
        ? `Application ${reviewLabel[input.profile.reviewStatus]}`
        : "Tutor profile not submitted",
    },
    {
      key: "screening",
      label: "Screening",
      complete: screeningAvailable && screening.current,
      detail: screeningDetail(input.screening, screeningAvailable),
    },
    {
      key: "availability",
      label: "Availability",
      complete: input.hasAvailability,
      detail: input.hasAvailability
        ? "Weekly teaching hours saved"
        : "No weekly teaching hours saved",
    },
    {
      key: "public-listing",
      label: "Public listing",
      complete: input.publicListing,
      detail: input.publicListing
        ? "Visible in Tutor discovery"
        : "Not currently visible in Tutor discovery",
    },
  ];

  const nextAction = !input.profile
    ? { href: "/tutor/profile", label: "Complete profile" }
    : screeningAvailable && !screening.current
      ? { href: "/tutor/screening", label: "Continue screening" }
      : !input.hasAvailability
        ? { href: "/tutor/availability", label: "Set availability" }
        : !input.publicListing
          ? { href: "/tutor/profile", label: "Review profile status" }
          : {
              href: `/tutors/${input.profile.slug}`,
              label: "View public profile",
            };

  return { items, nextAction, publicListing: input.publicListing };
}

export function TutorReadinessSummary({
  readiness,
  showAction = true,
}: {
  readiness: TutorReadiness;
  showAction?: boolean;
}) {
  return (
    <section
      aria-labelledby="tutor-readiness-title"
      className="max-w-3xl rounded-surface border border-border bg-surface p-6"
    >
      <h2 id="tutor-readiness-title" className="text-section-title">
        Tutor setup
      </h2>
      <p className="mt-2 max-w-prose text-small text-muted-foreground">
        These steps show your current coordination status. Availability is
        managed separately from public-listing eligibility.
      </p>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2">
        {readiness.items.map((item) => {
          const Icon = item.complete ? Check : CircleDashed;
          return (
            <li
              key={item.key}
              className="flex min-w-0 gap-3 rounded-surface border border-border bg-background p-4"
            >
              <Icon
                aria-hidden="true"
                className={item.complete ? "text-success" : "text-primary"}
                size={20}
              />
              <div className="min-w-0">
                <p className="text-label">{item.label}</p>
                <p className="mt-1 text-small text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {showAction && (
        <Link
          className="action action-outline mt-5"
          href={readiness.nextAction.href}
        >
          {readiness.nextAction.label}
        </Link>
      )}
    </section>
  );
}
