import type { LearnerLevel } from "@/lib/db/schema";
import type { PublicTutor } from "@/features/tutors/eligibility";
import type { AvailableMatch } from "./match";

/**
 * When no tutor fits every answer, the nearest honest alternatives (prd.md
 * Journey E step 5): eligible tutors listed with exactly what does not fit.
 * Nothing here widens matching itself; a tutor is never presented as teaching
 * a subject or level they do not offer. Closest first:
 * - `time`: teaches the subject at the level, open only outside the chosen times;
 * - `unscheduled`: teaches the subject at the level, no open time in the window;
 * - `level`: teaches the subject, at other levels;
 * - `subject`: teaches the level, in other subjects;
 * - `other`: neither, shown only when nothing closer exists.
 */
export type MatchAlternative = { tutor: PublicTutor } & (
  | { kind: "time"; nextTime: AvailableMatch["nextTime"] }
  | { kind: "unscheduled" }
  | { kind: "level"; levels: LearnerLevel[] }
  | { kind: "subject"; subjects: string[] }
  | { kind: "other" }
);

export const alternativeLimit = 3;
const rank = ["time", "unscheduled", "level", "subject", "other"] as const;

export function closestAlternatives(
  tutors: readonly PublicTutor[],
  subject: string,
  level: LearnerLevel,
  /** Tutors with an open time at any time of day, or null when not read. */
  anyTime: readonly AvailableMatch[] | null,
  limit = alternativeLimit,
): MatchAlternative[] {
  const open = new Map(anyTime?.map((match) => [match.tutor.slug, match]));
  const found = tutors.map((tutor): MatchAlternative => {
    const taught = tutor.offerings.find(
      (offering) => offering.subjectSlug === subject,
    );
    if (taught?.levels.includes(level)) {
      const match = open.get(tutor.slug);
      return match
        ? { tutor, kind: "time", nextTime: match.nextTime }
        : { tutor, kind: "unscheduled" };
    }
    if (taught) return { tutor, kind: "level", levels: taught.levels };
    const atLevel = tutor.offerings.filter((offering) =>
      offering.levels.includes(level),
    );
    if (atLevel.length)
      return {
        tutor,
        kind: "subject",
        subjects: atLevel.map((offering) => offering.subjectName),
      };
    return { tutor, kind: "other" };
  });
  const sorted = found.sort(
    (a, b) =>
      rank.indexOf(a.kind) - rank.indexOf(b.kind) ||
      (a.kind === "time" && b.kind === "time"
        ? Date.parse(a.nextTime.startAtUtc) - Date.parse(b.nextTime.startAtUtc)
        : 0) ||
      a.tutor.displayName.localeCompare(b.tutor.displayName),
  );
  const closer = sorted.filter((item) => item.kind !== "other");
  return (closer.length ? closer : sorted).slice(0, limit);
}
