"use client";
import {
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import type { LessonTimeValue } from "@/features/bookings/lesson-time";
import { LessonTime } from "@/features/bookings/lesson-time";
import type { WorkflowAction } from "./input";
const subscribe = () => () => {},
  client = () => true,
  server = () => false;
function useMutation(
  endpoint: string,
  destination: (r: { id: string }) => string,
) {
  const ready = useSyncExternalStore(subscribe, client, server),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState(false),
    key = useRef<string | null>(null),
    alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message) alert.current?.focus();
  }, [message]);
  async function send(values: Record<string, unknown>, keyField = "requestId") {
    if (!ready || pending || uncertain) return;
    key.current ??= crypto.randomUUID();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, [keyField]: key.current }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(
          body.message ??
            "This booking could not be changed. Reload its details.",
        );
        return;
      }
      window.location.assign(destination(body));
    } catch {
      setUncertain(true);
      setMessage(
        "The result is uncertain. Check your bookings before trying again.",
      );
    } finally {
      setPending(false);
    }
  }
  return {
    ready,
    pending,
    uncertain,
    send,
    notice: (
      <>
        <p
          role="alert"
          tabIndex={-1}
          ref={alert}
          className="mt-4 max-w-prose text-body"
        >
          {message}
        </p>
        <noscript>
          <p className="mt-4 text-body">
            Enable JavaScript to change a synthetic booking. Navigation and
            saved history remain readable.
          </p>
        </noscript>
      </>
    ),
  };
}
export function WorkflowRequestForm({
  choice,
  times,
  scope,
  requestedTime,
}: {
  choice: {
    learnerId: string;
    tutorSlug: string;
    subjectSlug: string;
    displayTimezone: string;
  };
  times: LessonTimeValue[];
  requestedTime?: Pick<LessonTimeValue, "startAtUtc" | "endAtUtc">;
  scope: "guardian" | "student";
}) {
  const m = useMutation(
    "/api/bookings/demo",
    (r) => `/bookings/${r.id}?scope=${scope}`,
  );
  const selected = times.find(
    (t) =>
      t.startAtUtc === requestedTime?.startAtUtc &&
      t.endAtUtc === requestedTime.endAtUtc,
  );
  const orderedTimes = selected
    ? [selected, ...times.filter((t) => t !== selected)]
    : times;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = new FormData(e.currentTarget).get("slot"),
      time = times.find((t) => t.startAtUtc === value);
    if (!time) return;
    await m.send(
      { ...choice, startAtUtc: time.startAtUtc, endAtUtc: time.endAtUtc },
      "idempotencyKey",
    );
  }
  return (
    <form
      method="post"
      action="/api/bookings/demo"
      onSubmit={submit}
      className="mt-8 space-y-4"
    >
      <fieldset>
        <legend className="text-section-title">Choose a synthetic time</legend>
        <div className="mt-4 space-y-2">
          {orderedTimes.slice(0, 24).map((t) => (
            <label
              key={t.startAtUtc}
              className="flex min-h-11 items-center gap-4 rounded-control border border-control bg-surface p-4"
            >
              <input
                required
                name="slot"
                type="radio"
                value={t.startAtUtc}
                defaultChecked={t === selected}
              />
              <LessonTime value={t} />
            </label>
          ))}
        </div>
        <details className="mt-4">
          <summary className="min-h-11 cursor-pointer py-2 text-action">
            More synthetic times
          </summary>
          {orderedTimes.slice(24).map((t) => (
            <label
              key={t.startAtUtc}
              className="mt-2 flex min-h-11 items-center gap-4 rounded-control border border-control p-4"
            >
              <input name="slot" type="radio" value={t.startAtUtc} />
              <LessonTime value={t} />
            </label>
          ))}
        </details>
      </fieldset>
      <p className="max-w-prose text-body">
        Synthetic test terms: a ten-minute provisional hold requires an assigned
        prerequisite review. Confirmation is software evidence only. No
        commercial entitlement or attendance is established.
      </p>
      <button
        type="submit"
        className="action action-primary transition-none"
        disabled={!m.ready || m.pending || m.uncertain}
      >
        {m.pending
          ? "Requesting synthetic booking…"
          : "Request synthetic booking"}
      </button>
      {m.notice}
    </form>
  );
}
const reason: Record<WorkflowAction, string> = {
  confirm: "synthetic_prerequisite_review",
  complete: "synthetic_completed",
  no_show: "synthetic_no_show",
  cancel: "synthetic_participant_change",
  reschedule: "synthetic_participant_change",
};
const labels: Record<WorkflowAction, string> = {
  confirm: "Confirm synthetic prerequisites",
  complete: "Record administrative completion",
  no_show: "Record administrative no-show",
  cancel: "Cancel synthetic booking",
  reschedule: "Move synthetic booking",
};
export function WorkflowActionForm({
  bookingId,
  revision,
  action,
  scope = "student",
  admin = false,
  times = [],
}: {
  bookingId: string;
  revision: number;
  action: WorkflowAction;
  scope?: string;
  admin?: boolean;
  times?: LessonTimeValue[];
}) {
  const m = useMutation(`/api/bookings/${bookingId}/workflow/${action}`, (r) =>
    admin ? `/admin/bookings/${r.id}` : `/bookings/${r.id}?scope=${scope}`,
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const time = times.find(
      (t) => t.startAtUtc === new FormData(e.currentTarget).get("slot"),
    );
    await m.send({
      expectedRevision: revision,
      reasonCode: reason[action],
      ...(action === "reschedule" && time
        ? {
            startAtUtc: time.startAtUtc,
            endAtUtc: time.endAtUtc,
            displayTimezone: "UTC",
          }
        : {}),
    });
  }
  return (
    <form
      method="post"
      action={`/api/bookings/${bookingId}/workflow/${action}`}
      onSubmit={submit}
      className="mt-4"
    >
      {action === "reschedule" && (
        <fieldset>
          <legend className="text-label">Replacement time</legend>
          {times.slice(0, 48).map((t) => (
            <label
              key={t.startAtUtc}
              className="mt-2 flex min-h-11 items-center gap-4 rounded-control border border-control p-4"
            >
              <input required type="radio" name="slot" value={t.startAtUtc} />
              <LessonTime value={t} />
            </label>
          ))}
        </fieldset>
      )}
      <p className="my-4 max-w-prose text-small">
        {action === "complete" || action === "no_show"
          ? "This is an administrative synthetic outcome, never evidence of attendance. Disputed outcomes retain the support path."
          : action === "confirm"
            ? "Only your exact assigned prerequisite review and current MFA permit this synthetic confirmation."
            : "Synthetic cancellation or replacement requires at least one hour before the saved start. The original terms and history persist; a replacement needs a new private link."}
      </p>
      <button
        className="action action-outline transition-none"
        type="submit"
        disabled={!m.ready || m.pending || m.uncertain}
      >
        {m.pending ? "Saving synthetic change…" : labels[action]}
      </button>
      {m.notice}
    </form>
  );
}
export function BookingDisputeForm({ bookingId }: { bookingId: string }) {
  const m = useMutation(
    `/api/bookings/${bookingId}/dispute`,
    (r) => `/safeguarding/cases/${r.id}`,
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    await m.send(
      { category: "account", subject: d.get("subject"), body: d.get("body") },
      "requestKey",
    );
  }
  return (
    <form
      method="post"
      action={`/api/bookings/${bookingId}/dispute`}
      onSubmit={submit}
      className="mt-6 max-w-xl space-y-4"
    >
      <div>
        <label htmlFor="dispute-subject" className="text-label">
          Fictional subject
        </label>
        <input
          id="dispute-subject"
          name="subject"
          required
          maxLength={120}
          className="field mt-2"
        />
      </div>
      <div>
        <label htmlFor="dispute-body" className="text-label">
          Fictional description
        </label>
        <textarea
          id="dispute-body"
          name="body"
          required
          maxLength={2000}
          className="field mt-2"
        />
      </div>
      <p className="max-w-prose text-small">
        This request creates a synthetic response case bound to this booking. No
        real response service or attendance investigation is established.
      </p>
      <button
        className="action action-primary transition-none"
        disabled={!m.ready || m.pending || m.uncertain}
        type="submit"
      >
        {m.pending
          ? "Saving synthetic dispute…"
          : "Save synthetic booking dispute"}
      </button>
      {m.notice}
    </form>
  );
}
