import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps, ReactNode } from "react";
import { bookingSelectionHref } from "@/features/bookings/selection";
import { formatLessonTime } from "@/features/bookings/format-time";

const reads = vi.hoisted(() => ({
  runtime: {},
  privateWorkflow: false,
  catalog: vi.fn(),
  tutor: vi.fn(),
  directory: vi.fn(),
  matching: vi.fn(),
  candidates: vi.fn(),
  availability: vi.fn(),
  timeOff: vi.fn(),
  admissions: vi.fn(),
  application: vi.fn(),
  profile: vi.fn(),
  screening: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  getDomainAuthRuntime: async () => reads.runtime,
}));
vi.mock("@/features/private-workflow/runtime", () => ({
  isPrivateWorkflow: (runtime: unknown) => {
    expect(runtime).toBe(reads.runtime);
    return reads.privateWorkflow;
  },
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    "aria-label": label,
  }: ComponentProps<"a">) => (
    <a href={href} className={className} aria-label={label}>
      {children}
    </a>
  ),
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("Unexpected redirect");
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/permissions/workspace", () => ({
  loadPrivatePage: (
    _path: string,
    load: (runtime: unknown, headers: Headers) => unknown,
  ) => load(reads.runtime, new Headers()),
}));
vi.mock("@/features/tutors/public", async () => ({
  tutorsHref: (await import("@/features/tutors/search")).tutorsHref,
  tutorsPerPage: 20,
  readPublicCatalog: reads.catalog,
  readPublicTutor: reads.tutor,
  readDirectoryTimes: reads.directory,
}));
vi.mock("@/features/matching/service", () => ({
  readMatchingAvailability: reads.matching,
}));
vi.mock("@/features/public-availability/service", () => ({
  readPublicCandidates: reads.candidates,
}));
vi.mock("@/features/availability/service", () => ({
  readOwnAvailability: reads.availability,
}));
vi.mock("@/features/time-off/service", () => ({
  readOwnTimeOff: reads.timeOff,
}));
vi.mock("@/features/learner-admission/context", () => ({
  admissionContext: (runtime: unknown) => runtime,
}));
vi.mock("@/features/learner-admission/service", () => ({
  listAssignedAdmissions: reads.admissions,
}));
vi.mock("@/features/tutors/review", () => ({
  readTutorApplication: reads.application,
}));
vi.mock("@/features/tutors/service", () => ({
  readOwnTutorProfile: reads.profile,
}));
vi.mock("@/features/tutor-screening/composition", () => ({
  getScreeningContext: () => ({ screening: { mode: "synthetic_test" } }),
}));
vi.mock("@/features/tutor-screening/service", () => ({
  readScreening: reads.screening,
}));
vi.mock("@/lib/time/zones", () => ({
  listTimeZoneOptions: () => [{ value: "UTC", label: "UTC" }],
  timeZoneLabel: () => "UTC",
}));

import TutorsPage from "@/app/(marketing)/tutors/page";
import GetMatchedPage from "@/app/(marketing)/get-matched/page";
import HowItWorksPage from "@/app/(marketing)/how-it-works/page";
import { PendingBookingChoice } from "@/features/bookings/pending-choice";
import AvailabilityPage from "@/app/(workspace)/tutor/availability/page";
import TimeOffPage from "@/app/(workspace)/tutor/time-off/page";
import AdmissionPage from "@/app/(workspace)/admin/learner-admission/page";
import ApplicationPage from "@/app/(workspace)/admin/tutors/[profileId]/page";
import ScreeningPage from "@/app/(workspace)/tutor/screening/page";

const tutor = {
  slug: "fictional-math-tutor",
  displayName: "Fictional tutor",
  headline: "Math support",
  bio: "A fictional profile.",
  teachingBackground: "Fictional background.",
  teachingLanguages: [],
  timezone: "UTC",
  reviewStatus: "pending",
  offerings: [
    {
      subjectSlug: "math",
      subjectName: "Math",
      levels: ["college_support"],
    },
  ],
};
const time = formatLessonTime(
  new Date("2030-10-17T03:00:00Z"),
  new Date("2030-10-17T04:00:00Z"),
  "UTC",
);
const query = {
  subject: "math",
  level: "college_support",
  when: "any",
  timezone: "UTC",
};
const choice = {
  tutorSlug: tutor.slug,
  subjectSlug: "math",
  level: "college_support" as const,
  displayTimezone: "UTC",
  startAtUtc: time.startAtUtc,
  endAtUtc: time.endAtUtc,
};
async function streamed(node: ReactNode) {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
}
beforeEach(() => {
  vi.clearAllMocks();
  reads.privateWorkflow = false;
  reads.catalog.mockResolvedValue({
    tutors: [tutor],
    subjects: [
      { id: "math", slug: "math", name: "Math", category: "academic_core" },
    ],
  });
  reads.tutor.mockResolvedValue(tutor);
  reads.directory.mockResolvedValue({
    tutors: [tutor],
    nextTimes: { [tutor.slug]: time },
  });
  reads.matching.mockResolvedValue({
    matches: [{ tutor, nextTime: time }],
  });
  reads.candidates.mockResolvedValue({ tutors: [{ times: [time] }] });
  reads.availability.mockResolvedValue({
    editable: true,
    timezone: "UTC",
    version: 0,
    windows: [],
  });
  reads.timeOff.mockResolvedValue({
    editable: true,
    timezone: "UTC",
    version: 0,
    exceptions: [],
  });
  reads.admissions.mockResolvedValue({ items: [], nextCursor: null });
  reads.application.mockResolvedValue({
    ...tutor,
    offerings: [],
    screening: {
      state: "pending",
      round: 1,
      revision: 0,
      requiredCodes: [],
      checks: [],
    },
  });
  reads.profile.mockResolvedValue({ id: "profile-id" });
  reads.screening.mockResolvedValue(null);
});

