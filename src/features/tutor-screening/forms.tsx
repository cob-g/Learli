"use client";
import { useRef, useState, useTransition } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { useRouter } from "next/navigation";
import type { ScreeningDetail } from "./service";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { screeningActions } from "./policy";
import { formatReceiptTime, wallClockToUtc } from "./time";
import {
  screeningCheckLabel,
  screeningProgress,
} from "@/features/tutors/readiness-summary";

type DisplayCheck = ScreeningDetail["checks"][number];

function checkState(check: DisplayCheck | undefined) {
  if (!check)
    return {
      label: "Not recorded",
      tone: "border-control bg-subtle text-muted-foreground",
    };
  if (check.outcome === "failed")
    return {
      label: "Failed",
      tone: "border-error bg-error-soft text-error",
    };
  if (check.outcome === "revoked")
    return {
      label: "Revoked",
      tone: "border-control bg-subtle text-muted-foreground",
    };
  if (check.outcome === "passed" && check.current)
    return {
      label: "Passed and current",
      tone: "border-success bg-success-soft text-success",
    };
  if (check.outcome === "passed")
    return {
      label: "Expired",
      tone: "border-warning bg-warning-soft text-warning",
    };
  return {
    label: "Not recorded",
    tone: "border-control bg-subtle text-muted-foreground",
  };
}

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone.trim() || "UTC";
  } catch {
    return "UTC";
  }
}

