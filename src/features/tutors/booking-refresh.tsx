"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function LoadingTutorBookings() {
  return (
    <p role="status" className="mt-2 text-body">
      Loading your assigned bookings…
    </p>
  );
}

const fallbackIntervalMs = 60_000;

function subscribeToConnection(update: () => void) {
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  return () => {
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
  };
}

/** Reuse the same authenticated update lifecycle on the dashboard and detail. */
function useBookingLiveUpdates(
  endpoint:
    | "/api/tutor/bookings/events"
    | "/api/student/bookings/events"
    | "/api/parent/bookings/events",
) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [autoPending, startAutoTransition] = useTransition();
  const [connection, setConnection] = useState<
    "connected" | "reconnecting" | null
  >(null);
  const busy = useRef(false);
  const queued = useRef(false);
  const online = useSyncExternalStore<boolean | null>(
    subscribeToConnection,
    () => navigator.onLine,
    () => null,
  );

  useEffect(() => {
    busy.current = pending || autoPending;
    if (
      !busy.current &&
      queued.current &&
      document.visibilityState === "visible" &&
      navigator.onLine
    ) {
      queued.current = false;
      startAutoTransition(() => router.refresh());
    }
  }, [router, pending, autoPending]);

  useEffect(() => {
    let source: EventSource | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let disposed = false;
    function refreshIfVisible() {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      if (busy.current) {
        queued.current = true;
        return;
      }
      startAutoTransition(() => router.refresh());
    }
    function syncConnection() {
      if (document.visibilityState !== "visible" || !navigator.onLine) {
        source?.close();
        source = undefined;
        if (retry) clearTimeout(retry);
        retry = undefined;
        return;
      }
      if (source || retry || disposed) return;
      if (typeof EventSource === "undefined") {
        setConnection("reconnecting");
        return;
      }
      const stream = new EventSource(endpoint);
      source = stream;
      stream.addEventListener("changed", () => {
        if (source !== stream) return;
        attempts = 0;
        setConnection("connected");
        refreshIfVisible();
      });
      stream.onerror = () => {
        if (source !== stream) return;
        stream.close();
        source = undefined;
        setConnection("reconnecting");
        const delay = Math.min(30_000, 2_000 * 2 ** Math.min(attempts++, 4));
        retry = setTimeout(() => {
          retry = undefined;
          syncConnection();
        }, delay);
      };
    }
    syncConnection();
    const timer = window.setInterval(refreshIfVisible, fallbackIntervalMs);
    document.addEventListener("visibilitychange", syncConnection);
    window.addEventListener("online", syncConnection);
    window.addEventListener("offline", syncConnection);
    return () => {
      disposed = true;
      source?.close();
      if (retry) clearTimeout(retry);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", syncConnection);
      window.removeEventListener("online", syncConnection);
      window.removeEventListener("offline", syncConnection);
    };
  }, [router, endpoint]);

  function refresh(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(() => router.refresh());
  }
  return { pending, autoPending, connection, online, refresh };
}

/** The detail page keeps its existing layout; fresh data comes from its guarded server read. */
export function TutorBookingDetailLive() {
  useBookingLiveUpdates("/api/tutor/bookings/events");
  return null;
}

/** Student views reread their own authorized projection on a generic signal. */
export function StudentBookingLive({
  showStatus = false,
  audience = "student",
}: {
  showStatus?: boolean;
  audience?: "student" | "parent";
}) {
  const { connection, online } = useBookingLiveUpdates(
    audience === "parent"
      ? "/api/parent/bookings/events"
      : "/api/student/bookings/events",
  );
  if (!showStatus || online === null || (online && connection === null))
    return null;
  return (
    <p role="status" className="text-small text-muted-foreground">
      {!online
        ? "You are offline. Check bookings again when you reconnect."
        : connection === "connected"
          ? "Live booking updates are connected."
          : "Live updates are reconnecting. Bookings are checked periodically."}
    </p>
  );
}

/** Native GET remains usable without scripts; refresh announces a client transition. */
export function TutorBookingRefresh() {
  const { pending, autoPending, connection, online, refresh } =
    useBookingLiveUpdates("/api/tutor/bookings/events");
  return (
    <form action="/tutor" method="get" onSubmit={refresh} aria-busy={pending}>
      <button
        className="action action-outline tutor-refresh"
        type="submit"
        disabled={pending || autoPending}
      >
        <RefreshCw size={15} aria-hidden="true" />
        Refresh bookings
      </button>
      {pending && <LoadingTutorBookings />}
      {online !== null && connection !== null && (
        <p className="mt-2 text-small text-muted-foreground">
          {!online
            ? "You are offline. Check bookings again when you reconnect."
            : connection === "connected"
              ? "Live booking updates are connected."
              : "Live updates are reconnecting. Bookings are checked periodically."}
        </p>
      )}
    </form>
  );
}
