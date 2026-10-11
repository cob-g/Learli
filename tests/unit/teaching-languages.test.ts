import { describe, expect, it } from "vitest";
import {
  tutorProfileInput,
  describeTutorProfileIssues,
} from "@/features/tutors/input";
import { filterTutors, type PublicTutor } from "@/features/tutors/eligibility";
import { parseTutorSearch, tutorsHref } from "@/features/tutors/search";
import {
  declaredTeachingLanguages,
  teachingLanguageCodes,
  teachingLanguageLabels,
  teachingLanguageNames,
} from "@/features/tutors/teaching-languages";

const profile = {
  headline: "Synthetic tutor",
  bio: "Fictional introduction",
  teachingBackground: "Fictional background",
  timezone: "Asia/Manila",
  offerings: [
    {
      subjectId: "0b0e7a52-6f0e-4b63-9d43-6d1f3d2a9c11",
      levels: ["elementary"],
    },
  ],
};
const tutor: PublicTutor = {
  slug: "synthetic-tutor",
  displayName: "Synthetic tutor",
  headline: "Test",
  bio: "Test",
  teachingBackground: "Test",
  teachingLanguages: ["en", "fil"],
  offerings: [
    {
      subjectSlug: "math",
      subjectName: "Math",
      levels: ["elementary"],
      specialty: null,
    },
    {
      subjectSlug: "sat",
      subjectName: "SAT",
      levels: ["high_school"],
      specialty: null,
    },
  ],
};

describe("teaching-language declarations", () => {
  it("allows omission, explicit clear and catalogue-ordered declarations", () => {
    expect(tutorProfileInput.parse(profile).teachingLanguages).toBeUndefined();
    expect(
      tutorProfileInput.parse({ ...profile, teachingLanguages: [] })
        .teachingLanguages,
    ).toEqual([]);
    expect(
      tutorProfileInput.parse({ ...profile, teachingLanguages: ["fil", "en"] })
        .teachingLanguages,
    ).toEqual(["en", "fil"]);
    expect(
      tutorProfileInput.safeParse({
        ...profile,
        teachingLanguages: [...teachingLanguageCodes],
      }).success,
    ).toBe(true);
  });
  it.each([
    null,
    "en",
    ["English"],
    ["EN"],
    [" en"],
    ["en", "en"],
    ["tl"],
    ["en-US"],
    ["<script>alert(1)</script>"],
    ["en');DROP TABLE user;--"],
    Array(13).fill("en"),
    [{ code: "en" }],
  ])("rejects invalid/malicious declarations %j", (teachingLanguages) => {
    const parsed = tutorProfileInput.safeParse({
      ...profile,
      teachingLanguages,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(describeTutorProfileIssues(parsed.error).fields).toEqual({
        teachingLanguages:
          "Choose each teaching language once from the listed options.",
      });
  });
  it("labels stored codes without inferring missing declarations", () => {
    expect(Object.keys(teachingLanguageLabels)).toEqual([
      ...teachingLanguageCodes,
    ]);
    expect(teachingLanguageNames(["fil", "en"])).toEqual([
      "English",
      "Filipino",
    ]);
    expect(teachingLanguageNames([])).toEqual([]);
    expect(
      declaredTeachingLanguages([tutor, { teachingLanguages: ["fil"] }]),
    ).toEqual(["en", "fil"]);
  });
  it("requires a declared language and subject+level on the same offering", () => {
    const missing = { ...tutor, slug: "missing", teachingLanguages: [] };
    expect(filterTutors([tutor, missing], {})).toHaveLength(2);
    expect(filterTutors([tutor, missing], { language: "en" })).toEqual([tutor]);
    expect(
      filterTutors([tutor], {
        language: "fil",
        subject: "math",
        level: "elementary",
      }),
    ).toEqual([tutor]);
    expect(
      filterTutors([tutor], {
        language: "fil",
        subject: "math",
        level: "high_school",
      }),
    ).toEqual([]);
    expect(filterTutors([tutor], { language: "es" })).toEqual([]);
  });
});
describe("directory language URLs", () => {
  it("retains safe single language with subject, level and bounded pagination", () => {
    expect(
      parseTutorSearch({
        subject: "math",
        level: "college_support",
        language: "en",
        page: "2",
      }),
    ).toEqual({
      subject: "math",
      level: "college_support",
      language: "en",
      page: 2,
    });
    expect(
      tutorsHref({
        subject: "math",
        level: "college_support",
        language: "en",
        page: 2,
      }),
    ).toBe("/tutors?subject=math&level=college_support&language=en&page=2");
    expect(tutorsHref({ language: "en" })).toBe("/tutors?language=en");
    expect(tutorsHref({ subject: "a&language=es" })).toBe(
      "/tutors?subject=a%26language%3Des",
    );
  });
  it.each([
    "<script>",
    "javascript:alert(1)",
    "en&subject=math",
    "EN",
    ["en", "es"],
    "",
  ])("drops invalid or repeated query values %j", (language) => {
    expect(parseTutorSearch({ language }).language).toBeUndefined();
  });
});
