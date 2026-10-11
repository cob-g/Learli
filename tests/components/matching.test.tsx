// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { ChoiceError, WhenForm } from "@/features/matching/when-form";
import { parseMatchPreferences } from "@/features/matching/preferences";
afterEach(cleanup);
it("focuses the invalid level group without changing the native controls", async () => {
  render(
    <form>
      <ChoiceError message="Choose a level" focusField="level" />
      <label>
        <input name="level" type="radio" value="college_support" />
        College Support
      </label>
    </form>,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("College Support")).toHaveFocus(),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a level");
});
it("retains safe partial answers and focuses the field that needs correction", async () => {
  render(
    <WhenForm
      level="college_support"
      subject="math"
      draft={{ timezone: "UTC", when: "preferred", days: [1] }}
      fields={{ range: "Choose a time-of-day range" }}
      zones={[{ value: "UTC", label: "UTC (GMT)" }]}
    />,
  );
  await waitFor(() => expect(screen.getAllByRole("radio")[2]).toHaveFocus());
  expect(screen.getByLabelText("Monday")).toBeChecked();
  await userEvent.click(screen.getByLabelText("Morning (6:00 AM – 12:00 PM)"));
  const form = screen
    .getByRole("button", { name: "Show matching tutors" })
    .closest("form");
  const data = new FormData(form!);
  const params = {
    timezone: String(data.get("timezone")),
    when: String(data.get("when")),
    days: data.getAll("days").map(String),
    range: String(data.get("range")),
  };
  expect(parseMatchPreferences(params).preferences).toEqual({
    timezone: "UTC",
    when: "preferred",
    days: [1],
    range: "morning",
  });
  await userEvent.click(screen.getByLabelText("Any time", { exact: true }));
  params.when = String(new FormData(form!).get("when"));
  expect(parseMatchPreferences(params).preferences).toEqual({
    timezone: "UTC",
    when: "any",
  });
});
