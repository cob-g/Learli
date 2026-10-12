// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  DemoCancelControl,
  DemoRescheduleForm,
} from "@/features/bookings/lifecycle-controls";
import type { BookingDetail } from "@/features/bookings/read-model";
const time = {
  startAtUtc: "2026-10-17T02:00:00.000Z",
  endAtUtc: "2026-10-17T03:00:00.000Z",
  date: "Saturday, October 17, 2026",
  time: "10:00 – 11:00 AM",
  zone: "Philippine Standard Time (GMT+8)",
};
const booking: BookingDetail = {
  id: "b24ff392-fdbb-4ae1-9fa3-a7c750c70737",
  source: "local_simulation",
  logicalBookingId: "b24ff392-fdbb-4ae1-9fa3-a7c750c70737",
  revision: 0,
  currentHeadId: "b24ff392-fdbb-4ae1-9fa3-a7c750c70737",
  tutor: { displayName: "Synthetic tutor", slug: "synthetic-tutor" },
  subject: { name: "Math", slug: "math" },
  learner: {
    id: "51f9d9a4-3a2b-4de5-8aae-1f27023927b5",
    displayName: "Synthetic learner",
    level: "elementary",
  },
  state: "demo_reserved",
  persistedState: "demo_reserved",
  snapshotAtUtc: "2026-10-12T00:00:00.000Z",
  expiresAtUtc: "2026-10-12T00:10:00.000Z",
  expiryMaterialized: false,
  time,
  expires: time,
  viewerTimezone: "Asia/Manila",
  events: [],
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("synthetic lifecycle controls", () => {
  it("does not render mutation controls for tutor or retired physical row", () => {
    const view = render(<DemoCancelControl booking={booking} scope="tutor" />);
    expect(screen.queryByRole("button")).toBeNull();
    view.rerender(
      <DemoCancelControl
        booking={{ ...booking, state: "demo_replaced" }}
        scope="guardian"
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("announces a missing time without issuing a mutation", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(
      <DemoRescheduleForm booking={booking} scope="guardian" times={[time]} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Move simulated reservation" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a time");
    expect(fetch).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("radio")).toHaveFocus());
  });
  it("pending disables controls and failed request retains original selection with focused safe feedback", async () => {
    let resolve!: (value: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      ),
    );
    render(
      <DemoRescheduleForm booking={booking} scope="guardian" times={[time]} />,
    );
    await userEvent.click(screen.getByRole("radio"));
    await userEvent.click(
      screen.getByRole("button", { name: "Move simulated reservation" }),
    );
    expect(
      screen.getByRole("button", { name: "Moving simulation…" }),
    ).toBeDisabled();
    resolve({
      ok: false,
      json: async () => ({
        message: "That time is no longer available. Please choose another.",
      }),
    });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
    expect(screen.getByRole("radio")).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Move simulated reservation" }),
    ).toBeEnabled();
  });
  it("uncertain cancellation locks new mutation and provides native recovery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("synthetic network failure")),
    );
    render(<DemoCancelControl booking={booking} scope="guardian" />);
    await userEvent.click(
      screen.getByText("Cancel simulation", { exact: true }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm simulated cancellation" }),
    );
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
    expect(
      screen.getByRole("button", { name: "Confirm simulated cancellation" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Reload booking details" }),
    ).toHaveAttribute("href", `/bookings/${booking.id}?scope=guardian`);
  });
});
