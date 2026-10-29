// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AvailabilityForm } from "@/features/availability/availability-form";

const timeZones = [{ value: "Asia/Manila", label: "Asia/Manila" }];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("availability native time controls", () => {
  it("blocks a blank draft instead of submitting the previous minute value", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ version: 4 }, { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(
      <AvailabilityForm
        initial={{
          timezone: "Asia/Manila",
          version: 3,
          editable: true,
          windows: [],
        }}
        timeZones={timeZones}
      />,
    );
    const monday = within(screen.getByRole("group", { name: "Monday" }));
    await userEvent.click(
      monday.getByRole("button", {
        name: "Add time range",
      }),
    );
    const start = screen.getByLabelText("Start time");
    const end = screen.getByLabelText("End time");
    expect(start).toHaveAttribute("type", "time");
    expect(start).toHaveAttribute("step", "60");
    expect(start).toHaveValue("09:00");
    expect(end).toHaveValue("10:00");

    fireEvent.change(start, { target: { value: "23:00" } });
    fireEvent.change(end, { target: { value: "" } });
    await userEvent.click(
      screen.getByRole("button", { name: "Save availability" }),
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a valid end time.")).toBeVisible();
    await waitFor(() => expect(end).toHaveFocus());

    fireEvent.change(end, { target: { value: "01:00" } });
    await userEvent.click(screen.getByLabelText("Ends next day"));
    await userEvent.click(
      screen.getByRole("button", { name: "Save availability" }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      timezone: "Asia/Manila",
      version: 3,
      windows: [{ isoWeekday: 1, startMinute: 1380, endMinute: 1500 }],
    });
  });

  it("round-trips next-day midnight without changing the stored meaning", () => {
    render(
      <AvailabilityForm
        initial={{
          timezone: "Asia/Manila",
          version: 1,
          editable: true,
          windows: [{ isoWeekday: 7, startMinute: 1380, endMinute: 1440 }],
        }}
        timeZones={timeZones}
      />,
    );
    const sunday = within(screen.getByRole("group", { name: "Sunday" }));
    expect(sunday.getByLabelText("Start time")).toHaveValue("23:00");
    expect(sunday.getByLabelText("End time")).toHaveValue("00:00");
    expect(sunday.getByLabelText("Ends next day")).toBeChecked();
  });
});
