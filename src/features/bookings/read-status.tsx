"use client";

import { useEffect, useState } from "react";
import { Hourglass, TimerOff } from "lucide-react";
import { useRouter } from "next/navigation";
import type { BookingSummary } from "./read-model";

/** Only a display projection; never appends history or claims a DB transition. */
export function BookingReadStatus({ booking }: { booking: BookingSummary }) {
  const [elapsed, setElapsed] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const remaining =
      new Date(booking.expiresAtUtc).getTime() -
      new Date(booking.snapshotAtUtc).getTime();
    // Device wall-clock skew cannot shorten or renew authoritative server state.
    const delay = Math.max(0, remaining);
    const started = performance.now();
    const timer = window.setTimeout(() => setElapsed(true), delay);
    const check = () => {
      if (performance.now() - started >= delay) setElapsed(true);
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [booking.expiresAtUtc, booking.snapshotAtUtc, router]);
  const expired = booking.state === "demo_expired" || elapsed;
  const Icon = expired ? TimerOff : Hourglass;
  return (
    <div aria-live="polite" className="space-y-2">
      <span
        className={`inline-flex min-h-7 items-center gap-1 rounded-tag border px-2 text-label ${expired ? "border-control bg-subtle text-muted-foreground" : "border-warning bg-warning-soft text-warning"}`}
      >
        <Icon aria-hidden="true" size={16} />
        {expired ? "Simulation expired" : "Simulated reservation"}
      </span>
      <p className="text-small text-muted-foreground">
        {expired
          ? "The simulation lifetime has elapsed. This record is retained in your history."
          : "This local simulation expires at the saved deadline. No lesson is confirmed."}
      </p>
    </div>
  );
}
