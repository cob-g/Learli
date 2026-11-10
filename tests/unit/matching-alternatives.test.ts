import { describe, expect, it } from "vitest";
import type { PublicTutor } from "@/features/tutors/eligibility";
import { closestAlternatives } from "@/features/matching/alternatives";
import type { AvailableMatch } from "@/features/matching/match";

function tutor(
  slug: string,
  offerings: [
    subject: string,
    levels: PublicTutor["offerings"][number]["levels"],
  ][],
): PublicTutor {
  return {
    slug,
    displayName: slug,
    headline: "",
    bio: "",
    teachingBackground: "",
    teachingLanguages: ["en"],
    offerings: offerings.map(([subject, levels]) => ({
      subjectSlug: subject,
      subjectName: subject.charAt(0).toUpperCase() + subject.slice(1),
      levels,
      specialty: null,
    })),
  };
}
const open = (who: PublicTutor, startAtUtc: string): AvailableMatch => ({
  tutor: who,
  nextTime: {
    startAtUtc,
    endAtUtc: new Date(Date.parse(startAtUtc) + 3_600_000).toISOString(),
  } as AvailableMatch["nextTime"],
});

describe("closest match alternatives", () => {
  const timed = tutor("b-timed", [["english", ["middle_school"]]]);
  const early = tutor("c-early", [["english", ["middle_school"]]]);
  const booked = tutor("a-booked", [["english", ["middle_school"]]]);
  const levels = tutor("d-levels", [
    ["english", ["high_school", "college_support"]],
  ]);
  const subjects = tutor("e-subjects", [
    ["math", ["middle_school"]],
    ["science", ["middle_school", "high_school"]],
  ]);
  const unrelated = tutor("f-unrelated", [["math", ["college_support"]]]);

  it("orders by closeness and never claims an untaught subject or level", () => {
    const result = closestAlternatives(
      [unrelated, subjects, levels, booked, timed, early],
      "english",
      "middle_school",
      [
        open(timed, "2026-11-12T10:00:00Z"),
        open(early, "2026-11-11T10:00:00Z"),
      ],
      10,
    );
    expect(result.map((item) => [item.tutor.slug, item.kind])).toEqual([
      ["c-early", "time"],
      ["b-timed", "time"],
      ["a-booked", "unscheduled"],
      ["d-levels", "level"],
      ["e-subjects", "subject"],
    ]);
    const level = result.find((item) => item.kind === "level");
    expect(level?.kind === "level" && level.levels).toEqual([
      "high_school",
      "college_support",
    ]);
    const subject = result.find((item) => item.kind === "subject");
    expect(subject?.kind === "subject" && subject.subjects).toEqual([
      "Math",
      "Science",
    ]);
  });

  it("keeps to the limit, closest first", () => {
    expect(
      closestAlternatives(
        [subjects, levels, booked],
        "english",
        "middle_school",
        [],
      ).map((item) => item.kind),
    ).toEqual(["unscheduled", "level", "subject"]);
    expect(
      closestAlternatives(
        [subjects, levels, booked],
        "english",
        "middle_school",
        [],
        1,
      ),
    ).toHaveLength(1);
  });

  it("shows an unrelated tutor only when nothing closer exists", () => {
    expect(
      closestAlternatives(
        [unrelated, levels],
        "english",
        "middle_school",
        [],
      ).map((item) => item.tutor.slug),
    ).toEqual(["d-levels"]);
    expect(
      closestAlternatives([unrelated], "english", "middle_school", []),
    ).toEqual([{ tutor: unrelated, kind: "other" }]);
  });

  it("treats an unread any-time search as no known open time", () => {
    expect(
      closestAlternatives([timed], "english", "middle_school", null).map(
        (item) => item.kind,
      ),
    ).toEqual(["unscheduled"]);
  });

  it("returns nothing when there are no eligible tutors", () => {
    expect(closestAlternatives([], "english", "middle_school", [])).toEqual([]);
  });
});
