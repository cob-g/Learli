"use client";
import { useRef, useState, type FormEvent } from "react";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import type { OwnTimeOff } from "./service";
import {
  describeTimeOffIssues,
  maxTimeOffIntervals,
  timeOffInput,
  type TimeOffErrors,
} from "./input";
import { timeOffInstantLabel } from "./display";

export function TimeOffForm({
  initial,
  zoneLabel,
  privateWorkflow = false,
}: {
  initial: OwnTimeOff;
  zoneLabel: string;
  privateWorkflow?: boolean;
}) {
  const [exceptions, setExceptions] = useState(initial.exceptions);
  const [version, setVersion] = useState(initial.version);
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [pending, setPending] = useState<string>();
  const [errors, setErrors] = useState<TimeOffErrors>({});
  const [notice, setNotice] = useState<{ text: string; failed: boolean }>();
  const formRef = useRef<HTMLFormElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  function focusResult(fields: TimeOffErrors = {}) {
    requestAnimationFrame(() => {
      const field = Array.from(
        formRef.current?.querySelectorAll<HTMLElement>("[data-field]") ?? [],
      ).find((element) => fields[element.dataset.field ?? ""]);
      (field ?? noticeRef.current)?.focus();
    });
  }
  async function mutate(input: unknown, action: string) {
    // Buttons stay focusable while busy (aria-disabled), so say why a click
    // during another change does nothing instead of ignoring it silently.
    if (pending) {
      setNotice({
        text: "Wait for the current change to finish.",
        failed: false,
      });
      return;
    }
    const parsed = timeOffInput.safeParse(input);
    if (!parsed.success) {
      const issue = describeTimeOffIssues(parsed.error);
      setErrors(issue.fields);
      setNotice({ text: issue.message, failed: true });
      focusResult(issue.fields);
      return;
    }
    setPending(action);
    setErrors({});
    setNotice(undefined);
    let fields: TimeOffErrors = {};
    try {
      const response = await fetch("/api/tutor/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result: {
        version?: number;
        exceptions?: OwnTimeOff["exceptions"];
        message?: string;
        fields?: TimeOffErrors;
      } = await response.json().catch(() => ({}));
      if (
        response.ok &&
        typeof result.version === "number" &&
        Array.isArray(result.exceptions)
      ) {
        setVersion(result.version);
        setExceptions(result.exceptions);
        if (action === "add") {
          setStartLocal("");
          setEndLocal("");
        }
        setNotice({
          text: action === "add" ? "Time off added." : "Time off removed.",
          failed: false,
        });
      } else {
        fields = result.fields ?? {};
        setErrors(fields);
        setNotice({
          text: result.message ?? "Time off wasn't changed. Try again.",
          failed: true,
        });
      }
    } catch {
      setNotice({
        text: "We couldn't confirm the change. Reload saved time off before trying again; your entered times are still here.",
        failed: true,
      });
    } finally {
      setPending(undefined);
      focusResult(fields);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void mutate(
      {
        operation: "add",
        version,
        timezone: initial.timezone,
        startLocal,
        endLocal,
      },
      "add",
    );
  }
  return (
    <div className="max-w-xl space-y-8">
      <div className="space-y-2">
        <p className="text-body">
          {privateWorkflow
            ? "Mark when you cannot teach without changing your weekly hours. Time off cannot overlap an active booking request or confirmed booking."
            : "Mark when you cannot teach without changing your weekly hours. Time off cannot overlap an unexpired simulated reservation."}
        </p>
        <p className="text-small text-muted-foreground">
          Times use {zoneLabel}. Saved periods keep the same actual instants if
          you change your teaching time zone.
        </p>
      </div>
      <form
        ref={formRef}
        onSubmit={submit}
        aria-label="Add time off"
        aria-busy={!!pending}
        noValidate
        className="space-y-4"
      >
        <h2 className="text-section-title">Add time off</h2>
        <p id="time-off-help" className="text-small text-muted-foreground">
          Use an explicit end date for overnight or multi-day time off. Times
          skipped or repeated by a clock change cannot be used as endpoints.
        </p>
        {(["startLocal", "endLocal"] as const).map((field) => (
          <div className="space-y-2" key={field}>
            <label htmlFor={`time-off-${field}`} className="block text-label">
              {field === "startLocal"
                ? "Start date and time"
                : "End date and time"}
            </label>
            <input
              type="datetime-local"
              id={`time-off-${field}`}
              className="field min-w-0"
              data-field={field}
              value={field === "startLocal" ? startLocal : endLocal}
              disabled={!!pending}
              aria-invalid={!!errors[field]}
              aria-describedby={`time-off-help${errors[field] ? ` time-off-${field}-error` : ""}`}
              onChange={(event) => {
                setErrors({});
                setNotice(undefined);
                if (field === "startLocal") setStartLocal(event.target.value);
                else setEndLocal(event.target.value);
              }}
            />
            {errors[field] && (
              <p
                id={`time-off-${field}-error`}
                className="flex items-start gap-1 text-small text-error"
              >
                <CircleAlert
                  size={16}
                  aria-hidden="true"
                  className="shrink-0"
                />
                {errors[field]}
              </p>
            )}
          </div>
        ))}
        {notice && (
          <p
            ref={noticeRef}
            tabIndex={-1}
            role={notice.failed ? "alert" : "status"}
            className={`flex items-start gap-1 text-body ${notice.failed ? "text-error" : ""}`}
          >
            {notice.failed ? (
              <CircleAlert size={20} aria-hidden="true" className="shrink-0" />
            ) : (
              <Check size={20} aria-hidden="true" className="shrink-0" />
            )}
            {notice.text}
          </p>
        )}
        <div className="flex flex-wrap gap-4">
          <button
            type="submit"
            className="action action-primary"
            aria-disabled={!!pending}
          >
            {pending === "add" && (
              <LoaderCircle
                size={20}
                aria-hidden="true"
                className="motion-safe:animate-spin motion-reduce:hidden"
              />
            )}
            {pending === "add" ? "Adding time off…" : "Add time off"}
          </button>
          {notice?.failed && (
            <button
              type="button"
              className="action action-outline"
              onClick={() => window.location.reload()}
            >
              Reload saved time off
            </button>
          )}
        </div>
      </form>
      <section
        aria-labelledby="saved-time-off"
        className="space-y-4"
        aria-busy={!!pending}
      >
        <h2 id="saved-time-off" className="text-section-title">
          Saved time off
        </h2>
        {exceptions.length === 0 ? (
          <p className="text-body">
            No time off saved. Your weekly hours stay in place.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {exceptions.map((period) => (
              <li key={period.id} className="space-y-4 py-4">
                <div className="space-y-2">
                  <p className="text-time">
                    <span className="text-small">From </span>
                    <time dateTime={period.startAtUtc}>
                      {timeOffInstantLabel(period.startAtUtc, initial.timezone)}
                    </time>
                  </p>
                  <p className="text-time">
                    <span className="text-small">Until </span>
                    <time dateTime={period.endAtUtc}>
                      {timeOffInstantLabel(period.endAtUtc, initial.timezone)}
                    </time>
                  </p>
                </div>
                <button
                  type="button"
                  className="action action-outline"
                  aria-disabled={!!pending}
                  aria-label={`Remove time off starting ${timeOffInstantLabel(period.startAtUtc, initial.timezone)}`}
                  onClick={() => {
                    void mutate(
                      { operation: "remove", version, id: period.id },
                      period.id,
                    );
                  }}
                >
                  {pending === period.id
                    ? "Removing time off…"
                    : "Remove time off"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {exceptions.length >= maxTimeOffIntervals && (
          <p className="text-small">
            Remove a saved period before adding another. Up to{" "}
            {maxTimeOffIntervals} periods can be saved.
          </p>
        )}
      </section>
    </div>
  );
}
