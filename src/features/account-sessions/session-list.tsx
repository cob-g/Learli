"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck, CircleAlert, LoaderCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { sessionTimestamp, type AccountSession } from "./model";

const endpoint = "/api/account/sessions";
type Notice = { text: string; failed: boolean; signIn?: boolean };
type SessionLoad = { sessions: AccountSession[] } | { error: Notice } | null;

async function requestSessions(signal?: AbortSignal): Promise<SessionLoad> {
  try {
    const response = await fetch(endpoint, { cache: "no-store", signal });
    if (!response.ok) {
      const body: { message?: string } | null = await response
        .json()
        .catch(() => null);
      return {
        error: {
          text: body?.message ?? "Sessions could not be loaded. Try again.",
          failed: true,
          signIn: response.status === 401,
        },
      };
    }
    const body: { sessions: AccountSession[] } = await response.json();
    return signal?.aborted ? null : body;
  } catch {
    return signal?.aborted
      ? null
      : {
          error: {
            text: "Sessions could not be loaded. Check your connection, then try again.",
            failed: true,
          },
        };
  }
}

export function SessionList() {
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [loadError, setLoadError] = useState<Notice>();
  const [notice, setNotice] = useState<Notice>();
  const [selected, setSelected] = useState<AccountSession>();
  const [pending, setPending] = useState(false);
  const [zone, setZone] = useState<string>();
  const dialog = useRef<HTMLDialogElement>(null);
  const result = useRef<HTMLParagraphElement>(null);

  const applyLoad = useCallback((loaded: SessionLoad) => {
    if (!loaded) return;
    if ("error" in loaded) setLoadError(loaded.error);
    else {
      setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      setSessions(loaded.sessions);
    }
  }, []);

  // Only the latest load may apply; an older response must not resurrect a
  // session that was just ended.
  const latest = useRef(0);
  const unmounted = useRef(false);

  function refresh() {
    const id = ++latest.current;
    setSessions(null);
    setLoadError(undefined);
    return requestSessions().then((loaded) => {
      if (id === latest.current && !unmounted.current) applyLoad(loaded);
    });
  }

  useEffect(() => {
    unmounted.current = false;
    const controller = new AbortController();
    const id = ++latest.current;
    void requestSessions(controller.signal).then((loaded) => {
      if (id === latest.current) applyLoad(loaded);
    });
    return () => {
      unmounted.current = true;
      controller.abort();
    };
  }, [applyLoad]);

  async function confirm() {
    if (!selected || pending) return;
    const target = selected;
    setPending(true);
    try {
      const response = await fetch(`${endpoint}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: target.id }),
      });
      if (response.ok) {
        setNotice({ text: "Session ended.", failed: false });
        await refresh();
      } else {
        const body: { message?: string } | null = await response
          .json()
          .catch(() => null);
        setNotice({
          text:
            body?.message ??
            "Session could not be ended. Refresh and try again.",
          failed: true,
          signIn: response.status === 401,
        });
      }
    } catch {
      setNotice({
        text: "We could not confirm whether the session ended. Refresh the list before trying again.",
        failed: true,
      });
    } finally {
      setPending(false);
      dialog.current?.close();
      requestAnimationFrame(() => result.current?.focus());
    }
  }

  return (
    <section
      className="mt-8 max-w-5xl rounded-surface border border-border bg-surface p-6 sm:p-8"
      aria-label="Active account sessions"
    >
      <p className="max-w-prose text-small text-muted-foreground">
        Browser details are reported by the browser and may be missing or
        inaccurate. Session refresh time does not show your last activity.
      </p>
      {notice && (
        <p
          ref={result}
          tabIndex={-1}
          role={notice.failed ? "alert" : "status"}
          className={`mt-4 flex items-start gap-2 text-body ${notice.failed ? "text-error" : "text-foreground"}`}
        >
          {notice.failed ? (
            <CircleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <CircleCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />
          )}
          <span>{notice.text}</span>
        </p>
      )}
      {loadError ? (
        <div className="mt-4">
          <p
            role="alert"
            className="flex max-w-prose items-start gap-2 text-body text-error"
          >
            <CircleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
            <span>{loadError.text}</span>
          </p>
          <button
            className="action action-outline mt-4"
            type="button"
            onClick={() => void refresh()}
          >
            Try again
          </button>
        </div>
      ) : sessions === null ? (
        <p className="mt-4 text-body" role="status">
          Loading sessions…
        </p>
      ) : (
        <>
          {sessions.length ? (
            <ul className="mt-6 divide-y divide-border border-t border-border">
              {sessions.map((session, index) => (
                <li key={session.id} className="min-w-0 py-6">
                  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                    <h2 className="flex items-center gap-2 text-item-title">
                      {session.current && (
                        <CircleCheck
                          className="size-4 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      {session.current
                        ? "Current session"
                        : `Other session ${index}`}
                    </h2>
                    {!session.current && (
                      <button
                        className="action action-outline"
                        type="button"
                        aria-label={`End other session ${index}`}
                        aria-disabled={pending}
                        onClick={() => {
                          if (pending) return;
                          setSelected(session);
                          setNotice(undefined);
                          dialog.current?.showModal();
                        }}
                      >
                        End session
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-body">
                    Reported browser: {session.reportedDevice}
                  </p>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                    {(
                      [
                        ["Signed in", session.createdAt],
                        ["Session refreshed", session.updatedAt],
                        ["Expires", session.expiresAt],
                      ] as const
                    ).map(([label, instant]) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-label text-muted-foreground">
                          {label}
                        </dt>
                        <dd className="mt-2 text-small wrap-anywhere tabular-nums">
                          {zone ? (
                            <time dateTime={instant}>
                              {sessionTimestamp(instant, zone)}
                            </time>
                          ) : (
                            "Loading time…"
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {session.current && (
                    <p className="mt-4 text-small text-muted-foreground">
                      Use Sign out below to end this session.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4">
              <h2 className="text-item-title">No active sessions returned</h2>
              <p className="mt-2 max-w-prose text-body">
                Sign in again to check your account sessions.
              </p>
            </div>
          )}
          <button
            className="action action-outline mt-4"
            type="button"
            onClick={() => void refresh()}
          >
            Refresh sessions
          </button>
        </>
      )}
      {(loadError?.signIn || notice?.signIn || sessions?.length === 0) && (
        <Link
          className="mt-4 inline-flex min-h-11 items-center"
          href="/sign-in?next=%2Faccount%2Fsessions"
        >
          Sign in again
        </Link>
      )}
      <ConfirmDialog
        ref={dialog}
        title="End this other session?"
        confirmLabel={pending ? "Ending session…" : "End session"}
        dismissLabel="Keep session"
        destructive
        pending={pending}
        onConfirm={() => void confirm()}
      >
        <p className="max-w-prose text-body">
          This signs that session out of Learli. Your current session stays
          signed in.
        </p>
        <p className="mt-2 text-small">
          Reported browser: {selected?.reportedDevice}
        </p>
        {selected && zone && (
          <p className="mt-2 text-small">
            Signed in: {sessionTimestamp(selected.createdAt, zone)}
          </p>
        )}
        {pending && (
          <LoaderCircle
            className="mt-2 size-4 motion-safe:animate-spin"
            aria-hidden="true"
          />
        )}
      </ConfirmDialog>
    </section>
  );
}
