"use client";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { reasonLabels, type localReasons } from "./input";
type Reason = (typeof localReasons)[number];
export function ChangeAccessForm({
  targetId,
  name,
  status,
  revision,
}: {
  targetId: string;
  name: string;
  status: "active" | "suspended";
  revision: number;
}) {
  const [reading, startReading] = useTransition();
  // A save's follow-up refresh keeps the controls busy without the manual
  // reload's "Loading account…" status beside the result.
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter(),
    dialog = useRef<HTMLDialogElement>(null),
    notice = useRef<HTMLParagraphElement>(null),
    reasonControl = useRef<HTMLSelectElement>(null),
    busy = useRef(false);
  const retry = useRef<{ fingerprint: string; requestKey: string } | null>(
    null,
  );
  const [reason, setReason] = useState<Reason>(),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [reasonError, setReasonError] = useState(false);
  const pending = saving || reading || refreshing;
  const next = status === "active" ? "suspended" : "active",
    verb = next === "suspended" ? "Suspend" : "Restore";
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || reading || refreshing) return;
    const selected = new FormData(event.currentTarget).get("reason");
    if (
      typeof selected !== "string" ||
      !Object.keys(reasonLabels).includes(selected)
    ) {
      setReasonError(true);
      reasonControl.current?.focus();
      return;
    }
    setReasonError(false);
    setReason(selected as Reason);
    dialog.current?.showModal();
  }
  async function confirm() {
    if (busy.current || reading || refreshing || !reason) return;
    busy.current = true;
    setSaving(true);
    setMessage("");
    const fingerprint = JSON.stringify({ revision, status: next, reason });
    if (retry.current?.fingerprint !== fingerprint)
      retry.current = { fingerprint, requestKey: crypto.randomUUID() };
    try {
      const response = await fetch(
        `/api/admin/accounts/${encodeURIComponent(targetId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revision,
            status: next,
            reason,
            requestKey: retry.current.requestKey,
          }),
        },
      );
      const result: unknown = await response.json().catch(() => null);
      const safeMessage =
        typeof result === "object" &&
        result !== null &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : undefined;
      setFailed(!response.ok);
      setMessage(
        response.ok
          ? "Local action recorded. Reloaded access and history appear on this page."
          : (safeMessage ??
              "The local action could not be recorded. Reload the account and try again."),
      );
      if (response.ok) {
        retry.current = null;
        startRefresh(() => router.refresh());
      }
    } catch {
      setFailed(true);
      setMessage(
        "We could not confirm the local action. Retry with the same fields or reload to check its history.",
      );
    } finally {
      busy.current = false;
      setSaving(false);
      dialog.current?.close();
      requestAnimationFrame(() => notice.current?.focus());
    }
  }
  return (
    <section className="mt-12 max-w-xl">
      <h2 className="text-section-title">Change local account access</h2>
      <p className="mt-4 max-w-prose text-body">
        Suspension denies restricted Learli actions while retaining session and
        reservation records. Restoration changes only account access; other
        permissions, tutor review and reservation expiry still apply.
      </p>
      <form
        className="mt-4 space-y-4"
        aria-busy={pending}
        onSubmit={prepare}
        noValidate
      >
        <div className="space-y-2">
          <label className="block text-label" htmlFor="restriction-reason">
            Local test reason
          </label>
          <select
            key={status}
            className="field"
            id="restriction-reason"
            name="reason"
            ref={reasonControl}
            aria-invalid={reasonError}
            aria-describedby={reasonError ? "reason-error" : undefined}
            defaultValue=""
          >
            <option value="">Choose a local test reason</option>
            {(next === "suspended"
              ? (["local_access_test", "local_review_test"] as const)
              : (["local_restore_test"] as const)
            ).map((r) => (
              <option key={r} value={r}>
                {reasonLabels[r]}
              </option>
            ))}
          </select>
          {reasonError && (
            <p
              id="reason-error"
              className="flex items-center gap-2 text-body text-error"
              role="alert"
            >
              <CircleAlert aria-hidden="true" className="size-4" />
              Choose a local test reason.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          <button className="action action-primary" aria-disabled={pending}>
            {pending && (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 motion-safe:animate-spin"
              />
            )}
            {pending ? "Recording local action…" : `${verb} local account`}
          </button>
          <button
            type="button"
            className="action action-outline"
            aria-disabled={reading}
            onClick={() => {
              if (!reading) startReading(() => router.refresh());
            }}
          >
            Reload account
          </button>
        </div>
      </form>
      {reading && (
        <p role="status" className="mt-4 text-body">
          Loading account…
        </p>
      )}
      {message && (
        <p
          ref={notice}
          tabIndex={-1}
          role={failed ? "alert" : "status"}
          className={`mt-4 flex items-start gap-2 text-body ${failed ? "text-error" : "text-success"}`}
        >
          {failed ? (
            <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />
          ) : (
            <CircleCheck aria-hidden="true" className="mt-1 size-4 shrink-0" />
          )}
          {message}
        </p>
      )}
      <ConfirmDialog
        ref={dialog}
        title={`${verb} ${name}?`}
        confirmLabel={
          pending ? "Recording local action…" : `${verb} account access`
        }
        dismissLabel={pending ? "Close confirmation" : "Keep current access"}
        destructive={next === "suspended"}
        pending={pending}
        onConfirm={confirm}
      >
        {pending && (
          <p className="mb-4">
            Closing this dialog cannot cancel the submitted local action.
          </p>
        )}
        <p className="wrap-anywhere">
          {next === "suspended"
            ? `${name} will be denied restricted Learli actions; existing sessions and reservations stay stored.`
            : `${name} will regain account access subject to current permissions; tutor approval and reservation expiry stay unchanged.`}
        </p>
      </ConfirmDialog>
    </section>
  );
}
