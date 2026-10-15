// @vitest-environment jsdom
import { StrictMode, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PrivateDocumentBoundary,
  PublicAuthDocumentBoundary,
} from "@/features/auth/document-boundary";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { BookingMeetingSection } from "@/features/booking-meeting-links/meeting-section";
import { SessionList } from "@/features/account-sessions/session-list";

const state = vi.hoisted(() => ({
  session: {
    data: null as {
      user: { id: string; name: string };
      session: { id: string };
    } | null,
    isPending: true,
    isRefetching: true,
    error: null as { status: number } | Error | null,
    refetch: vi.fn(),
  },
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => state.session },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/account/sessions",
  useSearchParams: () => new URLSearchParams("scope=tutor"),
}));
vi.mock("@/components/shared/brand-logo", () => ({
  BrandLogo: () => <span>Learli</span>,
}));

const identity = { id: "synthetic-owner-a", sessionId: "synthetic-session-a" };
const account = {
  ...identity,
  name: "Synthetic owner A",
  roles: ["tutor" as const],
};
const privateMarker = "Synthetic A-only private booking";
const meetingUrl = "https://meet.google.com/aaa-bbbb-ccc?synthetic=owner-a";
const exactUrl =
  "http://localhost:3000/bookings/synthetic-a?scope=tutor&next=%2Faccount%3Fx%3D1#meeting";
const replace = vi.fn();
const reload = vi.fn();
const fetchMock = vi.fn();

function settle(id = identity.id, sessionId = identity.sessionId) {
  state.session.data = { user: { id, name: id }, session: { id: sessionId } };
  state.session.isPending = false;
  state.session.isRefetching = false;
  state.session.error = null;
}
function boundary(
  initialIdentity: typeof identity | null = identity,
  children: ReactNode = <p>{privateMarker}</p>,
) {
  return (
    <PrivateDocumentBoundary initialIdentity={initialIdentity}>
      {children}
    </PrivateDocumentBoundary>
  );
}

