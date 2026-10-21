// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { BookingChoiceForm } from "@/features/booking-workflows/choice-form";
import { bookingHistoryScope } from "@/features/booking-workflows/choice-options";

const learners = [
  {
    id: "guardian-learner",
    displayName: "Middle learner",
    level: "middle_school" as const,
    management: "guardian" as const,
  },
  {
    id: "self-learner",
    displayName: "College learner",
    level: "college_support" as const,
    management: "self" as const,
  },
];

const tutors = [
  {
    slug: "math-tutor",
    displayName: "Math Tutor",
    offerings: [
      {
        subjectSlug: "math",
        subjectName: "Mathematics",
        levels: ["middle_school" as const],
      },
    ],
  },
  {
    slug: "science-tutor",
    displayName: "Science Tutor",
    offerings: [
      {
        subjectSlug: "science",
        subjectName: "Science",
        levels: ["college_support" as const],
      },
    ],
  },
];

const zones = [
  { value: "UTC", label: "UTC (GMT)" },
  { value: "Asia/Manila", label: "Manila (GMT+8)" },
];

function formElement(initial = {}) {
  return (
    <BookingChoiceForm
      learners={learners}
      tutors={tutors}
      zones={zones}
      initial={{
        learnerId: "self-learner",
        subjectSlug: "science",
        tutorSlug: "science-tutor",
        displayTimezone: "Asia/Manila",
        ...initial,
      }}
      requestedTime={{
        level: "college_support",
        startAtUtc: "2030-10-18T02:00:00.000Z",
        endAtUtc: "2030-10-18T03:00:00.000Z",
      }}
      scopeHint="student"
      privateWorkflow
    />
  );
}

function form(initial = {}) {
  return render(formElement(initial));
}

describe("booking workflow choices", () => {
  it("server-renders full native choices for changing learner without JavaScript", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(formElement());
    const learner = within(container).getByRole("combobox", {
      name: "Learner",
    }) as HTMLSelectElement;
    const subject = within(container).getByRole("combobox", {
      name: "Subject",
    }) as HTMLSelectElement;
    const tutor = within(container).getByRole("combobox", {
      name: "Tutor",
    }) as HTMLSelectElement;
    expect(
      within(subject)
        .getAllByRole("option")
        .map((row) => row.textContent),
    ).toEqual(["Choose subject", "Mathematics", "Science"]);
    expect(
      within(tutor)
        .getAllByRole("option")
        .map((row) => row.textContent),
    ).toEqual(["Choose tutor", "Math Tutor", "Science Tutor"]);

    learner.value = "guardian-learner";
    subject.value = "math";
    tutor.value = "math-tutor";
    const data = new FormData(container.querySelector("form")!);
    expect(data.get("learnerId")).toBe("guardian-learner");
    expect(data.get("subjectSlug")).toBe("math");
    expect(data.get("tutorSlug")).toBe("math-tutor");
    expect(data.get("displayTimezone")).toBe("Asia/Manila");
  });

  it("hydrates full server choices without mismatch and preserves the valid deep link while filtering", () => {
    const element = formElement();
    const container = document.createElement("div");
    container.innerHTML = renderToString(element);
    const onRecoverableError = vi.fn();
    const view = render(element, {
      container,
      hydrate: true,
      onRecoverableError,
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    const subject = within(container).getByRole("combobox", {
      name: "Subject",
    });
    const tutor = within(container).getByRole("combobox", { name: "Tutor" });
    expect(subject).toHaveValue("science");
    expect(tutor).toHaveValue("science-tutor");
    expect(
      within(subject).queryByRole("option", { name: "Mathematics" }),
    ).toBeNull();
    expect(
      within(tutor).queryByRole("option", { name: "Math Tutor" }),
    ).toBeNull();
    expect(container.querySelector('input[name="startAtUtc"]')).toHaveValue(
      "2030-10-18T02:00:00.000Z",
    );
    expect(container.querySelector('input[name="endAtUtc"]')).toHaveValue(
      "2030-10-18T03:00:00.000Z",
    );
    expect(container.querySelector('input[name="level"]')).toHaveValue(
      "college_support",
    );
    view.unmount();
  });

  it("shows only subjects and Tutors compatible with the selected learner", () => {
    form();
    const subject = screen.getByRole("combobox", { name: "Subject" });
    const tutor = screen.getByRole("combobox", { name: "Tutor" });
    expect(
      within(subject).getByRole("option", { name: "Science" }),
    ).toBeVisible();
    expect(
      within(subject).queryByRole("option", { name: "Mathematics" }),
    ).toBeNull();
    expect(
      within(tutor).getByRole("option", { name: "Science Tutor" }),
    ).toBeVisible();
    expect(
      within(tutor).queryByRole("option", { name: "Math Tutor" }),
    ).toBeNull();
    expect(screen.getByRole("combobox", { name: "Time zone" })).toHaveValue(
      "Asia/Manila",
    );
  });

  it("clears incompatible downstream choices and a stale requested time", async () => {
    const view = form();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Learner" }),
      "guardian-learner",
    );
    expect(screen.getByRole("combobox", { name: "Subject" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Tutor" })).toHaveValue("");
    expect(
      within(screen.getByRole("combobox", { name: "Subject" })).getByRole(
        "option",
        { name: "Mathematics" },
      ),
    ).toBeVisible();
    expect(view.container.querySelector('input[name="startAtUtc"]')).toBeNull();
    expect(view.container.querySelector('input[name="scope"]')).toHaveValue(
      "student",
    );
  });

  it("normalizes incompatible retained query values instead of submitting them", () => {
    const view = form({
      learnerId: "guardian-learner",
      subjectSlug: "science",
      tutorSlug: "science-tutor",
    });
    expect(screen.getByRole("combobox", { name: "Subject" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Tutor" })).toHaveValue("");
    expect(view.container.querySelector('input[name="startAtUtc"]')).toBeNull();
  });

  it("derives guardian and student history destinations from trusted learner management", () => {
    expect(bookingHistoryScope(learners, "guardian-learner", "student")).toBe(
      "guardian",
    );
    expect(bookingHistoryScope(learners, "self-learner", "guardian")).toBe(
      "student",
    );
    expect(bookingHistoryScope(learners, undefined, "guardian")).toBe(
      "guardian",
    );
    expect(bookingHistoryScope([learners[1]], undefined, undefined)).toBe(
      "student",
    );
  });
});
