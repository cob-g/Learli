import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthRuntime } from "@/lib/auth-factory";
import { commonCandidateBatchWindow } from "@/features/public-availability/batch-window";
import * as provider from "@/features/public-availability/service";
import * as eligibility from "@/features/tutors/eligibility";
import * as ranking from "@/features/matching/match";
import * as screening from "@/features/tutor-screening/service";
import * as composition from "@/features/tutor-screening/composition";
import { readMatchingAvailability } from "@/features/matching/service";
import { readDirectoryAvailability } from "@/features/tutors/directory-availability";
import { readinessMatches } from "@/features/tutor-screening/discovery";
import { formatLessonTime } from "@/features/bookings/format-time";

const utc = (hour: string) => `2026-10-15T${hour}:00.000Z`;
const preferences = { timezone: "Asia/Manila", when: "any" } as const;
const filters = { subject: "math", level: "college_support" } as const;
const runtime = { environment: "test", db: {} } as AuthRuntime;
const capability = {
  mode: "synthetic_test",
  provenance: "synthetic_readiness",
  version: "synthetic-v1",
  reference: "policy:00000000-0000-4000-8000-000000000001",
  authorityReference: "synthetic:00000000-0000-4000-8000-000000000002",
  validFrom: "2026-10-01T00:00:00Z",
  validUntil: "2026-11-01T00:00:00Z",
  requiredCheckCodes: ["synthetic_check"],
  allowedActions: ["approve"],
  expiryRule: "all_checks_current",
} satisfies screening.ScreeningContext["screening"];

function tutors(count = 21): eligibility.PublicTutor[] {
  return Array.from({ length: count }, (_, index) => ({
    slug: `tutor-${index}`,
    displayName: `Tutor ${index}`,
    headline: "Synthetic tutor",
    bio: "",
    teachingBackground: "",
    teachingLanguages: ["en"],
    offerings: [
      {
        subjectSlug: "math",
        subjectName: "Math",
        levels: ["college_support"],
        specialty: null,
      },
    ],
  }));
}

function time(start: string, end: string): provider.PublicCandidateTime {
  return {
    ...formatLessonTime(
      new Date(utc(start)),
      new Date(utc(end)),
      "Asia/Manila",
    ),
    tutorTime: formatLessonTime(
      new Date(utc(start)),
      new Date(utc(end)),
      "UTC",
    ),
  };
}

function batches(): provider.PublicCandidates[] {
  return [
    {
      source: "local_simulation",
      generatedAtUtc: utc("08:00"),
      from: utc("09:00"),
      to: utc("12:00"),
      durationMinutes: 60,
      stepMinutes: 30,
      tutors: [
        {
          tutorSlug: "tutor-0",
          state: "available",
          times: [time("09:30", "10:30"), time("11:30", "12:30")],
        },
      ],
    },
    {
      source: "local_simulation",
      generatedAtUtc: utc("09:00"),
      from: utc("10:00"),
      to: utc("14:00"),
      durationMinutes: 60,
      stepMinutes: 30,
      tutors: [
        {
          tutorSlug: "tutor-20",
          state: "available",
          times: [time("12:30", "13:30"), time("13:00", "14:00")],
        },
      ],
    },
  ];
}

describe("raw candidate batch window", () => {
  it("retains a single nonempty batch's window without requiring provider fields", () => {
    expect(
      commonCandidateBatchWindow([{ from: utc("09:00"), to: utc("12:00") }]),
    ).toEqual({ from: Date.parse(utc("09:00")), to: Date.parse(utc("12:00")) });
  });

  it.each([false, true])(
    "intersects asymmetric from/to bounds in either order (%s)",
    (reverse) => {
      const windows = [
        { from: utc("09:00"), to: utc("13:00") },
        { from: utc("10:00"), to: utc("14:00") },
        { from: utc("08:00"), to: utc("12:00") },
      ];
      if (reverse) windows.reverse();
      windows.forEach(Object.freeze);
      Object.freeze(windows);
      const before = JSON.stringify(windows);
      expect(commonCandidateBatchWindow(windows)).toEqual({
        from: Date.parse(utc("10:00")),
        to: Date.parse(utc("12:00")),
      });
      expect(JSON.stringify(windows)).toBe(before);
    },
  );

  it("leaves a disjoint intersection raw rather than clamping it", () => {
    expect(
      commonCandidateBatchWindow([
        { from: utc("09:00"), to: utc("10:00") },
        { from: utc("11:00"), to: utc("12:00") },
      ]),
    ).toEqual({ from: Date.parse(utc("11:00")), to: Date.parse(utc("10:00")) });
  });
});

