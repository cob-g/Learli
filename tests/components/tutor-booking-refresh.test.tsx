// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense, useState } from "react";
import {
  StudentBookingLive,
  TutorBookingDetailLive,
  TutorBookingRefresh,
} from "@/features/tutors/booking-refresh";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

class FakeSource extends EventTarget {
  static instances: FakeSource[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    super();
    FakeSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

describe("tutor booking live updates", () => {
  let visible: DocumentVisibilityState;
  let online: boolean;
  beforeEach(() => {
    vi.useFakeTimers();
    visible = "visible";
    online = true;
    FakeSource.instances = [];
    vi.stubGlobal("EventSource", FakeSource);
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visible,
    );
    vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
    router.refresh.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("refreshes on connection and change, with a slow fallback and native manual control", () => {
    render(<TutorBookingRefresh />);
    const source = FakeSource.instances[0];
    expect(source.url).toBe("/api/tutor/bookings/events");
    expect(
      screen.getByRole("button", { name: "Refresh bookings" }).closest("form"),
    ).toHaveAttribute("method", "get");
    act(() => source.onopen?.());
    expect(router.refresh).not.toHaveBeenCalled();
    act(() => source.dispatchEvent(new Event("changed")));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    act(() => source.dispatchEvent(new Event("changed")));
    expect(router.refresh).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(5_000));
    expect(router.refresh).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(55_000));
    expect(router.refresh).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole("button", { name: "Refresh bookings" }));
    expect(router.refresh).toHaveBeenCalledTimes(4);
    act(() => source.onerror?.());
    expect(screen.getByText(/reconnecting/)).toBeVisible();
  });

  it("keeps the periodic Student refresh when EventSource is unavailable", () => {
    vi.stubGlobal("EventSource", undefined);
    render(<StudentBookingLive showStatus />);
    expect(screen.getByText(/reconnecting/)).toBeVisible();
    act(() => vi.advanceTimersByTime(60_000));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("uses the Parent stream and refreshes the authorized view on change", () => {
    render(<StudentBookingLive audience="parent" showStatus />);
    const source = FakeSource.instances[0];
    expect(source.url).toBe("/api/parent/bookings/events");
    act(() => source.dispatchEvent(new Event("changed")));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/Live booking updates are connected/),
    ).toBeVisible();
  });

  it("closes while hidden or offline, reconnects on return, and cleans up", () => {
    const view = render(<TutorBookingRefresh />);
    const first = FakeSource.instances[0];
    act(() => {
      first.onopen?.();
      first.dispatchEvent(new Event("changed"));
    });
    visible = "hidden";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(120_000);
    });
    expect(first.closed).toBe(true);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    visible = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    const second = FakeSource.instances[1];
    act(() => first.onerror?.());
    expect(second.closed).toBe(false);
    act(() => second.dispatchEvent(new Event("changed")));
    expect(router.refresh).toHaveBeenCalledTimes(2);
    online = false;
    act(() => {
      window.dispatchEvent(new Event("offline"));
      vi.advanceTimersByTime(120_000);
    });
    expect(second.closed).toBe(true);
    expect(router.refresh).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/You are offline/)).toBeVisible();
    online = true;
    act(() => window.dispatchEvent(new Event("online")));
    const third = FakeSource.instances[2];
    act(() => third.dispatchEvent(new Event("changed")));
    expect(router.refresh).toHaveBeenCalledTimes(3);
    view.unmount();
    expect(third.closed).toBe(true);
    act(() => vi.advanceTimersByTime(120_000));
    expect(router.refresh).toHaveBeenCalledTimes(3);
  });

  it("queues a change received during an in-flight refresh", async () => {
    let release!: () => void;
    let ready = false;
    const slowRead = new Promise<void>((resolve) => {
      release = () => {
        ready = true;
        resolve();
      };
    });
    function Waiting({ pending }: { pending: boolean }) {
      if (pending && !ready) throw slowRead;
      return null;
    }
    function Page() {
      const [waiting, setWaiting] = useState(false);
      router.refresh.mockImplementation(() => setWaiting(true));
      return (
        <Suspense fallback={<p>Loading</p>}>
          <TutorBookingRefresh />
          <Waiting pending={waiting} />
        </Suspense>
      );
    }
    render(<Page />);
    const source = FakeSource.instances[0];
    act(() => source.dispatchEvent(new Event("changed")));
    expect(
      screen.getByRole("button", { name: "Refresh bookings" }),
    ).toBeDisabled();
    act(() => source.dispatchEvent(new Event("changed")));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
      await slowRead;
    });
    expect(router.refresh).toHaveBeenCalledTimes(2);
  });

  it("uses the same event-driven updates on an open Tutor detail", () => {
    const view = render(<TutorBookingDetailLive />);
    const source = FakeSource.instances[0];
    expect(source.url).toBe("/api/tutor/bookings/events");
    act(() => source.dispatchEvent(new Event("changed")));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(5_000));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(source.closed).toBe(true);
  });
});
