// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GoogleMeetConnectionPanel } from "@/features/google-meet/connection-panel";
import { BookingMeetingSection } from "@/features/booking-meeting-links/meeting-section";
vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => true }));
afterEach(() => vi.unstubAllGlobals());
describe("Google Meet coordination UI", () => {
  it("keeps manual fallback visible when automatic creation is unavailable", () => {
    render(
      <GoogleMeetConnectionPanel
        enabled={false}
        connection={null}
        result="connected"
      />,
    );
    expect(screen.getByText("Not connected")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Connect Google account" }),
    ).toBeNull();
    expect(
      screen.getByText(/not configured in this environment/),
    ).toBeVisible();
    expect(screen.queryByText(/Google account connected\./)).toBeNull();
  });
  it("requires affirmative consent and reports an unsuccessful connection without a success state", async () => {
    const send = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { message: "Sign in again to connect." },
          { status: 403 },
        ),
      );
    vi.stubGlobal("fetch", send);
    render(<GoogleMeetConnectionPanel enabled connection={null} />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeRequired();
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    fireEvent.submit(checkbox.closest("form")!);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Sign in again to connect.",
      ),
    );
    expect(JSON.parse(send.mock.calls[0][1].body)).toEqual({
      consent: true,
      replaceAccount: false,
    });
    expect(screen.getByText("Not connected")).toBeVisible();
  });
  it("disconnects locally while honestly reporting unconfirmed provider revocation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ disconnected: true, providerRevoked: false }),
        ),
    );
    render(
      <GoogleMeetConnectionPanel
        enabled
        connection={{
          state: "active",
          account_label: "synthetic@learli.test",
          generation: 1,
        }}
      />,
    );
    const button = screen.getByRole("button", { name: "Disconnect Google" });
    expect(button.closest("form")!.querySelector("input")).toBeRequired();
    fireEvent.submit(button.closest("form")!);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Disconnected in Learli",
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Existing bookings and saved links remain available",
    );
    expect(screen.queryByText(/Your Google account:/)).toBeNull();
    expect(screen.getByText("Not connected")).toBeVisible();
  });
  it("pending automatic creation leaves the manual form available and does not claim attendance", () => {
    render(
      <BookingMeetingSection
        bookingId="synthetic-booking"
        initial={{
          state: "missing",
          canEdit: true,
          revision: 0,
          provisioning: "preparing",
        }}
        privateWorkflow
      />,
    );
    expect(screen.getByText(/Preparing your meeting link/)).toHaveTextContent(
      "booking remains confirmed",
    );
    expect(
      screen.getByRole("button", { name: "Save meeting link" }),
    ).toBeEnabled();
    expect(screen.getByRole("link", { name: "Meeting setup" })).toHaveAttribute(
      "href",
      "/tutor/meetings",
    );
    expect(screen.queryByRole("link", { name: /Open meeting/ })).toBeNull();
  });
  it("participants receive safe recovery copy without tutor connection identifiers", () => {
    render(
      <BookingMeetingSection
        bookingId="synthetic-booking"
        initial={{
          state: "missing",
          canEdit: false,
          revision: 0,
          provisioning: "action_required",
        }}
        privateWorkflow
      />,
    );
    expect(screen.getByText(/Your tutor needs to arrange/)).toBeVisible();
    expect(screen.queryByRole("link", { name: "Meeting setup" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
