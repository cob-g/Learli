"use client";
import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
} from "lucide-react";
import type { OwnTimeOff } from "./service";
import {
  describeTimeOffIssues,
  maxTimeOffIntervals,
  timeOffInput,
  type TimeOffErrors,
} from "./input";
import { timeOffInstantLabel } from "./display";
import { resolveLocalTime } from "./local-time";
import {
  dateTile,
  coverageWithin,
  formatSpan,
  localDateOf,
  localDayBounds,
  monthGrid,
  monthTitle,
  shiftMonth,
  shortInstantLabel,
} from "./calendar";
import "./time-off.css";

/** A complete, ordered draft as instants, or null; validation stays on submit. */
function draftPeriod(startLocal: string, endLocal: string, timeZone: string) {
  if (!startLocal || !endLocal) return null;
  try {
    const start = resolveLocalTime(startLocal, timeZone).getTime();
    const end = resolveLocalTime(endLocal, timeZone).getTime();
    return end > start ? { start, end } : null;
  } catch {
    return null;
  }
}
export function TimeOffForm({
  initial,
  zoneLabel,
  privateWorkflow = false,
  showIntro = true,
  today,
}: {
  initial: OwnTimeOff;
  zoneLabel: string;
  privateWorkflow?: boolean;
  /** False when the page header already explains time off. */
  showIntro?: boolean;
  /** The tutor's local date from the server, so the calendar renders the same. */
  today?: string;
}) {
  const [exceptions, setExceptions] = useState(initial.exceptions);
  const [version, setVersion] = useState(initial.version);
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [pending, setPending] = useState<string>();
  const [errors, setErrors] = useState<TimeOffErrors>({});
  const [notice, setNotice] = useState<{ text: string; failed: boolean }>();
  const formRef = useRef<HTMLFormElement>(null);
  const zone = initial.timezone;
  const [todayDate] = useState(() => today ?? localDateOf(Date.now(), zone));
  const [month, setMonth] = useState(todayDate.slice(0, 7));
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
  const draft = draftPeriod(startLocal, endLocal, zone);
  // Day bounds need time-zone lookups, so they are worked out once per month;
  // coverage and the draft overlay are then plain comparisons on each keystroke.
  const monthDays = useMemo(
    () =>
      monthGrid(month).map((cell) => ({
        ...cell,
        bounds: localDayBounds(cell.date, zone),
      })),
    [month, zone],
  );
  const savedDays = useMemo(() => {
    const saved = exceptions.map((period) => ({
      start: Date.parse(period.startAtUtc),
      end: Date.parse(period.endAtUtc),
    }));
    return monthDays.map((day) => ({
      ...day,
      coverage: coverageWithin(day.bounds, saved),
    }));
  }, [monthDays, exceptions]);
  const days = savedDays.map((day) => ({
    ...day,
    drafting: !day.coverage && !!draft && !!coverageWithin(day.bounds, [draft]),
  }));
  const inMonth = days.filter((day) => !day.outside);
  const fullDays = inMonth.filter((day) => day.coverage === "full").length;
  const partDays = inMonth.filter((day) => day.coverage === "part").length;
  return (
    <div className="time-off-layout">
      <div className="time-off-stack">
        {showIntro && (
          <div className="space-y-2">
            <p className="text-body">
              {privateWorkflow
                ? "Mark when you cannot teach without changing your weekly hours. Time off cannot overlap an active booking request or confirmed booking."
                : "Mark when you cannot teach without changing your weekly hours. Time off cannot overlap an unexpired simulated reservation."}
            </p>
            <p className="text-small text-muted-foreground">
              Times use {zoneLabel}. Saved periods keep the same actual instants
              if you change your teaching time zone.
            </p>
          </div>
        )}
        <form
          ref={formRef}
          onSubmit={submit}
          aria-label="Add time off"
          aria-busy={!!pending}
          noValidate
          className="time-off-card time-off-add"
        >
          <div>
            <h2>Add time off</h2>
            <p id="time-off-help">
              Use an explicit end date for overnight or multi-day time off.
              Times skipped or repeated by a clock change cannot be used as
              endpoints.
            </p>
          </div>
          <div className="time-off-ends">
            {(["startLocal", "endLocal"] as const).map((field) => (
              <div className="time-off-field" key={field}>
                <label htmlFor={`time-off-${field}`} className="text-label">
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
                    if (field === "startLocal")
                      setStartLocal(event.target.value);
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
          </div>
          <div className="time-off-preview" data-ready={!!draft || undefined}>
            <span>{draft ? formatSpan(draft.end - draft.start) : "—"}</span>
            <p>
              {draft
                ? `${shortInstantLabel(draft.start, zone)} to ${shortInstantLabel(draft.end, zone)}`
                : startLocal && endLocal
                  ? "The preview appears once the end is after the start."
                  : "Choose a start and an end to preview this period."}
            </p>
          </div>
          {notice && (
            <p
              ref={noticeRef}
              tabIndex={-1}
              role={notice.failed ? "alert" : "status"}
              className={`time-off-notice ${notice.failed ? "text-error" : ""}`}
            >
              {notice.failed ? (
                <CircleAlert
                  size={20}
                  aria-hidden="true"
                  className="shrink-0"
                />
              ) : (
                <Check size={20} aria-hidden="true" className="shrink-0" />
              )}
              {notice.text}
            </p>
          )}
          <div className="time-off-actions">
            <button
              type="submit"
              className="action workspace-action"
              aria-disabled={!!pending}
            >
              {pending === "add" ? "Adding time off…" : "Add time off"}
              <span className="workspace-action-icon" aria-hidden="true">
                {pending === "add" ? (
                  <LoaderCircle
                    size={13}
                    className="motion-safe:animate-spin"
                  />
                ) : (
                  <ArrowRight size={13} />
                )}
              </span>
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
          className="time-off-card time-off-saved"
          aria-busy={!!pending}
        >
          <div className="time-off-saved-heading">
            <h2 id="saved-time-off">Saved time off</h2>
            {exceptions.length > 0 && (
              <span className="workspace-count" aria-hidden="true">
                {exceptions.length}
              </span>
            )}
          </div>
          {exceptions.length === 0 ? (
            <div className="time-off-empty">
              <span aria-hidden="true">
                <CalendarDays size={22} />
              </span>
              <p>No time off saved. Your weekly hours stay in place.</p>
            </div>
          ) : (
            <ul className="time-off-list">
              {exceptions.map((period) => {
                const start = Date.parse(period.startAtUtc);
                const tile = dateTile(start, zone);
                return (
                  <li key={period.id}>
                    <span
                      className="time-off-tile"
                      data-surface="inverse"
                      aria-hidden="true"
                    >
                      <small>{tile.month}</small>
                      <b>{tile.day}</b>
                    </span>
                    <div className="min-w-0">
                      <p className="time-off-range">
                        <span className="sr-only">From </span>
                        <time dateTime={period.startAtUtc}>
                          {timeOffInstantLabel(period.startAtUtc, zone)}
                        </time>
                        <ArrowRight size={14} aria-hidden="true" />
                        <span className="sr-only"> until </span>
                        <time dateTime={period.endAtUtc}>
                          {timeOffInstantLabel(period.endAtUtc, zone)}
                        </time>
                      </p>
                      <p className="time-off-length">
                        <b>{formatSpan(Date.parse(period.endAtUtc) - start)}</b>{" "}
                        · {zoneLabel}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="action action-outline time-off-remove"
                      aria-disabled={!!pending}
                      aria-label={`Remove time off starting ${timeOffInstantLabel(period.startAtUtc, zone)}`}
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
                );
              })}
            </ul>
          )}
          {exceptions.length >= maxTimeOffIntervals && (
            <p className="time-off-limit">
              Remove a saved period before adding another. Up to{" "}
              {maxTimeOffIntervals} periods can be saved.
            </p>
          )}
        </section>
      </div>
      <section className="time-off-calendar" aria-labelledby="time-off-month">
        <div className="time-off-calendar-head" data-surface="inverse">
          <div>
            <p>Calendar</p>
            <h2 id="time-off-month">{monthTitle(month)}</h2>
          </div>
          <div className="time-off-calendar-nav">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth((current) => shiftMonth(current, -1))}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth((current) => shiftMonth(current, 1))}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <p className="sr-only">
          {fullDays || partDays
            ? `${fullDays} full ${fullDays === 1 ? "day" : "days"} and ${partDays} part ${partDays === 1 ? "day" : "days"} of saved time off this month.`
            : "No saved time off this month."}
        </p>
        <div className="time-off-grid" aria-hidden="true">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((weekday) => (
            <span key={weekday} className="time-off-weekday">
              {weekday}
            </span>
          ))}
          {days.map((day) => (
            <span
              key={day.date}
              className="time-off-day"
              data-outside={day.outside || undefined}
              data-coverage={day.coverage ?? undefined}
              data-drafting={day.drafting || undefined}
              data-today={day.date === todayDate || undefined}
            >
              {day.day}
            </span>
          ))}
        </div>
        <div className="time-off-key" aria-hidden="true">
          <span>
            <i data-coverage="full" />
            Full day off
          </span>
          <span>
            <i data-coverage="part" />
            Part of day
          </span>
          <span>
            <i data-drafting />
            Drafting
          </span>
          <span>
            <i data-today />
            Today
          </span>
        </div>
      </section>
    </div>
  );
}
