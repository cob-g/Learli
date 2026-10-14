"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CircleAlert, Info, LoaderCircle, Check, TimerOff } from "lucide-react";
import type { TimeZoneOption } from "@/lib/time/zones";
import { levelNames } from "@/features/subjects/catalog";
import type {
  DemoBookingOptions,
  DemoCandidates,
  DemoReservation,
} from "./service";
import type { DemoBookingInput } from "./input";
import { LessonTime } from "./lesson-time";
import { demoStateLabels } from "./lifecycle-model";
import { demoBookingPolicy } from "./demo-policy";
import type { PublicBookingSelection } from "./selection";
import { bookingSelectionHref } from "./selection";
import { bookingDetailPath } from "./read-model";
import { BookingReadLink } from "./read-controls";
import type { LessonTimeValue } from "./lesson-time";

// App 5xx messages that are thrown before any reservation transaction starts
// (no runtime, no actor, no policy). The generic "This service is unavailable.
// Try again later." 503 is deliberately absent: it also covers a failure while
// committing, which may have saved the reservation.
const notCommittedMessages = new Set([
  "This service is unavailable.",
  "Account service is unavailable. Try again later.",
  "Booking policy is unavailable. Contact support.",
  "Booking workflows unavailable.",
]);
const unknownMessage =
  "The request result is unknown. Retry the same request to recover its saved result.";