beforeEach(() => {
  state.session.data = null;
  state.session.isPending = true;
  state.session.isRefetching = true;
  state.session.error = null;
  state.session.refetch.mockClear();
  reload.mockReset().mockImplementation(() => {
    expect(window.location.href).toBe(exactUrl);
    // Navigation must begin only after the old rendered subtree is removed.
    expect(screen.queryByText(privateMarker)).toBeNull();
    expect(screen.queryByDisplayValue(meetingUrl)).toBeNull();
    expect(screen.queryByText(/Synthetic A-only browser/)).toBeNull();
  });
  replace.mockReset();
  const nativeWindow = window;
  vi.stubGlobal(
    "window",
    new Proxy(nativeWindow, {
      get(target, key) {
        if (key === "location") return { href: exactUrl, replace, reload };
        const value = Reflect.get(target, key, target);
        return [
          "addEventListener",
          "removeEventListener",
          "dispatchEvent",
        ].includes(String(key))
          ? value.bind(target)
          : value;
      },
    }),
  );
  fetchMock
    .mockReset()
    .mockResolvedValue({ ok: true, json: async () => ({ sessions: [] }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("private document identity lifetime", () => {
  it("removes actual private meeting/session children before replacing after a settled cross-account refresh", async () => {
    settle();
    let resolveSessions!: (response: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSessions = resolve;
      }),
    );
    const content = () =>
      boundary(
        identity,
        <WorkspaceShell initialAccount={account}>
          <h1>{privateMarker}</h1>
          <BookingMeetingSection
            bookingId="synthetic-a"
            initial={{
              state: "present",
              canEdit: true,
              revision: 1,
              provider: "google_meet",
              url: meetingUrl,
            }}
          />
          <SessionList />
        </WorkspaceShell>,
      );
    const view = render(content());
    await act(async () =>
      resolveSessions({
        ok: true,
        json: async () => ({
          sessions: [
            {
              id: "synthetic-device-a",
              current: true,
              reportedDevice: "Synthetic A-only browser",
              createdAt: "2026-10-15T00:00:00Z",
              updatedAt: "2026-10-15T00:00:00Z",
              expiresAt: "2026-10-16T00:00:00Z",
            },
          ],
        }),
      }),
    );
    expect(screen.getByDisplayValue(meetingUrl)).toBeVisible();
    expect(screen.getByText(/Synthetic A-only browser/)).toBeVisible();
    state.session.isRefetching = true;
    view.rerender(content());
    expect(screen.getByText(privateMarker)).toBeVisible();
    expect(reload).not.toHaveBeenCalled();
    settle("synthetic-owner-b", "synthetic-session-b");
    view.rerender(content());
    expect(screen.queryByText(privateMarker)).toBeNull();
    expect(screen.queryByDisplayValue(meetingUrl)).toBeNull();
    expect(reload).toHaveBeenCalledExactlyOnceWith();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.session.refetch).not.toHaveBeenCalled();
  });

  it.each([
    "signed out",
    "same-user replacement session",
    "different user",
    "401 denial",
  ])(
    "replaces on a proven %s even when the first provider read differs",
    (transition) => {
      const view = render(boundary());
      expect(screen.getByText(privateMarker)).toBeVisible();
      settle();
      if (transition === "signed out" || transition === "401 denial")
        state.session.data = null;
      if (transition === "401 denial") state.session.error = { status: 401 };
      if (transition === "same-user replacement session")
        state.session.data!.session.id = "replacement";
      if (transition === "different user")
        state.session.data!.user.id = "synthetic-owner-b";
      view.rerender(boundary());
      expect(screen.queryByText(privateMarker)).toBeNull();
      expect(reload).toHaveBeenCalledExactlyOnceWith();
    },
  );

  it("never revives the old subtree after A to B to A, changed props, error or pending state", () => {
    settle();
    const view = render(boundary());
    settle("synthetic-b", "session-b");
    view.rerender(boundary());
    settle();
    view.rerender(boundary());
    view.rerender(boundary({ id: "synthetic-b", sessionId: "session-b" }));
    state.session.isPending = true;
    state.session.isRefetching = true;
    state.session.error = new Error("Offline");
    view.rerender(boundary());
    expect(screen.queryByText(privateMarker)).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("keeps mounted private state on same-identity refresh and account updates without extra reads", () => {
    settle();
    function PrivateEditor() {
      return (
        <input
          aria-label="Private draft"
          defaultValue="Unsaved synthetic draft"
        />
      );
    }
    const view = render(boundary(identity, <PrivateEditor />));
    const input = screen.getByRole("textbox");
    state.session.isRefetching = true;
    view.rerender(boundary(identity, <PrivateEditor />));
    settle();
    state.session.data!.user.name = "Renamed synthetic owner";
    view.rerender(boundary(identity, <PrivateEditor />));
    expect(screen.getByRole("textbox")).toBe(input);
    expect(reload).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.session.refetch).not.toHaveBeenCalled();
  });

  it.each([
    null,
    {
      user: { id: "stale-user", name: "Stale" },
      session: { id: "stale-session" },
    },
  ])(
    "does not treat pending or transient failed reads as identity changes (%j)",
    (data) => {
      const view = render(boundary());
      state.session.data = data;
      view.rerender(boundary());
      state.session.isPending = false;
      state.session.isRefetching = false;
      state.session.error = new Error("Offline");
      view.rerender(boundary());
      expect(screen.getByText(privateMarker)).toBeVisible();
      settle();
      view.rerender(boundary());
      expect(screen.getByText(privateMarker)).toBeVisible();
      expect(reload).not.toHaveBeenCalled();
    },
  );

  it("waits for a settled result even when a refresh has a different cached identity", () => {
    const view = render(boundary());
    settle("synthetic-b", "session-b");
    state.session.isRefetching = true;
    view.rerender(boundary());
    expect(screen.getByText(privateMarker)).toBeVisible();
    settle();
    view.rerender(boundary());
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not loop for an absent server account, but binds later settled identity transitions", () => {
    const view = render(boundary(null));
    state.session.isPending = false;
    state.session.isRefetching = false;
    view.rerender(boundary(null));
    expect(reload).not.toHaveBeenCalled();
    settle();
    view.rerender(boundary(null));
    expect(screen.getByText(privateMarker)).toBeVisible();
    expect(reload).not.toHaveBeenCalled();
    state.session.isRefetching = true;
    view.rerender(boundary(null));
    settle();
    view.rerender(boundary(null));
    expect(reload).not.toHaveBeenCalled();
    state.session.data = null;
    view.rerender(boundary(null));
    expect(screen.queryByText(privateMarker)).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("replaces once under StrictMode and keeps the subtree empty during replacement", () => {
    settle("synthetic-b", "session-b");
    const view = render(<StrictMode>{boundary()}</StrictMode>);
    expect(screen.queryByText(privateMarker)).toBeNull();
    view.rerender(<StrictMode>{boundary()}</StrictMode>);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("retains server rendering, native auth entry and the existing private BFCache guard", () => {
    expect(renderToString(boundary())).toContain(privateMarker);
    const view = render(boundary());
    reload.mockImplementation(() => {});
    const normal = new Event("pageshow");
    Object.defineProperty(normal, "persisted", { value: false });
    window.dispatchEvent(normal);
    expect(reload).not.toHaveBeenCalled();
    const restored = new Event("pageshow");
    Object.defineProperty(restored, "persisted", { value: true });
    window.dispatchEvent(restored);
    expect(reload).toHaveBeenCalled();
    view.rerender(
      <PublicAuthDocumentBoundary>
        <p>Public auth form</p>
      </PublicAuthDocumentBoundary>,
    );
    expect(screen.queryByText("Public auth form")).toBeNull();
    expect(replace).toHaveBeenCalledWith(exactUrl);
    expect(
      renderToString(
        <PublicAuthDocumentBoundary>
          <p>Native auth form</p>
        </PublicAuthDocumentBoundary>,
      ),
    ).toContain("Native auth form");
  });
});
