"use client";
import { useRef, useState, useTransition } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { useRouter } from "next/navigation";
import type { ScreeningDetail } from "./service";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { screeningActions } from "./policy";
export function ScreeningForm({
  tutorId,
  detail,
}: {
  tutorId: string;
  detail: ScreeningDetail;
}) {
  const router = useRouter(),
    ready = useHydrated(),
    [refreshing, startRefresh] = useTransition(),
    [saving, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    alert = useRef<HTMLParagraphElement>(null),
    key = useRef<string | null>(null);
  const busy = saving || refreshing;
  const dialog = useRef<HTMLDialogElement>(null),
    [action, setAction] = useState<(typeof screeningActions)[number]>();
  async function save(
    input: Record<string, unknown>,
    kind: "checks" | "decision",
  ) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    key.current ??= crypto.randomUUID();
    try {
      const r = await fetch(
        `/api/admin/tutor-applications/${tutorId}/screening/${kind}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...input,
            revision: detail.revision,
            requestKey: key.current,
          }),
        },
      );
      const result: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setMessage(
          typeof result === "object" &&
            result !== null &&
            "message" in result &&
            typeof result.message === "string" &&
            result.message
            ? result.message
            : "Screening could not be saved.",
        );
        return;
      }
      key.current = null;
      startRefresh(() => router.refresh());
      setMessage("Synthetic screening record saved.");
    } catch {
      setMessage("Screening could not be saved.");
    } finally {
      setBusy(false);
      if (kind === "decision") dialog.current?.close();
      requestAnimationFrame(() => alert.current?.focus());
    }
  }
  return (
    <section className="mt-8" aria-labelledby="screening-title">
      <h2 id="screening-title" className="text-section-title">
        Synthetic screening exercise
      </h2>
      <p className="mt-4 max-w-prose text-body">
        These fictional checks exercise software. No actual person or document
        has been screened.
      </p>
      <p className="mt-4 text-body">
        State: {detail.state}. Round {detail.round}. Revision {detail.revision}.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {detail.requiredCodes.map((code) => {
          const ck = detail.checks.find((c) => c.code === code);
          return (
            <li key={code} className="py-3 text-body">
              {code}:{" "}
              {ck?.current
                ? "Current passed evidence"
                : (ck?.outcome ?? "Missing evidence")}
            </li>
          );
        })}
      </ul>
      <p
        ref={alert}
        tabIndex={-1}
        role="alert"
        className="mt-4 max-w-prose text-body"
      >
        {message}
      </p>
      <form
        method="post"
        action={`/api/admin/tutor-applications/${tutorId}/screening/checks`}
        className="mt-6 space-y-4"
        onChange={() => {
          key.current = null;
        }}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void save(
            {
              code: f.get("code"),
              outcome: f.get("outcome"),
              reference: f.get("reference"),
              checkedAt: f.get("checkedAt"),
              expiresAt: f.get("expiresAt"),
            },
            "checks",
          );
        }}
      >
        <p className="text-small">
          All fields are required. Use only synthetic opaque references and UTC
          dates.
        </p>
        <label className="block text-label">
          Required check
          <select name="code" className="field mt-2">
            {detail.requiredCodes.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
        <label className="block text-label">
          Check result
          <select name="outcome" className="field mt-2">
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="revoked">Revoked</option>
          </select>
        </label>
        <label className="block text-label">
          Evidence reference
          <input
            name="reference"
            className="field mt-2"
            required
            maxLength={46}
            placeholder="screening:opaque UUID"
          />
        </label>
        <label className="block text-label">
          Checked at (UTC ISO date)
          <input
            name="checkedAt"
            className="field mt-2"
            required
            placeholder="2026-10-12T12:00:00Z"
          />
        </label>
        <label className="block text-label">
          Expires at (UTC ISO date)
          <input
            name="expiresAt"
            className="field mt-2"
            required
            placeholder="2026-10-13T12:00:00Z"
          />
        </label>
        <button
          className="action action-primary"
          disabled={!ready || busy}
          aria-busy={busy}
        >
          {busy ? "Saving screening" : "Record check"}
        </button>
        <noscript>
          <p className="text-body">
            Enable JavaScript to record a check. Nothing is submitted without
            it.
          </p>
        </noscript>
      </form>
      <h3 className="mt-8 text-item-title">Decision</h3>
      <div className="mt-4 flex flex-wrap gap-3">
        {screeningActions.map((action) => (
          <button
            key={action}
            className="action action-outline"
            disabled={!ready || busy}
            onClick={() => {
              key.current = null;
              setAction(action);
              dialog.current?.showModal();
            }}
          >
            {action === "approve"
              ? "Approve synthetic screening"
              : action === "reinstate"
                ? "Reinstate synthetic screening"
                : action === "reopen"
                  ? "Reopen screening"
                  : action === "suspend"
                    ? "Suspend screening"
                    : action === "revoke"
                      ? "Revoke screening"
                      : "Reject screening"}
          </button>
        ))}
      </div>
      <ConfirmDialog
        ref={dialog}
        title="Change synthetic screening?"
        confirmLabel="Confirm screening decision"
        dismissLabel="Keep current screening"
        pending={busy}
        destructive={
          action === "revoke" || action === "suspend" || action === "reject"
        }
        onConfirm={() => {
          if (action) void save({ action }, "decision");
        }}
      >
        <p>
          Apply {action} to this exact fictional application. The server
          rechecks current assignment, policy and required evidence.
        </p>
      </ConfirmDialog>
    </section>
  );
}
export function ScreeningRequest({ tutorId }: { tutorId: string }) {
  const ready = useHydrated(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);
  const inFlight = useRef(false);
  return (
    <form
      method="post"
      action={`/api/tutor/screening/${tutorId}`}
      className="mt-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready || inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        setMessage("");
        key.current ??= crypto.randomUUID();
        try {
          const r = await fetch(`/api/tutor/screening/${tutorId}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestKey: key.current }),
          });
          const v: unknown = await r.json();
          if (!r.ok) {
            setMessage(
              typeof v === "object" &&
                v !== null &&
                "message" in v &&
                typeof v.message === "string" &&
                v.message.trim().length > 0 &&
                v.message.length <= 500
                ? v.message
                : "Screening is unavailable. Please retry this request.",
            );
            inFlight.current = false;
            setBusy(false);
            return;
          }
          window.location.reload();
        } catch {
          setMessage("Screening is unavailable. Please retry this request.");
          inFlight.current = false;
          setBusy(false);
        }
      }}
    >
      <p className="max-w-prose text-body">
        Request fictional readiness screening for this application. This is not
        approval for real tutoring.
      </p>
      <p role="alert" className="mt-4 text-body">
        {message}
      </p>
      <button className="action action-primary mt-4" disabled={!ready || busy}>
        Request synthetic screening
      </button>
      <noscript>
        <p className="mt-4 text-body">
          Enable JavaScript to request synthetic screening.
        </p>
      </noscript>
    </form>
  );
}
