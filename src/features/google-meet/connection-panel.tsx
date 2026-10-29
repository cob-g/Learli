"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useHydrated } from "@/hooks/use-hydrated";
import type { ConnectionMetadata } from "./service";

export function GoogleMeetConnectionPanel({
  enabled,
  connection,
  result,
}: {
  enabled: boolean;
  connection: ConnectionMetadata | null;
  result?: string;
}) {
  const interactive = useHydrated();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(
    result === "connected" && connection?.state === "active"
      ? "Google account connected. Automatic links apply to new confirmed bookings."
      : result === "cancelled"
        ? "Connection cancelled. You can keep using manual links."
        : result === "failed"
          ? "Google connection could not be completed. Try again, or sign in again first. Manual links remain available."
          : "",
  );
  const [disconnected, setDisconnected] = useState(false);
  const current = disconnected ? null : connection;
  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setMessage("Opening Google's consent screen…");
    try {
      const response = await fetch(
        "/api/tutor/meeting-providers/google/connect",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            consent: form.get("consent") === "on",
            replaceAccount: form.get("replaceAccount") === "on",
          }),
        },
      );
      const data = await response.json();
      if (
        response.ok &&
        typeof data.url === "string" &&
        new URL(data.url).origin === "https://accounts.google.com"
      ) {
        window.location.assign(data.url);
        return;
      }
      setMessage(
        typeof data.message === "string"
          ? data.message
          : "Google connection could not be started. Try again.",
      );
    } catch {
      setMessage(
        "Google connection could not be started. Check your connection and try again.",
      );
    }
    setPending(false);
  }
  async function disconnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("Disconnecting Google…");
    try {
      const response = await fetch(
        "/api/tutor/meeting-providers/google/disconnect",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirm: true }),
        },
      );
      const data = await response.json();
      if (!response.ok || data.disconnected !== true)
        setMessage(
          typeof data.message === "string"
            ? data.message
            : "Disconnection could not be confirmed. Reload to check before retrying.",
        );
      else {
        setDisconnected(true);
        setMessage(
          data.providerRevoked
            ? "Disconnected. Existing bookings and saved links remain available."
            : "Disconnected in Learli. Google access removal could not be confirmed; remove Learli from your Google account permissions too. Existing bookings and saved links remain available.",
        );
      }
    } catch {
      setMessage(
        "Disconnection could not be confirmed. Reload to check before retrying.",
      );
    }
    setPending(false);
  }
  return (
    <section
      className="tutor-panel max-w-3xl space-y-5 p-6"
      aria-labelledby="google-connection-heading"
      aria-busy={pending}
    >
      <div>
        <h2 id="google-connection-heading" className="text-section-title">
          Google Meet connection
        </h2>
        <p className="mt-2 text-body">
          Automatically prepare a separate private meeting link for new
          confirmed bookings using your own Google account. You host and admit
          participants on Google Meet.
        </p>
      </div>
      <p className="text-label">
        {current?.state === "active"
          ? "Connected"
          : current?.state === "reconnect"
            ? "Reconnect required"
            : "Not connected"}
      </p>
      {current && current.state !== "disconnected" && (
        <p className="text-body break-all">
          Your Google account: {current.account_label}
        </p>
      )}
      {!enabled && (
        <p className="text-body">
          Automatic Google Meet is not configured in this environment. You can
          continue saving a Zoom or Google Meet link on each booking.
        </p>
      )}
      {enabled && (
        <form onSubmit={connect} className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              name="consent"
              type="checkbox"
              required
              disabled={pending || !interactive}
              className="mt-1 size-5 shrink-0"
            />
            <span>
              I authorize Learli to create Google Meet links for my future
              confirmed bookings. Existing bookings will keep their current
              links.
            </span>
          </label>
          {current && current.state !== "disconnected" && (
            <label className="flex items-start gap-3">
              <input
                name="replaceAccount"
                type="checkbox"
                disabled={pending || !interactive}
                className="mt-1 size-5 shrink-0"
              />
              <span>
                Replace this connection if I select a different Google account.
                Meetings already created remain with their original host.
              </span>
            </label>
          )}
          <button
            className="action action-primary"
            disabled={pending || !interactive}
          >
            {pending
              ? "Please wait…"
              : current && current.state !== "disconnected"
                ? "Reconnect Google"
                : "Connect Google account"}
          </button>
        </form>
      )}
      {current && current.state !== "disconnected" && (
        <form
          onSubmit={disconnect}
          className="space-y-4 border-t border-border pt-5"
        >
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              required
              disabled={pending || !interactive}
              className="mt-1 size-5 shrink-0"
            />
            <span>
              Stop creating new links through this connection. My bookings and
              existing saved links will stay.
            </span>
          </label>
          <button
            className="action action-outline"
            disabled={pending || !interactive}
          >
            Disconnect Google
          </button>
        </form>
      )}
      <p className="text-small text-muted-foreground">
        Google account support and organization settings may vary. You can
        always supply an approved manual Zoom or Meet link. Learli does not
        record calls, verify attendance, or complete a booking when a call ends.
      </p>
      <p role="status" aria-live="polite" className="text-body">
        {message}
      </p>
      <noscript>
        <p>
          Enable JavaScript to manage this optional connection. Saved meeting
          links can still be opened from your bookings.
        </p>
      </noscript>
      <Link href="/tutor" className="inline-flex min-h-11 items-center">
        Return to bookings
      </Link>
    </section>
  );
}