describe.each([false, true])(
  "active copy with private workflow %s",
  (privateWorkflow) => {
    beforeEach(() => {
      reads.privateWorkflow = privateWorkflow;
    });

    it("keeps dated discovery and profile continuation factual for the selected mode", async () => {
      const directory = await streamed(
        <TutorsPage searchParams={Promise.resolve(query)} />,
      );
      const matched = await streamed(
        <GetMatchedPage searchParams={Promise.resolve(query)} />,
      );
      for (const html of [directory, matched]) {
        expect(html).toContain("Fictional tutor");
        expect(html).toContain("College Support");
        expect(html).toContain("2030-10-17T03:00:00.000Z");
        expect(html).toContain(`/tutors/${tutor.slug}?`);
        expect(html).toContain("startAtUtc=");
        if (privateWorkflow) {
          expect(html).toContain("Confirmation requires assigned review.");
          expect(html).not.toMatch(
            /Local simulation|simulated options|demo search/i,
          );
        }
      }
      if (privateWorkflow)
        expect(matched).toContain("Has an open time in the next 14 days.");
      else {
        expect(directory).toContain(
          "Local simulation: actual dated open times",
        );
        expect(matched).toContain("Local demo search:");
        expect(matched).toContain(
          "Has an open time in the demo search window.",
        );
      }
      reads.matching.mockResolvedValue({ matches: [] });
      const empty = await streamed(
        <GetMatchedPage searchParams={Promise.resolve(query)} />,
      );
      expect(empty).toContain(
        privateWorkflow
          ? "an open time that fits"
          : "an open demo time that fits",
      );
      expect(empty).toContain("No tutors match your answers");
    });

    it("preserves sign-in choices and truthful availability when the tutor disappears", async () => {
      const next = bookingSelectionHref(choice, privateWorkflow);
      const selected = renderToStaticMarkup(
        await PendingBookingChoice({ next }),
      );
      expect(selected).toContain(
        privateWorkflow
          ? "Your booking choice"
          : "Your simulated booking choice",
      );
      expect(selected).toContain("No time is reserved.");
      expect(selected).toContain(time.startAtUtc);
      reads.candidates.mockResolvedValue({ tutors: [{ times: [] }] });
      expect(
        renderToStaticMarkup(await PendingBookingChoice({ next })),
      ).toContain("That time is no longer available.");
      reads.tutor.mockResolvedValue(null);
      const unavailable = renderToStaticMarkup(
        await PendingBookingChoice({ next }),
      );
      expect(unavailable).toContain(
        privateWorkflow
          ? "taking bookings for that choice"
          : "taking simulated bookings for that choice",
      );
      expect(unavailable).toContain('href="/tutors"');
    });

    it("passes current mode to Tutor schedule forms without changing controls", async () => {
      const availability = renderToStaticMarkup(await AvailabilityPage());
      const timeOff = renderToStaticMarkup(await TimeOffPage());
      expect(availability).toContain('href="/tutor/time-off"');
      expect(availability).toContain("Save availability");
      expect(timeOff).toContain("Add time off");
      expect(timeOff).toContain("No time off saved.");
      expect(availability).toContain(
        privateWorkflow
          ? "Eligible learners can request available times"
          : "Booking is not available yet.",
      );
      expect(timeOff).toContain(
        privateWorkflow
          ? "active booking request or confirmed booking"
          : "unexpired simulated reservation",
      );
    });

    it("uses assigned-review instructions and ordinary screening actions only in private mode", async () => {
      const admission = renderToStaticMarkup(
        await AdmissionPage({ searchParams: Promise.resolve({}) }),
      );
      const application = renderToStaticMarkup(
        await ApplicationPage({
          params: Promise.resolve({ profileId: "profile-id" }),
        }),
      );
      const screening = renderToStaticMarkup(await ScreeningPage());
      const how = renderToStaticMarkup(await HowItWorksPage());
      expect(admission).toContain("No admission requests are available.");
      expect(application).toContain(
        "No actual person or document has been screened.",
      );
      if (privateWorkflow) {
        expect(admission).toContain(
          "Review only your assigned learner requests.",
        );
        expect(application).toContain("Approve screening");
        expect(application).not.toContain("screening process is not decided");
        expect(screening).toContain("Request screening");
        expect(screening).not.toContain("Request synthetic screening");
        expect(how).toContain(
          "An assigned administrator reviews it before confirmation.",
        );
      } else {
        expect(admission).toContain("Synthetic readiness only.");
        expect(application).toContain("Approve synthetic screening");
        expect(application).toContain("screening process is not decided");
        expect(screening).toContain("Request synthetic screening");
        expect(how).toContain(
          "This development preview uses simulated bookings.",
        );
      }
    });
  },
);
