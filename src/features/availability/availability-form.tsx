"use client";
import { useRef, useState, type FormEvent } from "react";
import { Check, CircleAlert, LoaderCircle, Plus, X } from "lucide-react";
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

type Row = WeeklyWindow & { key: number };
const times = Array.from({ length: 1440 }, (_, minute) => ({
  value: minute,
  label: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
}));
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
    initial.windows.map((window, key) => ({ ...window, key })),
  );
  const nextKey = useRef(rows.length);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [version, setVersion] = useState(initial.version);
  const [savedTimezone, setSavedTimezone] = useState(initial.timezone);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<AvailabilityErrors>({});
  const [notice, setNotice] = useState<{ text: string; failed: boolean }>();
  const formRef = useRef<HTMLFormElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  function changed() {
    setErrors({});
    setNotice(undefined);
  }
  function edit(key: number, update: Partial<WeeklyWindow>) {
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
    const input = {
      timezone,
      version,
      windows: rows.map(({ isoWeekday, startMinute, endMinute }) => ({
        isoWeekday,
        startMinute,
        endMinute,
      })),
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
  return (
    <form
      ref={formRef}
      className="max-w-3xl space-y-8 rounded-surface border border-border bg-surface p-6 sm:p-8"
      onSubmit={submit}
      aria-label="Weekly availability"
      aria-busy={pending}
      noValidate
    >
      <div className="space-y-4">
        <p className="text-body text-muted-foreground">
          {privateWorkflow
            ? "Set the hours you can teach each week. Eligible learners can request available times after your application is approved."
            : "Set the hours you can teach each week. Booking is not available yet."}
        </p>
        <div className="space-y-2">
          <label htmlFor="availability-zone" className="block text-label">
            Teaching time zone
          </label>
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
          <p id="zone-help" className="text-small text-muted-foreground">
            All hours below use this time zone. A time-zone change keeps the
            wall-clock hours and changes the actual instants they represent. It
            also updates your tutor profile. Saved time off keeps its actual
            instants.
          </p>
          <FieldError id="zone-error" message={errors.timezone} />
        </div>
        {timezone !== savedTimezone && (
          <p className="flex items-start gap-1 text-small">
            <CircleAlert size={16} aria-hidden="true" className="shrink-0" />
            Time zone changed. Review every day before saving.
          </p>
        )}
        <p className="text-small">
          Use 24-hour times. Select “Ends next day” for an overnight range.
          Ranges may be up to 24 hours long.
        </p>
        {rows.length === 0 && (
          <p className="text-body">
            No weekly hours set. Add a time range to a day you teach.
          </p>
        )}
      </div>
      {weekdays.map((day, dayIndex) => (
        <fieldset
          key={day}
          className="min-w-0 space-y-4 border-b border-border pb-6"
        >
          <legend className="mb-4 text-item-title text-primary">{day}</legend>
          {!rows.some((row) => row.isoWeekday === dayIndex + 1) && (
            <p className="text-small text-muted-foreground">
              No hours on {day}.
            </p>
          )}
          {rows.map(
            (row, index) =>
              row.isoWeekday === dayIndex + 1 && (
                <div key={row.key} className="space-y-3">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {(["startMinute", "endMinute"] as const).map((field) => {
                      const id = `range-${row.key}-${field}`;
                      const error = errors[`windows.${index}.${field}`];
                      return (
                        <div className="min-w-0 space-y-2" key={field}>
                          <label className="block text-label" htmlFor={id}>
                            {field === "startMinute"
                              ? "Start time"
                              : "End time"}
                          </label>
                          <select
                            id={id}
                            className="field"
                            disabled={pending}
                            data-field={`windows.${index}.${field}`}
                            value={row[field] % 1440}
                            aria-invalid={!!error}
                            aria-describedby={error ? `${id}-error` : undefined}
                            onChange={(event) =>
                              edit(row.key, {
                                [field]:
                                  Number(event.target.value) +
                                  (field === "endMinute" &&
                                  row.endMinute >= 1440
                                    ? 1440
                                    : 0),
                              })
                            }
                          >
                            {times.map((time) => (
                              <option key={time.value} value={time.value}>
                                {time.label}
                              </option>
                            ))}
                          </select>
                          <FieldError id={`${id}-error`} message={error} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex min-h-11 items-center gap-2 text-body">
                      <input
                        type="checkbox"
                        className="size-5"
                        disabled={pending}
                        checked={row.endMinute >= 1440}
                        onChange={(event) =>
                          edit(row.key, {
                            endMinute:
                              (row.endMinute % 1440) +
                              (event.target.checked ? 1440 : 0),
                          })
                        }
                      />
                      Ends next day
                    </label>
                    <button
                      type="button"
                      className="action action-outline"
                      disabled={pending}
                      aria-label={`Remove ${day} time range ${rows.filter((other) => other.isoWeekday === row.isoWeekday).findIndex((other) => other.key === row.key) + 1}`}
                      onClick={() => {
                        changed();
                        setRows((current) =>
                          current.filter((other) => other.key !== row.key),
                        );
                        requestAnimationFrame(() =>
                          document.getElementById(`add-${dayIndex}`)?.focus(),
                        );
                      }}
                    >
                      <X size={20} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ),
          )}
          <button
            id={`add-${dayIndex}`}
            type="button"
            className="action action-outline"
            disabled={pending || rows.length >= maxWeeklyWindows}
            onClick={() => {
              const key = nextKey.current++;
              changed();
              setRows((current) => [
                ...current,
                {
                  key,
                  isoWeekday: dayIndex + 1,
                  startMinute: 9 * 60,
                  endMinute: 10 * 60,
                },
              ]);
              requestAnimationFrame(() =>
                document.getElementById(`range-${key}-startMinute`)?.focus(),
              );
            }}
          >
            <Plus size={20} aria-hidden="true" />
            Add time range
          </button>
        </fieldset>
      ))}
      {rows.length >= maxWeeklyWindows && (
        <p className="text-small">
          You can save up to {maxWeeklyWindows} ranges. Remove a range before
          adding another.
        </p>
      )}
      <FieldError id="windows-error" message={errors.windows} />
      <div className="space-y-4">
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
        <button
          className="action action-primary"
          type="submit"
          aria-disabled={pending}
        >
          {pending && (
            <LoaderCircle
              size={20}
              aria-hidden="true"
              className="motion-safe:animate-spin motion-reduce:hidden"
            />
          )}
          {pending ? "Saving availability…" : "Save availability"}
        </button>
      </div>
    </form>
  );
}