describe("candidate batch callers", () => {
  beforeEach(() => {
    vi.spyOn(composition, "getScreeningContext").mockReturnValue({
      runtime,
      screening: capability,
    });
    vi.spyOn(screening, "requireScreening");
    vi.spyOn(eligibility, "listEligibleTutors").mockResolvedValue(tutors());
    vi.spyOn(ranking, "matchAvailableTutors");
    const snapshots = batches();
    vi.spyOn(provider, "readPublicCandidates")
      .mockResolvedValueOnce(snapshots[0])
      .mockResolvedValueOnce(snapshots[1]);
    vi.spyOn(provider, "readPublicDirectoryCandidates")
      .mockResolvedValueOnce(snapshots[0])
      .mockResolvedValueOnce(snapshots[1]);
  });
  afterEach(() => vi.restoreAllMocks());

  const match = (inventory = tutors()) =>
    readMatchingAvailability(runtime, inventory, {
      subjectSlug: "math",
      level: "college_support",
      preferences,
    });
  const directory = (inventory = tutors()) =>
    readDirectoryAvailability(runtime, inventory, filters, preferences);
  const readiness = () => readinessMatches(runtime, "math", "college_support");

  it("matching keeps the raw start cutoff, full first-batch fit end and max generation time", async () => {
    const snapshots = batches();
    const before = JSON.stringify(snapshots);
    vi.mocked(provider.readPublicCandidates)
      .mockReset()
      .mockResolvedValueOnce(snapshots[0])
      .mockResolvedValueOnce(snapshots[1]);
    const result = await match();
    expect(result).toEqual({
      matches: [{ tutor: tutors()[0], nextTime: time("11:30", "12:30") }],
      window: {
        generatedAtUtc: utc("09:00"),
        from: utc("10:00"),
        to: utc("12:00"),
      },
    });
    expect(ranking.matchAvailableTutors).toHaveBeenCalledWith(
      tutors(),
      "math",
      "college_support",
      preferences,
      [
        {
          tutorSlug: "tutor-0",
          times: [time("09:30", "10:30"), time("11:30", "12:30")],
        },
        { tutorSlug: "tutor-20", times: [] },
      ],
      new Date(utc("10:00")),
      new Date(utc("13:00")),
    );
    expect(JSON.stringify(snapshots)).toBe(before);
    expect(provider.readPublicCandidates).toHaveBeenNthCalledWith(1, runtime, {
      tutorSlugs: tutors()
        .slice(0, 20)
        .map((t) => t.slug),
      subjectSlug: "math",
      level: "college_support",
      displayTimezone: "Asia/Manila",
    });
    expect(provider.readPublicCandidates).toHaveBeenNthCalledWith(2, runtime, {
      tutorSlugs: ["tutor-20"],
      subjectSlug: "math",
      level: "college_support",
      displayTimezone: "Asia/Manila",
    });
    expect(screening.requireScreening).not.toHaveBeenCalled();
  });

  it("directory excludes the later start while retaining whole-interval fit and viewer-only output", async () => {
    const { tutorTime: omitted, ...viewerTime } = time("11:30", "12:30");
    expect(omitted.zone).not.toBe(viewerTime.zone);
    expect(await directory()).toEqual({
      tutors: [tutors()[0]],
      nextTimes: { "tutor-0": viewerTime },
    });
    expect(provider.readPublicDirectoryCandidates).toHaveBeenNthCalledWith(
      2,
      runtime,
      {
        tutorSlugs: ["tutor-20"],
        subjectSlug: "math",
        level: "college_support",
        displayTimezone: "Asia/Manila",
      },
    );
    expect(provider.readPublicCandidates).not.toHaveBeenCalled();
    expect(screening.requireScreening).not.toHaveBeenCalled();
  });

  it("readiness passes a later-batch start beyond raw commonTo to actual whole-interval fitting", async () => {
    expect(await readiness()).toEqual([
      { tutor: tutors()[0], nextTime: time("11:30", "12:30") },
    ]);
    expect(ranking.matchAvailableTutors).toHaveBeenCalledWith(
      tutors(),
      "math",
      "college_support",
      preferences,
      [
        {
          tutorSlug: "tutor-0",
          times: [time("09:30", "10:30"), time("11:30", "12:30")],
        },
        { tutorSlug: "tutor-20", times: [time("12:30", "13:30")] },
      ],
      new Date(utc("10:00")),
      new Date(utc("13:00")),
    );
    expect(eligibility.listEligibleTutors).toHaveBeenCalledExactlyOnceWith(
      runtime.db,
      filters,
      "synthetic_readiness",
    );
    expect(screening.requireScreening).toHaveBeenCalledTimes(3);
    for (const [index, slugs] of [
      tutors()
        .slice(0, 20)
        .map((t) => t.slug),
      ["tutor-20"],
    ].entries()) {
      expect(provider.readPublicCandidates).toHaveBeenNthCalledWith(
        index + 1,
        runtime,
        {
          tutorSlugs: slugs,
          subjectSlug: "math",
          level: "college_support",
          displayTimezone: "Asia/Manila",
        },
        "synthetic_readiness",
      );
      expect(
        vi.mocked(screening.requireScreening).mock.invocationCallOrder[
          index + 1
        ],
      ).toBeLessThan(
        vi.mocked(provider.readPublicCandidates).mock.invocationCallOrder[
          index
        ],
      );
    }
    expect(
      vi.mocked(screening.requireScreening).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(eligibility.listEligibleTutors).mock.invocationCallOrder[0],
    );
  });

  it("preserves the distinct cutoff for a full-duration later-batch start exactly at raw commonTo", async () => {
    const snapshots = batches();
    snapshots[1].tutors[0].times = [time("12:00", "13:00")];
    const read = vi.mocked(provider.readPublicCandidates);
    read
      .mockReset()
      .mockResolvedValueOnce(snapshots[0])
      .mockResolvedValueOnce(snapshots[1]);
    expect((await match()).matches.map((row) => row.tutor.slug)).toEqual([
      "tutor-0",
    ]);
    vi.mocked(provider.readPublicDirectoryCandidates)
      .mockReset()
      .mockResolvedValueOnce(snapshots[0])
      .mockResolvedValueOnce(snapshots[1]);
    expect((await directory()).tutors.map((row) => row.slug)).toEqual([
      "tutor-0",
    ]);
    read
      .mockReset()
      .mockResolvedValueOnce(snapshots[0])
      .mockResolvedValueOnce(snapshots[1]);
    expect(await readiness()).toEqual([
      { tutor: tutors()[0], nextTime: time("11:30", "12:30") },
      { tutor: tutors()[20], nextTime: time("12:00", "13:00") },
    ]);
  });

  it("directory retains optional filters and complete 20+1 batching", async () => {
    await readDirectoryAvailability(
      runtime,
      tutors(),
      { language: "en" },
      preferences,
    );
    expect(provider.readPublicDirectoryCandidates).toHaveBeenCalledTimes(2);
    expect(provider.readPublicDirectoryCandidates).toHaveBeenNthCalledWith(
      1,
      runtime,
      {
        tutorSlugs: tutors()
          .slice(0, 20)
          .map((t) => t.slug),
        language: "en",
        displayTimezone: "Asia/Manila",
      },
    );
    expect(provider.readPublicDirectoryCandidates).toHaveBeenNthCalledWith(
      2,
      runtime,
      {
        tutorSlugs: ["tutor-20"],
        language: "en",
        displayTimezone: "Asia/Manila",
      },
    );
  });

  it("keeps each empty-inventory output and avoids candidate reads", async () => {
    expect(await match([])).toEqual({ matches: [], window: null });
    expect(await directory([])).toEqual({ tutors: [], nextTimes: {} });
    vi.mocked(eligibility.listEligibleTutors).mockResolvedValue([]);
    expect(await readiness()).toEqual([]);
    expect(screening.requireScreening).toHaveBeenCalledOnce();
    expect(provider.readPublicCandidates).not.toHaveBeenCalled();
    expect(provider.readPublicDirectoryCandidates).not.toHaveBeenCalled();
    expect(ranking.matchAvailableTutors).not.toHaveBeenCalled();
  });

  it("filters subject/level on one offering and declared language before batching", async () => {
    const inventory = tutors(1);
    inventory[0].offerings = [
      {
        subjectSlug: "math",
        subjectName: "Math",
        levels: ["elementary"],
        specialty: null,
      },
      {
        subjectSlug: "science",
        subjectName: "Science",
        levels: ["college_support"],
        specialty: null,
      },
    ];
    expect(await match(inventory)).toEqual({ matches: [], window: null });
    expect(await directory(inventory)).toEqual({ tutors: [], nextTimes: {} });
    expect(
      await readDirectoryAvailability(
        runtime,
        tutors(),
        { language: "fr" },
        preferences,
      ),
    ).toEqual({ tutors: [], nextTimes: {} });
    expect(provider.readPublicCandidates).not.toHaveBeenCalled();
    expect(provider.readPublicDirectoryCandidates).not.toHaveBeenCalled();
  });

  it("retains all three over-cap errors before any candidate read", async () => {
    await expect(match(tutors(101))).rejects.toMatchObject({
      status: 503,
      message: "Matching is temporarily unavailable.",
    });
    await expect(directory(tutors(101))).rejects.toMatchObject({
      status: 503,
      message: "Directory times are temporarily unavailable.",
    });
    vi.mocked(eligibility.listEligibleTutors).mockResolvedValue(tutors(101));
    await expect(readiness()).rejects.toThrow(
      "Synthetic matching unavailable.",
    );
    expect(provider.readPublicCandidates).not.toHaveBeenCalled();
    expect(provider.readPublicDirectoryCandidates).not.toHaveBeenCalled();
  });

  it.each(["matching", "directory", "readiness"] as const)(
    "propagates %s second-batch failure without partial results",
    async (caller) => {
      const failure = new provider.PublicAvailabilityUnavailable(
        "Synthetic provider failure.",
      );
      const read =
        caller === "directory"
          ? provider.readPublicDirectoryCandidates
          : provider.readPublicCandidates;
      vi.mocked(read)
        .mockReset()
        .mockResolvedValueOnce(batches()[0])
        .mockRejectedValueOnce(failure);
      await expect(
        caller === "matching"
          ? match()
          : caller === "directory"
            ? directory()
            : readiness(),
      ).rejects.toBe(failure);
      expect(read).toHaveBeenCalledTimes(2);
      expect(ranking.matchAvailableTutors).not.toHaveBeenCalled();
    },
  );

  it.each([1, 2, 3])(
    "rechecks actual screening authority at readiness gate %s",
    async (deniedGate) => {
      const get = vi.mocked(composition.getScreeningContext);
      get.mockReset();
      for (let i = 1; i < deniedGate; i++)
        get.mockReturnValueOnce({ runtime, screening: capability });
      get.mockReturnValue({ runtime, screening: { mode: "disabled" } });
      await expect(readiness()).rejects.toMatchObject({ status: 503 });
      expect(eligibility.listEligibleTutors).toHaveBeenCalledTimes(
        deniedGate === 1 ? 0 : 1,
      );
      expect(provider.readPublicCandidates).toHaveBeenCalledTimes(
        Math.max(0, deniedGate - 2),
      );
      expect(ranking.matchAvailableTutors).not.toHaveBeenCalled();
    },
  );
});
