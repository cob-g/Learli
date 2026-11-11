// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
import { TutorFilterForm } from "@/features/tutors/tutor-filter-form";
import { DirectorySearch } from "@/features/tutors/directory-search";
import { parseDirectorySearch } from "@/features/tutors/search";

const subjects = [
  {
    id: "1",
    slug: "math",
    name: "Math",
    category: "academic_core" as const,
    isActive: true,
  },
];
function search(props: Partial<ComponentProps<typeof DirectorySearch>> = {}) {
  return render(
    <DirectorySearch
      href="/tutors"
      subjects={subjects}
      languages={["en"]}
      draft={{ days: [] }}
      zones={[{ value: "UTC", label: "UTC (GMT)" }]}
      fields={{}}
      {...props}
    />,
  );
}
beforeEach(() => navigation.replace.mockReset());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("is a native GET search sentence that keeps College Support, language and a safe time", async () => {
  search({
    level: "college_support",
    language: "en",
    zone: "UTC",
    draft: { timezone: "UTC", when: "preferred", days: [1], range: "morning" },
  });
  const form = screen.getByRole("search", { name: "Filter tutors" });
  expect(form).toHaveAttribute("method", "get");
  expect(form).toHaveAttribute("action", "/tutors");
  expect(screen.getByLabelText("Subject")).toHaveValue("");
  expect(screen.getByLabelText("Level")).toHaveValue("college_support");
  expect(screen.getByLabelText("Teaching language")).toHaveValue("en");
  expect(screen.getByRole("button", { name: /Lesson time/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(screen.getByLabelText("Monday")).toBeChecked();
  await userEvent.click(screen.getByLabelText("Sunday"));
  const data = new FormData(form as HTMLFormElement);
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

it("updates results on change, after a short pause, without a submit button", () => {
  vi.useFakeTimers();
  search({ zone: "UTC" });
  expect(screen.queryByRole("button", { name: "Apply filters" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Subject"), {
    target: { value: "math" },
  });
  expect(navigation.replace).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(200));
  expect(navigation.replace).toHaveBeenCalledWith("/tutors?subject=math", {
    scroll: false,
  });
  // A day alone is not a time preference yet; a time of day completes it.
  fireEvent.click(screen.getByRole("button", { name: /Lesson time/ }));
  fireEvent.click(screen.getByLabelText("Monday"));
  act(() => vi.advanceTimersByTime(500));
  expect(navigation.replace).toHaveBeenCalledTimes(1);
  expect(
    screen.getByText(
      "Choose at least one day and a time of day to see who fits.",
    ),
  ).toBeVisible();
  fireEvent.click(screen.getByLabelText(/^Morning/));
  act(() => vi.advanceTimersByTime(500));
  expect(navigation.replace).toHaveBeenLastCalledWith(
    "/tutors?subject=math&when=preferred&timezone=UTC&days=1&range=morning",
    { scroll: false },
  );
  // Pressing the chosen time of day again clears it.
  fireEvent.click(screen.getByLabelText(/^Morning/));
  expect(screen.getByLabelText(/^Morning/)).not.toBeChecked();
});

it("shows Clear filters only when something is set, and the time panel on request", () => {
  search();
  expect(screen.queryByRole("link", { name: "Clear filters" })).toBeNull();
  const toggle = screen.getByRole("button", { name: /Lesson time/ });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(document.getElementById("tutor-search-time")).toHaveAttribute(
    "data-collapsed",
  );
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(document.getElementById("tutor-search-time")).not.toHaveAttribute(
    "data-collapsed",
  );
  cleanup();
  search({ subject: "math" });
  expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
    "href",
    "/tutors",
  );
});

it("associates invalid preferences with visible errors and focuses the first correction", () => {
  search({
    zone: "UTC",
    draft: { timezone: "UTC", when: "preferred", days: [1] },
    fields: { range: "Choose a time-of-day range" },
  });
  expect(screen.getByLabelText(/^Early morning/)).toHaveFocus();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Choose a time-of-day range",
  );
});

it("keeps the homepage finder short and without a time filter", () => {
  render(<TutorFilterForm variant="finder" subjects={[]} />);
  expect(screen.queryByText("Lesson time (optional)")).toBeNull();
  expect(screen.getByRole("button", { name: "Find a tutor" })).toBeVisible();
});

it("finder disables only submit while pending, preserves native GET values and restores navigation", () => {
  render(
    <TutorFilterForm variant="finder" subjects={[]} level="college_support" />,
  );
  const form = screen.getByRole("search") as HTMLFormElement;
  const submit = screen.getByRole("button", { name: "Find a tutor" });
  const values = () => [...new FormData(form).entries()];
  const initial = values();
  expect(form).toHaveAttribute("method", "get");
  expect(form).toHaveAttribute("action", "/tutors");
  for (const event of ["pageshow", "popstate"]) {
    // The first submit keeps the browser's default GET; a pending repeat does not.
    expect(fireEvent.submit(form)).toBe(true);
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(submit).toBeDisabled();
    expect(screen.getByLabelText("Level")).toBeEnabled();
    expect(values()).toEqual(initial);
    expect(fireEvent.submit(form)).toBe(false);
    fireEvent(window, new Event(event));
    expect(form).toHaveAttribute("aria-busy", "false");
    expect(submit).toBeEnabled();
  }
});
