"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import type { MeetingSectionState, PrivateMeetingState } from "./model";

export function BookingMeetingSection({
  bookingId,
  initial,
  inactive = false,
  privateWorkflow = false,
}: {
  bookingId: string;
  initial: MeetingSectionState;
  inactive?: boolean;
  privateWorkflow?: boolean;
}) {
  const endpoint = `/api/bookings/${encodeURIComponent(bookingId)}/meeting-link`;
  const [meeting, setMeeting] = useState(initial);
  const [url, setUrl] = useState(
    initial.state === "present" && initial.canEdit ? initial.url : "",
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [conflicted, setConflicted] = useState(false);
  const requestId = useRef<string | null>(null);
  const interactive = useHydrated();
  const canEdit =
    (meeting.state === "present" || meeting.state === "missing") &&
    meeting.canEdit;

  async function reload() {
    setPending(true);
    setMessage("Loading meeting link…");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) {
        setMeeting({
          state:
            response.status === 404 ||
            response.status === 401 ||
            response.status === 403
              ? "unavailable"
              : "error",
        });
        setMessage("The meeting link could not be loaded.");
        return false;
      }
      const current: PrivateMeetingState = await response.json();
      setMeeting(current);
      setUrl(current.state === "present" && current.canEdit ? current.url : "");
      setConflicted(false);
      requestId.current = null;
      setMessage("Meeting link refreshed.");
      return true;
    } catch {
      setMeeting({ state: "error" });
      setMessage("The meeting link could not be loaded. Try again.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !canEdit ||
      pending ||
      conflicted ||
      (meeting.state !== "present" && meeting.state !== "missing")
    )
      return;
    requestId.current ??= crypto.randomUUID();
    setPending(true);
    setMessage(
      privateWorkflow ? "Saving meeting link…" : "Saving test meeting link…",
    );
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url,
          expectedRevision: meeting.revision,
          requestId: requestId.current,
        }),
      });
      if (!response.ok) {
        if (response.status === 409) {
          setConflicted(true);
          setMessage(
            "The meeting link changed. Reload it before saving again. Reloading replaces your entered link.",
          );
        } else if ([401, 403, 404].includes(response.status)) {
          setMeeting({ state: "unavailable" });
          setUrl("");
          setMessage(
            "The meeting link is no longer available on this account.",
          );
        } else
          setMessage(
            response.status === 400
              ? privateWorkflow
                ? "Enter a supported HTTPS Zoom or Google Meet link."
                : "Enter a supported HTTPS Zoom or Google Meet test link."
              : "The save could not be confirmed. Retry with the same entered link or reload.",
          );
        return;
      }
      const saved = privateWorkflow
        ? "Private meeting link saved."
        : "Test meeting link saved. No meeting was arranged.";
      if (await reload()) setMessage(saved);
      else
        setMessage(
          `${saved} The latest link could not be reloaded; use Reload meeting link to check it.`,
        );
    } catch {
      setMessage(
        "The save could not be confirmed. Retry with the same entered link or reload.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className="mt-8 border-t border-border pt-6"
      aria-labelledby="meeting-heading"
      aria-busy={pending}
    >
      <h2 id="meeting-heading" className="text-section-title">
        {privateWorkflow ? "Private meeting link" : "Test meeting link"}
      </h2>
      <p className="mt-2 max-w-prose text-small text-muted-foreground">
        {privateWorkflow
          ? "The private Zoom or Google Meet link is arranged by your tutor or through their connected Google account. It opens externally; Learli does not host calls, check meeting settings or verify attendance."
          : "Local simulation only. A tutor-supplied test link opens externally on Zoom or Google Meet. Learli does not host calls, arrange a lesson, check meeting settings or verify attendance."}
      </p>
      {meeting.state === "present" && (
        <div className="mt-4">
          <a
            className="inline-flex min-h-11 items-center"
            href={`${endpoint}?open=1`}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            {privateWorkflow ? "Open meeting on " : "Open test link on "}
            {meeting.provider === "zoom" ? "Zoom" : "Google Meet"} (new tab)
          </a>
          <p className="mt-2 text-small text-muted-foreground">
            Access is rechecked when opened. A link already shared outside
            Learli cannot be recalled.
          </p>
        </div>
      )}
      {meeting.state === "missing" && (
        <p className="mt-4 text-body">
          {privateWorkflow
            ? meeting.provisioning === "preparing"
              ? "Preparing your meeting link. Refresh to check its progress; your booking remains confirmed."
              : meeting.provisioning === "action_required"
                ? meeting.canEdit
                  ? "Automatic meeting preparation needs attention. Check Meeting setup or save a manual Zoom or Meet link below."
                  : "Your tutor needs to arrange the meeting link. Your booking remains confirmed."
                : "The tutor has not provided a meeting link yet."
            : "No test meeting link has been provided."}
        </p>
      )}
      {meeting.state === "missing" &&
        meeting.canEdit &&
        meeting.provisioning && (
          <Link
            href="/tutor/meetings"
            className="mt-2 inline-flex min-h-11 items-center"
          >
            Meeting setup
          </Link>
        )}
      {meeting.state === "awaiting_confirmation" && (
        <p className="mt-4 text-body">
          This booking is awaiting confirmation. Its private meeting link will
          be available after confirmation.
        </p>
      )}
      {meeting.state === "expired" && (
        <p className="mt-4 text-body">
          {privateWorkflow
            ? "The meeting link is unavailable because this booking is no longer active."
            : inactive
              ? "This simulation is no longer active. Its test meeting link is unavailable."
              : "This simulation has expired. Its test meeting link is unavailable."}
        </p>
      )}
      {meeting.state === "unavailable" && (
        <p className="mt-4 text-body">
          {privateWorkflow
            ? "The meeting link is unavailable on this account."
            : "The test meeting link is unavailable on this account."}
        </p>
      )}
      {meeting.state === "error" && (
        <p className="mt-4 text-body">
          {privateWorkflow
            ? "Meeting links could not be loaded. Try again."
            : "Test meeting links could not be loaded. Try again."}
        </p>
      )}
      {canEdit && (
        <form
          method="post"
          action={endpoint}
          onSubmit={save}
          className="mt-6 max-w-prose space-y-4"
        >
          <div>
            <label className="text-label" htmlFor="test-meeting-url">
              {privateWorkflow
                ? "Zoom or Google Meet link"
                : "Zoom or Google Meet test link"}
            </label>
            <input
              id="test-meeting-url"
              name="url"
              type="url"
              required
              maxLength={2048}
              value={url}
              disabled={pending || !interactive}
              onChange={(event) => {
                setUrl(event.target.value);
                requestId.current = null;
              }}
              aria-describedby="meeting-format meeting-message"
              className="field mt-2"
              autoComplete="off"
            />
            <p
              id="meeting-format"
              className="mt-2 text-small text-muted-foreground"
            >
              Use a supported HTTPS joining link. It is private to this{" "}
              {privateWorkflow ? "booking" : "reservation"}. Revision{" "}
              {meeting.state === "present" ? meeting.revision : 0}.
            </p>
          </div>
          <button
            className="action action-primary"
            type="submit"
            disabled={pending || conflicted || !interactive}
          >
            {pending
              ? "Saving…"
              : meeting.state === "present"
                ? privateWorkflow
                  ? "Replace meeting link"
                  : "Replace test meeting link"
                : privateWorkflow
                  ? "Save meeting link"
                  : "Save test meeting link"}
          </button>
          <noscript>
            <p className="text-body">
              {privateWorkflow
                ? "Enable JavaScript to save or replace a meeting link."
                : "Enable JavaScript to save or replace a test meeting link."}
            </p>
          </noscript>
        </form>
      )}
      <p
        id="meeting-message"
        role="status"
        aria-live="polite"
        className="mt-4 text-body"
      >
        {message}
      </p>
      <button
        type="button"
        className="action action-outline mt-4"
        disabled={pending || !interactive}
        onClick={() => void reload()}
      >
        Reload meeting link
      </button>
    </section>
  );
}