export function DemoBookingForm({
  options,
  zones,
  prefill = null,
  prefilledTimes = null,
  requestedTime = null,
  initialNotice = "",
}: {
  options: DemoBookingOptions;
  zones: TimeZoneOption[];
  prefill?: PublicBookingSelection | null;
  prefilledTimes?: DemoCandidates["times"] | null;
  requestedTime?: LessonTimeValue | null;
  initialNotice?: string;
}) {
  const [learnerId, setLearner] = useState(
    options.learners.length === 1 ? options.learners[0].id : "",
  );
  const [tutorSlug, setTutor] = useState(prefill?.tutorSlug ?? "");
  const [subjectSlug, setSubject] = useState(prefill?.subjectSlug ?? "");
  const [timezone, setTimezone] = useState(
    prefill?.displayTimezone ?? options.timezone,
  );
  const [times, setTimes] = useState<DemoCandidates["times"] | null>(
    prefilledTimes,
  );
  const [selected, setSelected] = useState(
    prefilledTimes?.find(
      (time) =>
        time.startAtUtc === requestedTime?.startAtUtc &&
        time.endAtUtc === requestedTime?.endAtUtc,
    )?.startAtUtc ?? "",
  );
  const [pending, setPending] = useState<"times" | "booking" | null>(null);
  const [notice, setNotice] = useState(initialNotice);
  const [unknown, setUnknown] = useState(false);
  const [result, setResult] = useState<DemoReservation | null>(null);
  const attempt = useRef<DemoBookingInput | null>(null);
  const choiceVersion = useRef(0);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);
  const learner = options.learners.find((row) => row.id === learnerId);
  const tutor = options.tutors.find((row) => row.slug === tutorSlug);
  const offerings =
    tutor?.offerings.filter(
      (row) => !learner || row.levels.includes(learner.level),
    ) ?? [];

  function resetChoices() {
    choiceVersion.current++;
    setTimes(null);
    setSelected("");
    setNotice("");
    setResult(null);
  }
  function focusNotice() {
    requestAnimationFrame(() => alertRef.current?.focus());
  }
  async function loadTimes() {
    if (pending) return;
    const version = choiceVersion.current;
    setPending("times");
    setNotice("");
    setSelected("");
    try {
      const query = new URLSearchParams({
        learnerId,
        tutorSlug,
        subjectSlug,
        displayTimezone: timezone,
      });
      const response = await fetch(`/api/bookings/demo/candidates?${query}`);
      const data = await response.json();
      if (version !== choiceVersion.current) return;
      if (!response.ok) {
        setNotice(data.message);
        setTimes(null);
        focusNotice();
      } else {
        const current = data as DemoCandidates;
        setTimes(current.times);
        if (
          prefill &&
          requestedTime &&
          tutorSlug === prefill.tutorSlug &&
          subjectSlug === prefill.subjectSlug
        ) {
          const saved = current.times.find(
            (time) =>
              time.startAtUtc === requestedTime.startAtUtc &&
              time.endAtUtc === requestedTime.endAtUtc,
          );
          if (saved) setSelected(saved.startAtUtc);
          else {
            setNotice(
              "That time is no longer available. Please choose another.",
            );
            focusNotice();
          }
        }
      }
    } catch {
      if (version !== choiceVersion.current) return;
      setTimes(null);
      setNotice(
        "Open times could not be loaded. Check your connection and try again.",
      );
      focusNotice();
    } finally {
      setPending(null);
    }
  }
  async function reserve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const time = times?.find((row) => row.startAtUtc === selected);
    if (!unknown && (!learner || !tutor || !subjectSlug || !time)) {
      setNotice(
        "Choose who this lesson is for, a tutor, subject and time to continue.",
      );
      focusNotice();
      return;
    }
    if (!unknown && time)
      attempt.current = {
        learnerId,
        tutorSlug,
        subjectSlug,
        displayTimezone: timezone,
        startAtUtc: time.startAtUtc,
        endAtUtc: time.endAtUtc,
        idempotencyKey: crypto.randomUUID(),
      };
    if (!attempt.current) return;
    setPending("booking");
    setNotice("");
    try {
      const response = await fetch("/api/bookings/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attempt.current),
      });
      const data = await response.json().catch(() => null);
      const message: string | null =
        typeof data?.message === "string" ? data.message : null;
      // Only a proven rejection may unlock the form. Anything that could follow
      // a commit, or that did not come from the app, keeps the same request id.
      const definite = response.ok
        ? !!data && !message
        : response.status < 500
          ? ![408, 499].includes(response.status)
          : !!message && notCommittedMessages.has(message);
      if (!definite) {
        setUnknown(true);
        setNotice(unknownMessage);
        focusNotice();
      } else if (!response.ok) {
        setNotice(
          message ?? "The reservation could not be created. Try again.",
        );
        setUnknown(false);
        if (response.status === 409) {
          setSelected("");
          try {
            const query = new URLSearchParams({
              learnerId,
              tutorSlug,
              subjectSlug,
              displayTimezone: timezone,
            });
            const alternatives = await fetch(
              `/api/bookings/demo/candidates?${query}`,
            );
            if (alternatives.ok)
              setTimes(((await alternatives.json()) as DemoCandidates).times);
            else setTimes(null);
          } catch {
            setTimes(null);
          }
        }
        focusNotice();
      } else {
        setResult(data);
        setUnknown(false);
      }
    } catch {
      setUnknown(true);
      setNotice(unknownMessage);
      focusNotice();
    } finally {
      setPending(null);
    }
  }
  if (!options.learners.length)
    return (
      <section className="mt-8 max-w-prose">
        <h2 className="text-item-title">No authorized learner available</h2>
        <p className="mt-2 text-body">
          Create a fictional learner profile for this local demonstration. Real
          learner onboarding and guardian verification remain unavailable.
        </p>
        <div className="mt-4">
          <BookingReadLink
            href={
              prefill
                ? `/learners/new?next=${encodeURIComponent(bookingSelectionHref(prefill))}`
                : "/learners/new"
            }
            label="Create a local learner"
            pendingLabel="Opening learner creation…"
          />
        </div>
      </section>
    );
  if (!options.tutors.length)
    return (
      <section className="mt-8 max-w-prose">
        <h2 className="text-item-title">No eligible tutors available</h2>
        <p className="mt-2 text-body">
          There are no tutors taking simulated bookings right now.
        </p>
      </section>
    );
  return (
    <form
      className="mt-8 max-w-xl space-y-8"
      onSubmit={reserve}
      aria-busy={!!pending}
    >
      <fieldset
        className="space-y-4"
        disabled={unknown || pending === "booking" || !!result}
      >
        <legend className="mb-4 text-section-title">Who and what</legend>
        {requestedTime && !times && (
          <section className="space-y-2">
            <h2 className="text-item-title">Requested time</h2>
            <LessonTime value={requestedTime} />
            <p className="text-small">
              Choose an authorized learner and load open times to check this
              choice again.
            </p>
          </section>
        )}
        {options.learners.length === 1 ? (
          <p className="text-body">
            {learner?.management === "self"
              ? "Booking for you"
              : `Booking for ${learner?.displayName}`}{" "}
            · {levelNames([options.learners[0].level]).join()}
          </p>
        ) : (
          <fieldset className="space-y-2">
            <legend className="text-label">
              Choose who this lesson is for
            </legend>
            {options.learners.map((row) => (
              <label
                key={row.id}
                className="flex min-h-11 items-center gap-2 text-body"
              >
                <input
                  type="radio"
                  name="learner"
                  value={row.id}
                  checked={learnerId === row.id}
                  onChange={() => {
                    setLearner(row.id);
                    if (!prefill || row.level !== prefill.level) setSubject("");
                    resetChoices();
                  }}
                />
                {row.displayName} · {levelNames([row.level]).join()}
              </label>
            ))}
          </fieldset>
        )}
        <div className="space-y-2">
          <label htmlFor="booking-tutor" className="block text-label">
            Tutor
          </label>
          <select
            id="booking-tutor"
            className="field"
            value={tutorSlug}
            onChange={(event) => {
              setTutor(event.target.value);
              setSubject("");
              resetChoices();
            }}
          >
            <option value="">Choose a tutor</option>
            {options.tutors.map((row) => (
              <option value={row.slug} key={row.slug}>
                {row.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="booking-subject" className="block text-label">
            Subject
          </label>
          <select
            id="booking-subject"
            className="field"
            value={subjectSlug}
            onChange={(event) => {
              setSubject(event.target.value);
              resetChoices();
            }}
          >
            <option value="">Choose a subject</option>
            {offerings.map((row) => (
              <option value={row.subjectSlug} key={row.subjectSlug}>
                {row.subjectName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="booking-zone" className="block text-label">
            Time zone
          </label>
          <select
            id="booking-zone"
            className="field"
            value={timezone}
            onChange={(event) => {
              setTimezone(event.target.value);
              resetChoices();
            }}
          >
            {zones.map((row) => (
              <option key={row.value} value={row.value}>
                {row.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="action action-outline"
          aria-disabled={!!pending}
          disabled={!!pending}
          onClick={loadTimes}
        >
          {pending === "times" && (
            <LoaderCircle
              className="size-4 motion-safe:animate-spin"
              aria-hidden="true"
            />
          )}
          {pending === "times" ? "Loading open times…" : "Load open times"}
        </button>
      </fieldset>
      {times && !result && (
        <fieldset
          className="space-y-4"
          disabled={unknown || pending === "booking" || !!result}
        >
          <legend className="mb-4 text-section-title">Choose a time</legend>
          <p className="text-small">
            Simulated lessons last {demoBookingPolicy.durationMinutes} minutes.
            Each time shows your date and time zone.
          </p>
          {times.length ? (
            <ul className="divide-y divide-border border-s border-border ps-4">
              {(selected &&
              !times.slice(0, 8).some((time) => time.startAtUtc === selected)
                ? [
                    ...times.slice(0, 8),
                    ...times.filter((time) => time.startAtUtc === selected),
                  ]
                : times.slice(0, 8)
              ).map((time) => (
                <li className="py-4" key={time.startAtUtc}>
                  <label className="flex min-h-11 items-start gap-4 text-body">
                    <input
                      type="radio"
                      name="time"
                      className="mt-1"
                      value={time.startAtUtc}
                      checked={selected === time.startAtUtc}
                      onChange={() => {
                        setSelected(time.startAtUtc);
                        setNotice("");
                      }}
                    />
                    <span className="min-w-0">
                      <LessonTime value={time} />
                      {selected === time.startAtUtc && (
                        <span className="mt-2 flex items-center gap-2 text-small">
                          <Check className="size-4" aria-hidden="true" />
                          Selected time
                        </span>
                      )}
                      {selected === time.startAtUtc && (
                        <span className="mt-4 block text-small">
                          Tutor’s time
                          <LessonTime value={time.tutorTime} />
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body" role="status">
              No open times for these choices. Choose another tutor or subject.
            </p>
          )}
          {times.length > 8 && (
            <p className="text-small">
              Showing the first 8 open times in the next{" "}
              {demoBookingPolicy.horizonDays} days.
            </p>
          )}
        </fieldset>
      )}
      {notice && (
        <p
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="flex items-start gap-2 text-body text-error"
        >
          <CircleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}
      {unknown && (
        <div className="space-y-4">
          <p className="text-body">
            Your original choices are kept until the same request returns a
            result. You can also check whether the reservation was saved.
          </p>
          <BookingReadLink
            href={`/bookings?scope=${learner?.management === "guardian" ? "guardian" : "student"}`}
            label="Check my bookings"
            pendingLabel="Loading bookings…"
          />
        </div>
      )}
      {!result && (
        <button
          type="submit"
          className="action action-primary"
          aria-disabled={!!pending}
          disabled={!!pending}
        >
          {pending === "booking" && (
            <LoaderCircle
              className="size-4 motion-safe:animate-spin"
              aria-hidden="true"
            />
          )}
          {pending === "booking"
            ? "Creating simulated reservation…"
            : unknown
              ? "Retry same request"
              : "Create simulated reservation"}
        </button>
      )}
      {result && (
        <section className="space-y-4 border-t border-border pt-8">
          <h2
            ref={resultRef}
            tabIndex={-1}
            className="flex items-center gap-2 text-section-title"
          >
            {result.state === "demo_reserved" ? (
              <Info className="size-5" aria-hidden="true" />
            ) : (
              <TimerOff className="size-5" aria-hidden="true" />
            )}
            {result.state === "demo_reserved"
              ? "Simulated reservation saved"
              : result.state === "demo_expired"
                ? "Simulated reservation expired"
                : demoStateLabels[result.state]}
          </h2>
          <p className="text-body">
            {learner?.displayName} · {tutor?.displayName} ·{" "}
            {
              offerings.find((row) => row.subjectSlug === subjectSlug)
                ?.subjectName
            }
          </p>
          <LessonTime value={result.time} />
          <p className="text-body">
            {result.state === "demo_reserved"
              ? "Expires at"
              : result.state === "demo_expired"
                ? "Expired at"
                : "Original simulation deadline"}
          </p>
          <LessonTime value={result.expires} />
          <p className="text-body">
            This result is for local testing only. No lesson or payment has been
            confirmed.
          </p>
          <BookingReadLink
            href={bookingDetailPath(
              result.id,
              learner?.management === "guardian" ? "guardian" : "student",
            )}
            label="View booking details"
            pendingLabel="Loading booking details…"
          />
          <button
            className="action action-outline"
            type="button"
            onClick={() => {
              setResult(null);
              resetChoices();
              attempt.current = null;
            }}
          >
            Start another simulation
          </button>
        </section>
      )}
    </form>
  );
}