export function ScreeningForm({
  tutorId,
  detail,
  privateWorkflow = false,
  localWorkflow = false,
}: {
  tutorId: string;
  detail: ScreeningDetail;
  privateWorkflow?: boolean;
  localWorkflow?: boolean;
}) {
  const router = useRouter(),
    ready = useHydrated(),
    [refreshing, startRefresh] = useTransition(),
    [saving, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [checkedLocal, setCheckedLocal] = useState(""),
    [expiresLocal, setExpiresLocal] = useState(""),
    alert = useRef<HTMLParagraphElement>(null),
    key = useRef<string | null>(null);
  const busy = saving || refreshing;
  const dialog = useRef<HTMLDialogElement>(null),
    [action, setAction] = useState<(typeof screeningActions)[number]>();
  const progress = screeningProgress(detail);
  const deviceTimeZone = ready ? browserTimeZone() : "UTC";
  const checkedPreview = checkedLocal
    ? wallClockToUtc(checkedLocal, deviceTimeZone)
    : null;
  const expiresPreview = expiresLocal
    ? wallClockToUtc(expiresLocal, deviceTimeZone)
    : null;
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
      setMessage(
        privateWorkflow
          ? "Screening record saved."
          : "Synthetic screening record saved.",
      );
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
        {privateWorkflow ? "Tutor screening" : "Synthetic screening exercise"}
      </h2>
      <p className="mt-4 max-w-prose text-body">
        {localWorkflow
          ? "Record the checks you performed for this application. Approval requires current evidence for every required check."
          : privateWorkflow
            ? "These checks use fictional evidence. No actual person or document has been screened."
            : "These fictional checks exercise software. No actual person or document has been screened."}
      </p>
      <p className="mt-4 text-body">
        State: {detail.state}. Round {detail.round}. Revision {detail.revision}.
      </p>
      <div
        className="mt-4 max-w-prose rounded-surface border border-border bg-subtle p-4"
        role="status"
      >
        <p className="text-label">
          {progress.currentCount} of {progress.requiredCount} required checks
          current
        </p>
        <p className="mt-1 text-small text-muted-foreground">
          {progress.current
            ? "Screening is approved and every required check is current."
            : progress.readyForDecision
              ? "Every required check is current. This case is ready for a decision."
              : progress.nextRequiredCode
                ? `Next: record the ${screeningCheckLabel(progress.nextRequiredCode).toLowerCase()}.`
                : "Open the case state and available actions before continuing."}
        </p>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {detail.requiredCodes.map((code) => {
          const ck = detail.checks.find((c) => c.code === code) as
            DisplayCheck | undefined;
          const status = checkState(ck);
          return (
            <li
              key={code}
              className="rounded-surface border border-border bg-background p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-label">{screeningCheckLabel(code)}</span>
                <span
                  className={`inline-flex min-h-7 items-center rounded-tag border px-2 text-label ${status.tone}`}
                >
                  {status.label}
                </span>
              </div>
              {ck?.checkedAt && (
                <p className="mt-3 text-small text-muted-foreground">
                  Checked: {formatReceiptTime(ck.checkedAt, deviceTimeZone)}
                </p>
              )}
              {ck?.expiresAt && (
                <p className="mt-1 text-small text-muted-foreground">
                  Expires: {formatReceiptTime(ck.expiresAt, deviceTimeZone)}
                </p>
              )}
              {ck?.receiptReference && (
                <p className="mt-1 text-small wrap-anywhere text-muted-foreground">
                  Screening receipt: <code>{ck.receiptReference}</code>
                </p>
              )}
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
          const checkedAt = wallClockToUtc(
            f.get("checkedAtLocal"),
            deviceTimeZone,
          );
          const expiresAt = wallClockToUtc(
            f.get("expiresAtLocal"),
            deviceTimeZone,
          );
          if (!checkedAt.ok || !expiresAt.ok) {
            setMessage(
              !checkedAt.ok
                ? checkedAt.message
                : !expiresAt.ok
                  ? expiresAt.message
                  : "Choose valid dates and times.",
            );
            requestAnimationFrame(() => alert.current?.focus());
            return;
          }
          if (Date.parse(checkedAt.iso) > Date.now()) {
            setMessage("Choose a check time that is not in the future.");
            requestAnimationFrame(() => alert.current?.focus());
            return;
          }
          if (Date.parse(expiresAt.iso) <= Date.parse(checkedAt.iso)) {
            setMessage("Choose an expiry after the check time.");
            requestAnimationFrame(() => alert.current?.focus());
            return;
          }
          void save(
            {
              code: f.get("code"),
              outcome: f.get("outcome"),
              checkedAt: checkedAt.iso,
              expiresAt: expiresAt.iso,
            },
            "checks",
          );
        }}
      >
        <p className="text-small">
          {localWorkflow
            ? "All fields are required. Learli creates the internal screening receipt automatically. Keep personal documents and private contact details out of this form."
            : privateWorkflow
              ? "All fields are required. Learli creates the fictional internal screening receipt automatically."
              : "All fields are required. Learli creates the synthetic internal screening receipt automatically."}
        </p>
        <p
          id="screening-time-help"
          className="text-small text-muted-foreground"
        >
          Times entered here use {deviceTimeZone ?? "your device's local time"}.
          Learli converts them to UTC before saving. Expiry remains an explicit
          choice until a validity duration is approved.
        </p>
        <label className="block text-label">
          Required check
          <select name="code" className="field mt-2">
            {detail.requiredCodes.map((code) => (
              <option key={code} value={code}>
                {screeningCheckLabel(code)}
              </option>
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
          Checked at
          <input
            type="datetime-local"
            name="checkedAtLocal"
            className="field mt-2"
            required
            step={60}
            value={checkedLocal}
            aria-describedby="screening-time-help checked-at-preview"
            aria-invalid={checkedPreview?.ok === false}
            onChange={(event) => setCheckedLocal(event.target.value)}
          />
        </label>
        <p
          id="checked-at-preview"
          className={`text-small ${checkedPreview?.ok === false ? "text-error" : "text-muted-foreground"}`}
        >
          {checkedPreview
            ? checkedPreview.ok
              ? `Stored as ${checkedPreview.iso} UTC.`
              : checkedPreview.message
            : "Choose when this check was completed."}
        </p>
        <label className="block text-label">
          Expires at
          <input
            type="datetime-local"
            name="expiresAtLocal"
            className="field mt-2"
            required
            step={60}
            value={expiresLocal}
            aria-describedby="screening-time-help expires-at-preview"
            aria-invalid={expiresPreview?.ok === false}
            onChange={(event) => setExpiresLocal(event.target.value)}
          />
        </label>
        <p
          id="expires-at-preview"
          className={`text-small ${expiresPreview?.ok === false ? "text-error" : "text-muted-foreground"}`}
        >
          {expiresPreview
            ? expiresPreview.ok
              ? `Stored as ${expiresPreview.iso} UTC.`
              : expiresPreview.message
            : "Choose when this check should expire."}
        </p>
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
              ? privateWorkflow
                ? "Approve screening"
                : "Approve synthetic screening"
              : action === "reinstate"
                ? privateWorkflow
                  ? "Reinstate screening"
                  : "Reinstate synthetic screening"
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
        title={
          privateWorkflow ? "Change screening?" : "Change synthetic screening?"
        }
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
          Apply {action} to this exact {localWorkflow ? "tutor" : "fictional"}{" "}
          application. The server rechecks current assignment, policy and
          required evidence.
        </p>
      </ConfirmDialog>
    </section>
  );
}
export function ScreeningRequest({
  tutorId,
  privateWorkflow = false,
}: {
  tutorId: string;
  privateWorkflow?: boolean;
}) {
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
        {privateWorkflow
          ? "Request screening for this application. Your assigned reviewer must check the required evidence before approval."
          : "Request fictional readiness screening for this application. This is not approval for real tutoring."}
      </p>
      <p role="alert" className="mt-4 text-body">
        {message}
      </p>
      <button className="action action-primary mt-4" disabled={!ready || busy}>
        {privateWorkflow ? "Request screening" : "Request synthetic screening"}
      </button>
      <noscript>
        <p className="mt-4 text-body">
          {privateWorkflow
            ? "Enable JavaScript to request screening."
            : "Enable JavaScript to request synthetic screening."}
        </p>
      </noscript>
    </form>
  );
}
