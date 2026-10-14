// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TutorList } from "@/features/tutors/tutor-card";
import type { PublicTutor } from "@/features/tutors/eligibility";

const tutor = {
  slug: "ada-test",
  displayName: "Ada Test",
  bio: "Fictional tutor.",
  teachingLanguages: [],
  offerings: [],
} as unknown as PublicTutor;
const next = {
  startAtUtc: "2030-01-07T09:00:00.000Z",
  endAtUtc: "2030-01-07T10:00:00.000Z",
  date: "Mon",
  time: "9:00",
  zone: "UTC",
};
const href = () =>
  screen.getByRole("link", { name: /View profile/ }).getAttribute("href");

describe("tutor directory card link", () => {
  it("carries subject, level, zone and the shown time", () => {
    render(
      <TutorList
        tutors={[tutor]}
        subject="math"
        level="high_school"
        timezone="Asia/Manila"
        nextTimes={{ "ada-test": next }}
      />,
    );
    const url = new URL(href()!, "http://x");
    expect(url.pathname).toBe("/tutors/ada-test");
    expect(url.searchParams.get("subject")).toBe("math");
    expect(url.searchParams.get("level")).toBe("high_school");
    expect(url.searchParams.get("displayTimezone")).toBe("Asia/Manila");
    expect(url.searchParams.get("startAtUtc")).toBe(next.startAtUtc);
  });
  it("keeps the plain link without a valid subject and level", () => {
    render(<TutorList tutors={[tutor]} timezone="Asia/Manila" />);
    expect(href()).toBe("/tutors/ada-test?displayTimezone=Asia%2FManila");
  });
  it("falls back when the filter is invalid", () => {
    render(
      <TutorList
        tutors={[tutor]}
        subject="Not A Slug!"
        level="nope"
        timezone="Asia/Manila"
      />,
    );
    expect(href()).toBe("/tutors/ada-test?displayTimezone=Asia%2FManila");
  });
});
