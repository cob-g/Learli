// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { TutorFilterForm } from "@/features/tutors/tutor-filter-form";
import { parseDirectorySearch } from "@/features/tutors/search";
afterEach(cleanup);

it("uses native GET-compatible controls and retains College Support, language and safe drafts", async () => {
  render(
    <TutorFilterForm
      variant="filters"
      subjects={[]}
      level="college_support"
      language="en"
      languages={["en"]}
      draft={{
        timezone: "UTC",
        when: "preferred",
        days: [1],
        range: "morning",
      }}
      zones={[{ value: "UTC", label: "UTC (GMT)" }]}
    />,
  );
  expect(screen.getByLabelText("Level")).toHaveValue("college_support");
  expect(screen.getByLabelText("Teaching language")).toHaveValue("en");
  expect(screen.getByLabelText("Monday")).toBeChecked();
  await userEvent.click(screen.getByLabelText("Sunday"));
  const data = new FormData(screen.getByRole("search") as HTMLFormElement);
  expect(
    parseDirectorySearch({
      when: String(data.get("when")),
      timezone: String(data.get("timezone")),
      days: data.getAll("days").map(String),
      range: String(data.get("range")),
    }).preferences,
  ).toEqual({
    timezone: "UTC",
    when: "preferred",
    days: [1, 7],
    range: "morning",
  });
});

it("associates invalid preferences with visible errors and focuses the first correction", () => {
  render(
    <TutorFilterForm
      variant="filters"
      subjects={[]}
      draft={{ timezone: "UTC", when: "preferred", days: [1] }}
      fields={{ range: "Choose a time-of-day range" }}
      zones={[{ value: "UTC", label: "UTC (GMT)" }]}
    />,
  );
  expect(screen.getByLabelText("Preferred time of day")).toHaveFocus();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Choose a time-of-day range",
  );
});

it("keeps the homepage finder short and without a time filter", () => {
  render(<TutorFilterForm variant="finder" subjects={[]} />);
  expect(screen.queryByText("Lesson time (optional)")).toBeNull();
  expect(screen.getByRole("button", { name: "Find a tutor" })).toBeVisible();
});

it.each(["finder", "filters"] as const)(
  "%s disables only submit while pending, preserves native GET values and restores navigation",
  (variant) => {
    render(
      <TutorFilterForm
        variant={variant}
        subjects={[]}
        level="college_support"
        language="en"
        languages={["en"]}
        draft={{
          timezone: "UTC",
          when: "preferred",
          days: [1, 3],
          range: "morning",
        }}
        zones={[{ value: "UTC", label: "UTC (GMT)" }]}
      />,
    );
    const form = screen.getByRole("search") as HTMLFormElement;
    const submit = screen.getByRole("button", {
      name: variant === "finder" ? "Find a tutor" : "Apply filters",
    });
    const values = () => [...new FormData(form).entries()];
    const initial = values();
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/tutors");
    expect(submit).toBeEnabled();
    for (const event of ["pageshow", "popstate"]) {
      // The first submit keeps the browser's default GET; a pending repeat does not.
      expect(fireEvent.submit(form)).toBe(true);
      expect(form).toHaveAttribute("aria-busy", "true");
      expect(submit).toBeDisabled();
      expect(screen.getByLabelText("Level")).toBeEnabled();
      expect(values()).toEqual(initial);
      if (variant === "filters") {
        expect(new FormData(form).getAll("days")).toEqual(["1", "3"]);
        expect(screen.getByLabelText("Your time zone")).toBeEnabled();
        expect(
          screen.getByRole("link", { name: "Clear filters" }),
        ).not.toHaveAttribute("aria-disabled", "true");
      }
      expect(fireEvent.submit(form)).toBe(false);
      fireEvent(window, new Event(event));
      expect(form).toHaveAttribute("aria-busy", "false");
      expect(submit).toBeEnabled();
      expect(values()).toEqual(initial);
    }
  },
);
