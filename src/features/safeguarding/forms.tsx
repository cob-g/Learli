"use client";
import { useSyncExternalStore, useRef, useState, useTransition } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { useRouter } from "next/navigation";
import type { SafeguardingDetail } from "./service";
import { isUncertainRequestStatus } from "@/features/learners/pending-request";
const subscribe = () => () => {};
const pendingReportKey = "learli:pending-safeguarding-request";
const serverReportKey = () => null;
function storedReportKey() {
  try {
    const key = window.sessionStorage.getItem(pendingReportKey);
    return key && /^[0-9a-f-]{36}$/i.test(key) ? key : null;
  } catch {
    return null;
  }
}
function rememberReportKey(key: string | null) {
  try {
    if (key) window.sessionStorage.setItem(pendingReportKey, key);
    else window.sessionStorage.removeItem(pendingReportKey);
  } catch {
    // Optional storage; same-document retries still retain the original attempt.
  }
}
function friendly(result: unknown) {
  return typeof result === "object" &&
    result !== null &&
    "message" in result &&
    typeof result.message === "string" &&
    result.message
    ? result.message
    : undefined;
}
export function SafeguardingReportForm() {
  const ready = useHydrated(),
    pendingKey = useSyncExternalStore(
      subscribe,
      storedReportKey,
      serverReportKey,
    ),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [message, setMessage] = useState(""),
    inFlight = useRef(false),
    priorUncertainty = useRef(false),
    attempt = useRef<{
      category: "safety";
      subject: FormDataEntryValue | null;
      body: FormDataEntryValue | null;
      requestKey: string;
    } | null>(null),
    form = useRef<HTMLFormElement>(null),
    alert = useRef<HTMLParagraphElement>(null);
  const recovering = uncertain || (!busy && pendingKey !== null);
  return (
    <form
      ref={form}
      method="post"
      action="/api/safeguarding/cases"
      className="max-w-xl space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready || inFlight.current) return;
        // Keep both identity and fields until the server settles this attempt.
        if (!attempt.current) {
          const f = new FormData(e.currentTarget);
          const savedKey = storedReportKey();
          priorUncertainty.current = savedKey !== null;
          setUncertain(priorUncertainty.current);
          attempt.current = {
            category: "safety",
            subject: f.get("subject"),
            body: f.get("body"),
            requestKey: savedKey ?? crypto.randomUUID(),
          };
        }
        inFlight.current = true;
        setBusy(true);
        setMessage("");
        rememberReportKey(attempt.current.requestKey);
        try {
          const r = await fetch("/api/safeguarding/cases", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(attempt.current),
          });
          const result: unknown = await r.json().catch(() => null);
          const text = friendly(result);
          const id =
            typeof result === "object" && result !== null && "id" in result
              ? result.id
              : undefined;
          if (!r.ok || typeof id !== "string") {
            // A later refusal cannot disprove an earlier uncertain commit.
            const outcomeUncertain =
              priorUncertainty.current ||
              isUncertainRequestStatus(r.status) ||
              result === null ||
              r.ok;
            setUncertain(outcomeUncertain);
            priorUncertainty.current = outcomeUncertain;
            if (!outcomeUncertain) {
              attempt.current = null;
              rememberReportKey(null);
            }
            setMessage(
              outcomeUncertain
                ? "We could not confirm whether your report was saved. Retry this same report to check its result."
                : (text ??
                    "Report could not be saved. Check the fields and retry."),
            );
            inFlight.current = false;
            setBusy(false);
            requestAnimationFrame(() => alert.current?.focus());
            return;
          }
          rememberReportKey(null);
          window.location.replace(
            new URL(`/safeguarding/cases/${id}`, window.location.origin).href,
          );
        } catch {
          priorUncertainty.current = true;
          setUncertain(true);
          setMessage(
            "We could not confirm whether your report was saved. Retry this same report to check its result.",
          );
          inFlight.current = false;
          setBusy(false);
          requestAnimationFrame(() => alert.current?.focus());
        }
      }}
    >
      <p className="max-w-prose rounded-control border border-border bg-subtle p-4 text-small">
        Synthetic response exercise. Use fictional text only. No actual human
        response service or emergency monitoring is active.
      </p>
      <label className="block text-label">
        Report subject
        <input
          name="subject"
          className="field mt-2"
          required
          maxLength={120}
          disabled={!ready || busy || uncertain}
        />
      </label>
      <label className="block text-label">
        Concern
        <textarea
          name="body"
          className="field mt-2 min-h-40"
          required
          maxLength={2000}
          disabled={!ready || busy || uncertain}
        />
      </label>
      <p
        ref={alert}
        role="alert"
        tabIndex={-1}
        className="max-w-prose text-body text-error"
      >
        {message}
      </p>
      <button
        className="action action-primary w-full sm:w-auto"
        disabled={!ready || busy}
        aria-busy={busy}
      >
        {busy
          ? "Saving report"
          : recovering
            ? "Retry same report"
            : "Save synthetic report"}
      </button>
      {recovering && (
        <div className="space-y-4">
          <p className="max-w-prose text-body">
            Your earlier report may already be saved. Check your reports before
            starting a different report. Retrying keeps the same request.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {/* A native document GET reloads current history after an uncertain write. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              className="inline-flex min-h-11 items-center"
              href="/safeguarding/report"
            >
              Check my reports
            </a>
            <button
              type="button"
              className="action action-outline"
              disabled={!ready || busy}
              onClick={() => {
                if (!ready || inFlight.current) return;
                // A new key requires explicit new-report intent, never a retry.
                attempt.current = null;
                priorUncertainty.current = false;
                rememberReportKey(null);
                setUncertain(false);
                setMessage(
                  "You can start a different report. Your earlier report may already be saved.",
                );
                form.current?.reset();
                requestAnimationFrame(() =>
                  form.current
                    ?.querySelector<HTMLInputElement>('[name="subject"]')
                    ?.focus(),
                );
              }}
            >
              Start a different report
            </button>
          </div>
        </div>
      )}
      <noscript>
        <p className="text-body">
          Enable JavaScript to save a report. Nothing is submitted without it.
        </p>
      </noscript>
    </form>
  );
}
export function ResponseForm({
  detail,
  scope,
}: {
  detail: SafeguardingDetail;
  scope: "reviewer" | "dispatcher";
}) {
  const router = useRouter(),
    ready = useHydrated(),
    [refreshing, startRefresh] = useTransition(),
    [saving, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    alert = useRef<HTMLParagraphElement>(null),
    key = useRef<string | null>(null);
  const busy = saving || refreshing;
  async function save(action: string, targetId?: string) {
    if (busy) return;
    setBusy(true);
    key.current ??= crypto.randomUUID();
    try {
      const r = await fetch(`/api/admin/safeguarding/${detail.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          revision: detail.revision,
          requestKey: key.current,
          ...(targetId ? { targetId } : {}),
        }),
      });
      const result: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setMessage(friendly(result) ?? "Action could not be saved.");
        return;
      }
      key.current = null;
      startRefresh(() => router.refresh());
      setMessage("Synthetic response action saved.");
    } catch {
      setMessage("Action could not be saved.");
    } finally {
      setBusy(false);
      requestAnimationFrame(() => alert.current?.focus());
    }
  }
  return (
    <section className="mt-8">
      <h2 className="text-section-title">Synthetic response actions</h2>
      <p
        ref={alert}
        tabIndex={-1}
        role="alert"
        className="mt-4 max-w-prose text-body"
      >
        {message}
      </p>
      {scope === "dispatcher" ? (
        <form
          method="post"
          action={`/api/admin/safeguarding/${detail.id}`}
          className="mt-4 space-y-4"
          onChange={() => {
            key.current = null;
          }}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void save(String(f.get("action")), String(f.get("target")));
          }}
        >
          <label className="block text-label">
            Assignment action
            <select name="action" className="field mt-2">
              <option value={detail.reviewer ? "reassign" : "assign"}>
                {detail.reviewer ? "Reassign" : "Assign"}
              </option>
              <option value="escalate">Transfer requested escalation</option>
            </select>
          </label>
          <label className="block text-label">
            Exact permitted reviewer
            <select
              name="target"
              className="field mt-2"
              required
              defaultValue=""
            >
              <option value="">Choose a reviewer</option>
              {detail.choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.canEscalate ? " (escalation)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="action action-primary" disabled={!ready || busy}>
            Save assignment
          </button>
        </form>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-3">
            {["acknowledge", "close", "reopen"].map((action) => (
              <button
                className="action action-outline"
                key={action}
                disabled={!ready || busy}
                onClick={() => {
                  key.current = null;
                  void save(action);
                }}
              >
                {action === "acknowledge"
                  ? "Acknowledge assignment"
                  : action === "close"
                    ? "Close synthetic case"
                    : "Reopen synthetic case"}
              </button>
            ))}
          </div>
          <form
            method="post"
            action={`/api/admin/safeguarding/${detail.id}`}
            className="mt-6 max-w-2xl space-y-4"
            onChange={() => {
              key.current = null;
            }}
            onSubmit={(e) => {
              e.preventDefault();
              void save(
                "request_escalation",
                String(new FormData(e.currentTarget).get("target")),
              );
            }}
          >
            <label className="block text-label">
              Escalation reviewer
              <select
                name="target"
                className="field mt-2"
                required
                defaultValue=""
              >
                <option value="">Choose an escalation reviewer</option>
                {detail.choices
                  .filter((c) => c.canEscalate)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <button className="action action-primary" disabled={!ready || busy}>
              Request escalation
            </button>
          </form>
        </>
      )}
      <noscript>
        <p className="mt-4 text-body">
          Enable JavaScript for response actions. No action is submitted without
          it.
        </p>
      </noscript>
    </section>
  );
}
