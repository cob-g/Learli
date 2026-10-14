"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { BookingDetail, BookingReadScope } from "./read-model";
import { bookingDetailPath } from "./read-model";
import { demoLiveState } from "./lifecycle-model";
import { LessonTime } from "./lesson-time";
import type { LessonTimeValue } from "./lesson-time";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function DemoCancelControl({
  booking,
  scope,
}: {
  booking: BookingDetail;
  scope: BookingReadScope;
}) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [notice, setNotice] = useState("");
  const requestId = useRef<string | undefined>(undefined),
    alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice) alert.current?.focus();
  }, [notice]);
  if (
    booking.source !== "local_simulation" ||
    scope === "tutor" ||
    !demoLiveState(booking.state) ||
    (booking.currentHeadId ?? booking.id) !== booking.id
  )
    return null;
  async function cancel() {
    setBusy(true);
    setNotice("");
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: requestId.current,
          expectedRevision: booking.revision ?? 0,
        }),
      });
      if (!response.ok) {
        const body: { message?: string } | null = await response
          .json()
          .catch(() => null);
        setNotice(
          body?.message ??
            "This simulation could not be changed. Reload booking details.",
        );
        return;
      }
      window.location.assign(bookingDetailPath(booking.id, scope));
    } catch {
      setUncertain(true);
      setNotice(
        "The result is uncertain. Reload booking details before trying another change.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="text-section-title">Change this simulation</h2>
      <p className="mt-2 max-w-prose text-body">
        Local testing only. Cancelling releases this temporary reservation and
        preserves its saved history.
      </p>
      <a
        className="mt-4 inline-flex min-h-11 items-center text-action"
        href={`/bookings/${booking.id}/reschedule?scope=${scope}`}
      >
        Reschedule simulation
      </a>
      <details className="mt-4">
        <summary className="min-h-11 cursor-pointer py-2 text-action">
          Cancel simulation
        </summary>
        <p className="mt-2 max-w-prose text-body">
          Cancel this simulated reservation for {booking.learner.displayName}?
        </p>
        <LessonTime value={booking.time} />
        {notice && (
          <p
            id="lifecycle-time-error"
            ref={alert}
            tabIndex={-1}
            role="alert"
            className="mt-4 text-body"
          >
            {notice}{" "}
            <a href={bookingDetailPath(booking.id, scope)}>
              Reload booking details
            </a>
          </p>
        )}
        <button
          type="button"
          className="action action-outline mt-4"
          disabled={!ready || busy || uncertain}
          aria-busy={busy}
          onClick={cancel}
        >
          {busy ? "Cancelling simulation…" : "Confirm simulated cancellation"}
        </button>
        {!ready && (
          <p className="mt-2 text-small">
            Enable JavaScript to change this local simulation.
          </p>
        )}
      </details>
    </section>
  );
}
export function DemoRescheduleForm({
  booking,
  scope,
  times,
}: {
  booking: BookingDetail;
  scope: BookingReadScope;
  times: LessonTimeValue[];
}) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [notice, setNotice] = useState("");
  const alert = useRef<HTMLParagraphElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [invalidTime, setInvalidTime] = useState(false);
  const request = useRef<{ id: string; start: string } | undefined>(undefined);
  useEffect(() => {
    if (notice) {
      if (invalidTime)
        form.current?.querySelector<HTMLInputElement>("input")?.focus();
      else alert.current?.focus();
    }
  }, [notice, invalidTime]);
  async function move(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setInvalidTime(false);
    const selected = String(
      new FormData(event.currentTarget).get("time") ?? "",
    );
    const time = times.find((t) => t.startAtUtc === selected);
    if (!time) {
      setInvalidTime(true);
      setNotice("Choose a time to reschedule this simulation.");
      event.currentTarget.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    if (request.current?.start !== selected)
      request.current = { id: crypto.randomUUID(), start: selected };
    setBusy(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/reschedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: request.current.id,
          expectedRevision: booking.revision ?? 0,
          startAtUtc: time.startAtUtc,
          endAtUtc: time.endAtUtc,
          displayTimezone: booking.viewerTimezone,
        }),
      });
      const body: { message?: string; id?: string } | null = await response
        .json()
        .catch(() => null);
      if (!response.ok || typeof body?.id !== "string") {
        setNotice(
          (!response.ok ? body?.message : undefined) ??
            "This simulation could not be moved. Reload current times.",
        );
        return;
      }
      window.location.assign(bookingDetailPath(body.id, scope));
    } catch {
      setUncertain(true);
      setNotice(
        "The result is uncertain. Check booking details before trying another change.",
      );
    } finally {
      setBusy(false);
    }
  }
  const groups = Map.groupBy(times, (time) => `${time.date}\u0000${time.zone}`);
  return (
    <form method="post" onSubmit={move} className="mt-8 max-w-5xl">
      <h2 className="text-section-title">Choose a time</h2>
      <p className="mt-2 max-w-prose text-body">
        Moving keeps the original simulation expiry. The original test meeting
        link is not carried to the replacement.
      </p>
      {notice && (
        <p
          id="lifecycle-time-error"
          ref={alert}
          tabIndex={-1}
          role="alert"
          className="mt-4 text-body"
        >
          {notice}{" "}
          <a href={`/bookings/${booking.id}/reschedule?scope=${scope}`}>
            Reload current times
          </a>
        </p>
      )}
      {!times.length ? (
        <p className="mt-4 text-body">
          No alternative times are available for this simulation.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {[...groups].slice(0, 3).map(([key, group]) => (
            <fieldset key={key}>
              <legend className="text-item-title">{group[0].date}</legend>
              <p className="mt-2 text-small">Times shown in {group[0].zone}.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.map((time) => (
                  <label
                    key={time.startAtUtc}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-control px-3 py-2 text-body"
                  >
                    <input
                      type="radio"
                      aria-describedby={
                        invalidTime ? "lifecycle-time-error" : undefined
                      }
                      name="time"
                      value={time.startAtUtc}
                      disabled={!ready || busy || uncertain}
                    />
                    <span>{time.time}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {groups.size > 3 && (
            <details>
              <summary className="min-h-11 cursor-pointer py-2 text-action">
                Show later days
              </summary>
              <div className="mt-4 space-y-6">
                {[...groups].slice(3).map(([key, group]) => (
                  <fieldset key={key}>
                    <legend className="text-item-title">{group[0].date}</legend>
                    <p className="mt-2 text-small">
                      Times shown in {group[0].zone}.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.map((time) => (
                        <label
                          key={time.startAtUtc}
                          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-control px-3 py-2 text-body"
                        >
                          <input
                            type="radio"
                            aria-describedby={
                              invalidTime ? "lifecycle-time-error" : undefined
                            }
                            name="time"
                            value={time.startAtUtc}
                            disabled={!ready || busy || uncertain}
                          />
                          <span>{time.time}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      <button
        className="action action-primary mt-6 transition-none"
        disabled={!ready || busy || uncertain || !times.length}
        aria-busy={busy}
      >
        {busy ? "Moving simulation…" : "Move simulated reservation"}
      </button>
      {!ready && (
        <p className="mt-2 text-small">
          Enable JavaScript to change this local simulation. Saved details
          remain available.
        </p>
      )}
      <a
        className="ml-6 inline-flex min-h-11 items-center"
        href={bookingDetailPath(booking.id, scope)}
      >
        Return to booking details
      </a>
    </form>
  );
}
