"use client";
import { useEffect, useRef } from "react";
import type { BookingDetail } from "./read-model";
import { demoStateLabels } from "./lifecycle-model";
export function LifecycleHeading({ booking }: { booking: BookingDetail }) {
  const changed =
    booking.state === "demo_cancelled" ||
    booking.state === "demo_replaced" ||
    booking.state === "demo_completed" ||
    (booking.revision ?? 0) > 0;
  const label =
    booking.state === "demo_reserved" && (booking.revision ?? 0) > 0
      ? "Simulation rescheduled"
      : changed
        ? demoStateLabels[booking.state]
        : "Booking details";
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (changed) heading.current?.focus();
  }, [changed]);
  return (
    <h1
      ref={heading}
      tabIndex={changed ? -1 : undefined}
      className="text-page-title"
    >
      {label}
    </h1>
  );
}
