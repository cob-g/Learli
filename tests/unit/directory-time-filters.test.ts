import { describe, expect, it, vi } from "vitest";
import {
  parseDirectorySearch,
  sanitizeDirectoryParams,
  tutorsHref,
} from "@/features/tutors/search";
import { preferencePredicate } from "@/features/matching/preferences";
import {
  publicCandidateQueryInput,
  publicDirectoryCandidateQueryInput,
} from "@/features/public-availability/input";
import { readDirectoryAvailability } from "@/features/tutors/directory-availability";
import type { PublicTutor } from "@/features/tutors/eligibility";
import type { AuthRuntime } from "@/lib/auth-factory";
import * as publicAvailability from "@/features/public-availability/service";

describe("directory time query contract", () => {
  it("leaves plain browse independent of time preferences", () => {
    expect(
      parseDirectorySearch({ timezone: "invalid", days: "bad" }).optIn,
    ).toBe(false);
    expect(
      tutorsHref({
        subject: "math",
        level: "college_support",
        language: "en",
        page: 2,
      }),
    ).toBe("/tutors?subject=math&level=college_support&language=en&page=2");
  });
  it.each([
    { when: "bad", timezone: "UTC" },
    { when: "preferred", timezone: "+08:00", days: "1", range: "morning" },
    { when: "preferred", timezone: "UTC", days: ["1", "1"], range: "morning" },
    { when: "preferred", timezone: "UTC", days: "9", range: "morning" },
    { when: "preferred", timezone: "UTC", days: "1", range: "bad" },
  ])(
    "fails closed and canonicalizes malformed preferences without redirect loops",
    (params) => {
      const safe = sanitizeDirectoryParams(params);
      expect(parseDirectorySearch(safe.params).preferences).toBeUndefined();
      expect(parseDirectorySearch(safe.params).optIn).toBe(true);
      expect(sanitizeDirectoryParams(safe.params).changed).toBe(false);
    },
  );
  it("round trips one or several days, paging and public combinations only", () => {
    for (const days of [[1], [1, 7]]) {
      const href = tutorsHref({
        subject: "math",
        level: "college_support",
        language: "en",
        page: 2,
        preferences: {
          timezone: "America/Los_Angeles",
          when: "preferred",
          days,
          range: "morning",
        },
      });
      const query = new URL(href, "http://localhost").searchParams;
      const params = Object.fromEntries(
        [...query.keys()].map((key) => [
          key,
          query.getAll(key).length === 1 ? query.get(key)! : query.getAll(key),
        ]),
      );
      expect(sanitizeDirectoryParams(params).changed).toBe(false);
      expect(parseDirectorySearch(params).preferences).toEqual({
        timezone: "America/Los_Angeles",
        when: "preferred",
        days,
        range: "morning",
      });
    }
    const safe = sanitizeDirectoryParams({
      when: "any",
      timezone: "UTC",
      learnerId: "PRIVATE_CANARY",
      meetingUrl: "PRIVATE_CANARY",
    });
    expect(safe.href).not.toContain("PRIVATE_CANARY");
  });
  it("keeps original provider requirements while allowing optional directory offering filters", () => {
    const input = { tutorSlugs: ["synthetic-tutor"], displayTimezone: "UTC" };
    expect(publicDirectoryCandidateQueryInput.safeParse(input).success).toBe(
      true,
    );
    expect(publicCandidateQueryInput.safeParse(input).success).toBe(false);
    expect(
      publicDirectoryCandidateQueryInput.safeParse({
        ...input,
        learnerId: "private",
      }).success,
    ).toBe(false);
  });
});

it.each([
  ["America/Los_Angeles", "2026-03-08T09:30:00Z", "2026-03-08T10:30:00Z", true],
  ["America/Los_Angeles", "2026-11-01T08:30:00Z", "2026-11-01T09:30:00Z", true],
  ["Australia/Lord_Howe", "2026-10-03T15:00:00Z", "2026-10-03T16:00:00Z", true],
  [
    "America/Los_Angeles",
    "2026-03-08T12:30:00Z",
    "2026-03-08T13:30:00Z",
    false,
  ],
])(
  "uses shared DST full-interval containment in %s",
  (timezone, startAtUtc, endAtUtc, expected) => {
    const fit = preferencePredicate(
      {
        timezone: String(timezone),
        when: "preferred",
        days: [7],
        range: "overnight",
      },
      new Date("2026-01-01"),
      new Date("2026-12-31"),
    );
    expect(
      fit({ startAtUtc: String(startAtUtc), endAtUtc: String(endAtUtc) }),
    ).toBe(expected);
  },
);

it("rejects capacity overflow before any provider query and does not cap plain filtering", async () => {
  const tutor: PublicTutor = {
    slug: "synthetic",
    displayName: "Synthetic",
    headline: "",
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
  };
  const runtime = { db: { transaction: vi.fn() } } as unknown as AuthRuntime;
  await expect(
    readDirectoryAvailability(
      runtime,
      Array.from({ length: 101 }, (_, i) => ({
        ...tutor,
        slug: `synthetic-${i}`,
      })),
      {},
      { timezone: "UTC", when: "any" },
    ),
  ).rejects.toMatchObject({ status: 503 });
  expect(runtime.db.transaction).not.toHaveBeenCalled();
});

it("never treats an inherited dictionary key as an available tutor", async () => {
  const read = vi
    .spyOn(publicAvailability, "readPublicDirectoryCandidates")
    .mockResolvedValue({
      source: "local_simulation",
      generatedAtUtc: "2026-10-12T00:00:00Z",
      from: "2026-10-12T01:00:00Z",
      to: "2026-10-26T00:00:00Z",
      durationMinutes: 60,
      stepMinutes: 30,
      tutors: [{ tutorSlug: "constructor", state: "empty", times: [] }],
    });
  try {
    const tutor: PublicTutor = {
      slug: "constructor",
      displayName: "Synthetic",
      headline: "",
      bio: "",
      teachingBackground: "",
      teachingLanguages: [],
      offerings: [],
    };
    expect(
      await readDirectoryAvailability(
        {} as AuthRuntime,
        [tutor],
        {},
        { timezone: "UTC", when: "any" },
      ),
    ).toEqual({ tutors: [], nextTimes: {} });
  } finally {
    read.mockRestore();
  }
});
