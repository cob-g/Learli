"use client";

import { useEffect, useRef, useState } from "react";
import { Hourglass, TimerOff, CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { demoLiveState } from "./lifecycle-model";
import { bookingStatusLabel } from "@/features/private-workflow/notice";
import type { BookingSummary } from "./read-model";

/** Only a display projection; never appends history or claims a DB transition. */
export function BookingReadStatus({
  booking,
  privateWorkflow = false,
}: {
  booking: BookingSummary;
  privateWorkflow?: boolean;
}) {
  const [elapsed, setElapsed] = useState(false);
  const router = useRouter();
  // Refresh once per deadline so a lagging server snapshot cannot loop.
  const refreshedFor = useRef<string>(null);
  useEffect(() => {
    if (!demoLiveState(booking.state) && booking.state !== "provisional")
      return;
    const remaining =
      new Date(booking.expiresAtUtc).getTime() -
      new Date(booking.snapshotAtUtc).getTime();
    // Device wall-clock skew cannot shorten or renew authoritative server state.
    const delay = Math.max(0, remaining);
    const started = performance.now();
    const expire = () => {
      setElapsed(true);
      if (refreshedFor.current === booking.expiresAtUtc) return;
      refreshedFor.current = booking.expiresAtUtc;
      // Server-rendered actions (meeting link, reschedule, cancel) must be
      // replaced by the server's expired state.
      router.refresh();
    };
    const timer = window.setTimeout(expire, delay);
    const check = () => {
      if (performance.now() - started >= delay) expire();
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [booking.state, booking.expiresAtUtc, booking.snapshotAtUtc, router]);
  const expired =
    booking.state === "demo_expired" ||
    booking.state === "expired" ||
    ((demoLiveState(booking.state) || booking.state === "provisional") &&
      elapsed);
  const terminal =
    expired ||
    (!demoLiveState(booking.state) &&
      booking.state !== "provisional" &&
      booking.state !== "confirmed");
  const Icon =
    booking.state === "confirmed"
      ? CircleCheck
      : terminal
        ? TimerOff
        : Hourglass;
  return (
    <div aria-live="polite" className="space-y-2">
      <span
        className={`inline-flex min-h-7 max-w-full items-center gap-1 rounded-tag border px-2 text-label ${booking.state === "confirmed" ? "border-success bg-success-soft text-success" : terminal ? "border-control bg-subtle text-muted-foreground" : "border-warning bg-warning-soft text-warning"}`}
      >
        <Icon aria-hidden="true" size={16} className="shrink-0" />
        <span className="min-w-0 wrap-anywhere">
          {expired
            ? privateWorkflow
              ? "Expired"
              : booking.source === "synthetic_readiness"
                ? "Synthetic booking expired"
                : "Simulation expired"
            : bookingStatusLabel(booking.state, privateWorkflow)}
        </span>
      </span>
      <p className="text-small text-muted-foreground">
        {privateWorkflow
          ? expired
            ? "The provisional deadline elapsed. This record remains in your history."
            : booking.state === "provisional"
              ? "Awaiting assigned review before confirmation. This request expires at the saved deadline."
              : booking.state === "confirmed"
                ? "The booking is confirmed. Join using the private meeting details when available. No payment or attendance is established."
                : "This saved outcome remains in your history. Ending a video call does not update the booking."
          : booking.source === "synthetic_readiness"
            ? booking.state === "provisional"
              ? "Synthetic test only. Assigned prerequisite review is required before confirmation; the saved provisional deadline is finite."
              : booking.state === "confirmed"
                ? "Synthetic confirmation only. The original provisional deadline no longer expires this booking; no payment or attendance is established."
                : "Synthetic administrative history only. For a disputed outcome, contact support; no attendance was observed."
            : expired
              ? "The simulation lifetime has elapsed. This record is retained in your history."
              : demoLiveState(booking.state)
                ? "This local simulation expires at the saved deadline. No lesson is confirmed."
                : "This synthetic administrative outcome is retained in history. No payment or attendance is recorded."}
      </p>
    </div>
  );
}
