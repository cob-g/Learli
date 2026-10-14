"use client";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { assignmentKinds, assignmentInput } from "./dispatch-input";
import type { DispatchDetail } from "./dispatch-service";
const subscribeToHydration = () => () => {};
const hydratedSnapshot = () => true;
const serverSnapshot = () => false;
export function AssignmentForm({ detail }: { detail: DispatchDetail }) {
  const router = useRouter(),
    busy = useRef(false),
    notice = useRef<HTMLParagraphElement>(null),
    reviewer = useRef<HTMLSelectElement>(null);
  const retry = useRef<{ fingerprint: string; requestKey: string } | null>(
    null,
  );
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    hydratedSnapshot,
    serverSnapshot,
  );
  const [refreshing, startRefresh] = useTransition();
  const [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [fieldError, setFieldError] = useState(false),
    [blocked, setBlocked] = useState(false);
  const pending = saving || refreshing;
  useEffect(() => {
    if (message) notice.current?.focus();
  }, [message]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !hydrated || blocked) return;
    const form = new FormData(event.currentTarget),
      values = {
        revision: detail.revision,
        reviewerId: form.get("reviewer"),
        kind: form.get("kind"),
      };
    const fingerprint = JSON.stringify(values);
    if (retry.current?.fingerprint !== fingerprint)
      retry.current = { fingerprint, requestKey: crypto.randomUUID() };
    const input = assignmentInput.safeParse({
      ...values,
      requestKey: retry.current.requestKey,
    });
    if (!input.success) {
      setFieldError(true);
      reviewer.current?.focus();
      return;
    }
    busy.current = true;
    setSaving(true);
    setFieldError(false);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/support/dispatch/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.data),
      });
      const result: unknown = await response.json().catch(() => null);
      const safeMessage =
        typeof result === "object" &&
        result !== null &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : undefined;
      setFailed(!response.ok);
      if (
        response.status === 403 ||
        response.status === 404 ||
        response.status === 401
      ) {
        window.location.reload();
        return;
      }
      setMessage(
        response.ok
          ? "Local assignment recorded"
          : (safeMessage ??
              "The assignment could not be recorded. Reload the case and try again."),
      );
      if (response.ok) {
        retry.current = null;
        startRefresh(() => router.refresh());
      } else if (response.status === 409) setBlocked(true);
    } catch {
      setFailed(true);
      setBlocked(true);
      setMessage(
        "We could not confirm the assignment. Reload the case to check its history before starting another action.",
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <section className="mt-8 max-w-xl">
      <h2 className="text-section-title">Change local assignment</h2>
      <p className="mt-4 max-w-prose text-body">
        Escalation reassigns this fictional case to another provisioned
        reviewer. It does not notify anyone or promise a response.
      </p>
      {detail.status === "closed" ? (
        <p className="mt-4 max-w-prose text-body">
          This case is closed. Its currently authorized reviewer must reopen it
          before an assignment can change.
        </p>
      ) : !detail.choices.length ? (
        <p className="mt-4 max-w-prose text-body">
          No eligible alternative reviewer is provisioned for this case. The
          local fixture owner must provision a case-specific choice.
        </p>
      ) : (
        <form
          method="post"
          onSubmit={save}
          className="mt-4 space-y-4"
          noValidate
          aria-busy={pending}
        >
          <div className="space-y-2">
            <label className="block text-label" htmlFor="assignment-reviewer">
              Reviewer fixture
            </label>
            <select
              key={detail.revision}
              ref={reviewer}
              className="field"
              id="assignment-reviewer"
              name="reviewer"
              defaultValue=""
              aria-invalid={fieldError}
              aria-describedby={
                fieldError ? "assignment-reviewer-error" : undefined
              }
              disabled={pending || blocked}
            >
              <option value="">Choose a reviewer</option>
              {detail.choices.map((choice) => (
                <option value={choice.id} key={choice.id}>
                  {choice.name}
                </option>
              ))}
            </select>
            {fieldError && (
              <p
                id="assignment-reviewer-error"
                role="alert"
                className="flex items-center gap-2 text-body text-error"
              >
                <CircleAlert className="size-4" aria-hidden="true" />
                Choose a reviewer.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="block text-label" htmlFor="assignment-kind">
              Local action
            </label>
            <select
              className="field"
              id="assignment-kind"
              name="kind"
              disabled={pending || blocked}
            >
              {(detail.assigned
                ? (["reassign", "escalate"] as const)
                : (["assign"] as const)
              ).map((kind) => (
                <option key={kind} value={kind}>
                  {assignmentKinds[kind]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-4">
            <button
              className="action action-primary transition-none"
              disabled={!hydrated || pending || blocked}
            >
              {pending && (
                <LoaderCircle
                  className="size-4 motion-safe:animate-spin"
                  aria-hidden="true"
                />
              )}
              {pending ? "Recording assignment…" : "Record local assignment"}
            </button>
            <a
              className="action action-outline"
              href={`/admin/support/dispatch/${detail.id}`}
            >
              Reload assignment
            </a>
          </div>
        </form>
      )}
      {message && (
        <p
          ref={notice}
          tabIndex={-1}
          role={failed ? "alert" : "status"}
          className={`mt-4 flex items-start gap-2 text-body ${failed ? "text-error" : "text-success"}`}
        >
          {failed ? (
            <CircleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <CircleCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />
          )}
          {message}
        </p>
      )}

      {!hydrated && (
        <p className="mt-4 text-body">
          Enable JavaScript to change local assignment. Case details and history
          remain readable.
        </p>
      )}
      {blocked && (
        <p className="mt-4 text-body">
          Reload assignment to check the current case before making another
          change.
        </p>
      )}
    </section>
  );
}
