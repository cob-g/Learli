"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Globe,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import type { TimeZoneOption } from "@/lib/time/zones";
import type { WeeklyWindow } from "@/lib/time/availability";
import type { OwnAvailability } from "./service";
import {
  availabilityInput,
  describeAvailabilityIssues,
  maxWeeklyWindows,
  weekdays,
  type AvailabilityErrors,
} from "./input";
import { formatTimeInputValue, parseTimeInputValue } from "./time-input";
import "./availability.css";

type Row = Pick<WeeklyWindow, "isoWeekday"> & {
  key: number;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
};
/** A valid range as minutes from the start of its weekday, or null. */
function rowSpan(row: Row) {
  const start = parseTimeInputValue(row.startTime);
  const end = parseTimeInputValue(row.endTime);
  if (start === null || end === null) return null;
  const finish = end + (row.endsNextDay ? 1440 : 0);
  return finish > start && finish - start <= 1440
    ? { start, end: finish }
    : null;
}
function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} m` : `${hours} h`;
}
function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="flex items-start gap-1 text-small text-error">
      <CircleAlert size={16} aria-hidden="true" className="shrink-0" />
      {message}
    </p>
  ) : null;
}
export function AvailabilityForm({
  initial,
  timeZones,
  privateWorkflow = false,
}: {
  initial: OwnAvailability;
  timeZones: TimeZoneOption[];
  privateWorkflow?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.windows.map((window, key) => ({
      key,
      isoWeekday: window.isoWeekday,
      startTime: formatTimeInputValue(window.startMinute),
      endTime: formatTimeInputValue(window.endMinute),
      endsNextDay: window.endMinute >= 1440,
    })),
  );
  const nextKey = useRef(rows.length);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [version, setVersion] = useState(initial.version);
  const [savedTimezone, setSavedTimezone] = useState(initial.timezone);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<AvailabilityErrors>({});
  const [notice, setNotice] = useState<{ text: string; failed: boolean }>();
  // Display only: edits since the last load or successful save.
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  function changed() {
    setErrors({});
    setNotice(undefined);
    setDirty(true);
  }
  function edit(key: number, update: Partial<Omit<Row, "key">>) {
    if (pending) return;
    changed();
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...update } : row)),
    );
  }
  function focusError(fields: AvailabilityErrors) {
    requestAnimationFrame(() => {
      const control = Array.from(
        formRef.current?.querySelectorAll<HTMLElement>("[data-field]") ?? [],
      ).find((element) => fields[element.dataset.field ?? ""]);
      (control ?? noticeRef.current)?.focus();
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields: AvailabilityErrors = {};
    const windows = rows.map((row, index) => {
      const startMinute = parseTimeInputValue(row.startTime);
      const endMinute = parseTimeInputValue(row.endTime);
      if (startMinute === null)
        fields[`windows.${index}.startMinute`] = "Enter a valid start time.";
      if (endMinute === null)
        fields[`windows.${index}.endMinute`] = "Enter a valid end time.";
      return {
        isoWeekday: row.isoWeekday,
        startMinute: startMinute ?? Number.NaN,
        endMinute: (endMinute ?? Number.NaN) + (row.endsNextDay ? 1440 : 0),
      };
    });
    if (Object.keys(fields).length > 0) {
      setErrors(fields);
      setNotice({
        text: "Check the marked time fields before saving.",
        failed: true,
      });
      focusError(fields);
      return;
    }
    const input = {
      timezone,
      version,
      windows,
    };
    const parsed = availabilityInput.safeParse(input);
    if (!parsed.success) {
      const problem = describeAvailabilityIssues(parsed.error);
      setErrors(problem.fields);
      setNotice({ text: problem.message, failed: true });
      focusError(problem.fields);
      return;
    }
    setPending(true);
    setErrors({});
    setNotice(undefined);
    let invalid: AvailabilityErrors = {};
    try {
      const response = await fetch("/api/tutor/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result: {
        version?: number;
        message?: string;
        fields?: AvailabilityErrors;
      } = await response.json().catch(() => ({}));
      if (response.ok && typeof result.version === "number") {
        setVersion(result.version);
        setSavedTimezone(timezone);
        setNotice({ text: "Availability saved.", failed: false });
        setDirty(false);
      } else {
        invalid = result.fields ?? {};
        setErrors(invalid);
        setNotice({
          text: result.message ?? "Your availability wasn't saved. Try again.",
          failed: true,
        });
      }
    } catch {
      setNotice({
        text: "We couldn't reach Learli. Check your connection, then try again. Your changes are still here.",
        failed: true,
      });
    } finally {
      setPending(false);
      focusError(invalid);
    }
  }
  const spans = rows.map((row) => ({ row, span: rowSpan(row) }));
  const dayMinutes = weekdays.map((_, dayIndex) =>
    spans
      .filter(({ row, span }) => span && row.isoWeekday === dayIndex + 1)
      .reduce((sum, { span }) => sum + (span ? span.end - span.start : 0), 0),
  );
  const weekMinutes = dayMinutes.reduce((sum, minutes) => sum + minutes, 0);
  // Overnight ranges continue on the next weekday in the week view.
  const bars = weekdays.map(
    () => [] as { start: number; end: number; carried: boolean }[],
  );
  for (const { row, span } of spans) {
    if (!span) continue;
    const day = row.isoWeekday - 1;
    bars[day].push({
      start: span.start,
      end: Math.min(span.end, 1440),
      carried: false,
    });
    if (span.end > 1440)
      bars[(day + 1) % 7].push({
        start: 0,
        end: span.end - 1440,
        carried: true,
      });
  }
  const zoneLabel =
    timeZones.find((zone) => zone.value === timezone)?.label ?? timezone;
  return (
    <form
      ref={formRef}
      className="availability-layout"
      onSubmit={submit}
      aria-label="Weekly availability"
      aria-busy={pending}
      noValidate
    >
      <div className="availability-stack">
        <section className="availability-card availability-zone-card">
          <div>
            <p className="availability-intro">
              {privateWorkflow
                ? "Set the hours you can teach each week. Eligible learners can request available times after your application is approved."
                : "Set the hours you can teach each week. Booking is not available yet."}
            </p>
            <p className="availability-rule">
              Choose local start and end times. Your device may display them in
              12- or 24-hour format. Select “Ends next day” for an overnight
              range. Ranges may be up to 24 hours long.
            </p>
          </div>
          <div className="availability-field">
            <label htmlFor="availability-zone" className="text-label">
              Teaching time zone
            </label>
            <span className="availability-select">
              <Globe size={18} aria-hidden="true" />
              <select
                id="availability-zone"
                className="field"
                value={timezone}
                data-field="timezone"
                disabled={pending}
                aria-invalid={!!errors.timezone}
                aria-describedby="zone-help zone-error"
                onChange={(event) => {
                  changed();
                  setTimezone(event.target.value);
                }}
              >
                {!timeZones.some((zone) => zone.value === timezone) && (
                  <option value="">Choose a regional time zone</option>
                )}
                {timeZones.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </span>
            <p id="zone-help" className="availability-help">
              All hours below use this time zone. A time-zone change keeps the
              wall-clock hours and changes the actual instants they represent.
              It also updates your tutor profile. Saved time off keeps its
              actual instants.
            </p>
            <FieldError id="zone-error" message={errors.timezone} />
            {timezone !== savedTimezone && (
              <p className="availability-zone-changed">
                <CircleAlert
                  size={16}
                  aria-hidden="true"
                  className="shrink-0"
                />
                Time zone changed. Review every day before saving.
              </p>
            )}
          </div>
        </section>
        <section
          className="availability-card availability-days"
          aria-labelledby="availability-days-title"
        >
          <div className="availability-days-heading">
            <h2 id="availability-days-title">Teaching hours</h2>
            <p>{zoneLabel}</p>
          </div>
          {rows.length === 0 && (
            <p className="availability-none">
              No weekly hours set. Add a time range to a day you teach.
            </p>
          )}
          {weekdays.map((day, dayIndex) => {
            const dayRows = rows.filter(
              (row) => row.isoWeekday === dayIndex + 1,
            );
            return (
              <fieldset
                key={day}
                className="availability-day"
                data-off={dayRows.length === 0 || undefined}
              >
                <legend className="sr-only">{day}</legend>
                <div className="availability-day-name" aria-hidden="true">
                  <b>{day}</b>
                  <small>
                    {dayRows.length
                      ? formatDuration(dayMinutes[dayIndex])
                      : "Not available"}
                  </small>
                </div>
                <div className="availability-ranges">
                  {dayRows.length === 0 && (
                    <p className="availability-off">No hours on {day}.</p>
                  )}
                  {rows.map(
                    (row, index) =>
                      row.isoWeekday === dayIndex + 1 && (
                        <div key={row.key} className="availability-range">
                          <div className="availability-times">
                            {(["startTime", "endTime"] as const).map(
                              (field) => {
                                const minuteField =
                                  field === "startTime"
                                    ? "startMinute"
                                    : "endMinute";
                                const id = `range-${row.key}-${minuteField}`;
                                const dataField = `windows.${index}.${minuteField}`;
                                const error = errors[dataField];
                                return (
                                  <div className="min-w-0" key={field}>
                                    <label className="sr-only" htmlFor={id}>
                                      {field === "startTime"
                                        ? "Start time"
                                        : "End time"}
                                    </label>
                                    <input
                                      id={id}
                                      type="time"
                                      step={60}
                                      required
                                      className="field"
                                      disabled={pending}
                                      data-field={dataField}
                                      value={row[field]}
                                      aria-invalid={!!error}
                                      aria-describedby={
                                        error ? `${id}-error` : undefined
                                      }
                                      onChange={(event) =>
                                        edit(row.key, {
                                          [field]: event.target.value,
                                        })
                                      }
                                    />
                                    <FieldError
                                      id={`${id}-error`}
                                      message={error}
                                    />
                                  </div>
                                );
                              },
                            )}
                            <span
                              className="availability-to"
                              aria-hidden="true"
                            >
                              to
                            </span>
                          </div>
                          <div className="availability-range-actions">
                            <label className="availability-next-day">
                              <input
                                type="checkbox"
                                disabled={pending}
                                checked={row.endsNextDay}
                                onChange={(event) =>
                                  edit(row.key, {
                                    endsNextDay: event.target.checked,
                                  })
                                }
                              />
                              <span aria-hidden="true">
                                <Check size={10} />
                              </span>
                              Ends next day
                            </label>
                            <button
                              type="button"
                              className="availability-remove"
                              disabled={pending}
                              aria-label={`Remove ${day} time range ${dayRows.findIndex((other) => other.key === row.key) + 1}`}
                              onClick={() => {
                                changed();
                                setRows((current) =>
                                  current.filter(
                                    (other) => other.key !== row.key,
                                  ),
                                );
                                requestAnimationFrame(() =>
                                  document
                                    .getElementById(`add-${dayIndex}`)
                                    ?.focus(),
                                );
                              }}
                            >
                              <X size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ),
                  )}
                  <button
                    id={`add-${dayIndex}`}
                    type="button"
                    className="availability-add"
                    disabled={pending || rows.length >= maxWeeklyWindows}
                    onClick={() => {
                      const key = nextKey.current++;
                      changed();
                      setRows((current) => [
                        ...current,
                        {
                          key,
                          isoWeekday: dayIndex + 1,
                          startTime: "09:00",
                          endTime: "10:00",
                          endsNextDay: false,
                        },
                      ]);
                      requestAnimationFrame(() =>
                        document
                          .getElementById(`range-${key}-startMinute`)
                          ?.focus(),
                      );
                    }}
                  >
                    <span aria-hidden="true">
                      <Plus size={12} />
                    </span>
                    Add time range
                  </button>
                </div>
              </fieldset>
            );
          })}
          {rows.length >= maxWeeklyWindows && (
            <p className="availability-limit">
              You can save up to {maxWeeklyWindows} ranges. Remove a range
              before adding another.
            </p>
          )}
          <FieldError id="windows-error" message={errors.windows} />
        </section>
        <div className="workspace-savebar">
          <div className="workspace-save-state">
            {notice ? (
              <p
                ref={noticeRef}
                tabIndex={-1}
                role={notice.failed ? "alert" : "status"}
                data-state={notice.failed ? "error" : "saved"}
              >
                {notice.failed ? (
                  <CircleAlert
                    size={18}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                ) : (
                  <Check size={18} aria-hidden="true" className="shrink-0" />
                )}
                {notice.text}
              </p>
            ) : (
              <p data-state={dirty ? "dirty" : undefined}>
                <i aria-hidden="true" />
                {dirty ? "Unsaved changes" : "No unsaved changes"}
              </p>
            )}
          </div>
          <button
            className="action workspace-action"
            type="submit"
            aria-disabled={pending}
          >
            {pending ? "Saving availability…" : "Save availability"}
            <span className="workspace-action-icon" aria-hidden="true">
              {pending ? (
                <LoaderCircle size={13} className="motion-safe:animate-spin" />
              ) : (
                <ArrowRight size={13} />
              )}
            </span>
          </button>
        </div>
      </div>
      <section
        className="availability-card availability-glance"
        aria-label="Week at a glance"
      >
        <div className="availability-glance-head" data-surface="inverse">
          <p>Week at a glance</p>
          <p className="availability-total">
            {weekMinutes % 60 === 0
              ? weekMinutes / 60
              : formatDuration(weekMinutes)}
            <span>{weekMinutes % 60 === 0 ? " hours a week" : " a week"}</span>
          </p>
          <p className="availability-glance-zone">{zoneLabel}</p>
        </div>
        <div className="availability-week" aria-hidden="true">
          {weekdays.map((day, dayIndex) => (
            <div key={day} className="availability-week-row">
              <b>{day.slice(0, 3)}</b>
              <span className="availability-track">
                {bars[dayIndex].map((bar, index) => (
                  <i
                    key={index}
                    data-carried={bar.carried || undefined}
                    style={{
                      left: `${(bar.start / 1440) * 100}%`,
                      width: `${((bar.end - bar.start) / 1440) * 100}%`,
                    }}
                  />
                ))}
              </span>
            </div>
          ))}
          <div className="availability-ticks">
            <span />
            <div>
              <span>12 AM</span>
              <span>6 AM</span>
              <span>12 PM</span>
              <span>6 PM</span>
              <span>12 AM</span>
            </div>
          </div>
        </div>
        <div className="availability-key" aria-hidden="true">
          <span>
            <i />
            Available
          </span>
          <span>
            <i data-carried />
            Continues from the previous day
          </span>
        </div>
      </section>
    </form>
  );
}
