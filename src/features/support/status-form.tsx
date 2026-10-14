"use client";
import {
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { statusLabels, transitions, type CaseStatus } from "./input";

const subscribeToHydration = () => () => {};
const hydratedSnapshot = () => true;
const serverSnapshot = () => false;

export function StatusForm({
  caseId,
  status,
  revision,
}: {
  caseId: string;
  status: CaseStatus;
  revision: number;
}) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    hydratedSnapshot,
    serverSnapshot,
  );
  const busy = useRef(false);
  const notice = useRef<HTMLParagraphElement>(null);
  const [refreshing, startRefresh] = useTransition();
  const [saving, setSaving] = useState(false);
  const pending = saving || refreshing;
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !hydrated || refreshing) return;
    busy.current = true;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/support/${caseId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision,
          status: new FormData(event.currentTarget).get("status"),
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      const safeMessage =
        typeof result === "object" &&
        result !== null &&
        "message" in result &&
        typeof result.message === "string" &&
        result.message
          ? result.message
          : undefined;
      setFailed(!response.ok);
      setMessage(
        response.ok
          ? "Case status saved"
          : (safeMessage ?? "Case status could not be saved."),
      );
      if (response.ok) startRefresh(() => router.refresh());
    } catch {
      setFailed(true);
      setMessage(
        "Case status could not be saved. Check your connection and try again.",
      );
    } finally {
      busy.current = false;
      setSaving(false);
      requestAnimationFrame(() => notice.current?.focus());
    }
  }
  return (
    <section className="mt-12 max-w-xl">
      <h2 className="text-section-title">Change local status</h2>
      <form
        method="post"
        className="mt-4 space-y-4"
        onSubmit={save}
        aria-busy={pending}
      >
        <div className="space-y-2">
          <label htmlFor="status" className="block text-label">
            Next status
          </label>
          <select key={status} className="field" id="status" name="status">
            {transitions[status].map((next) => (
              <option value={next} key={next}>
                {statusLabels[next]}
              </option>
            ))}
          </select>
        </div>
        {message && (
          <p
            ref={notice}
            tabIndex={-1}
            role={failed ? "alert" : "status"}
            className={`flex items-start gap-2 text-body ${failed ? "text-error" : "text-success"}`}
          >
            {failed ? (
              <CircleAlert
                className="mt-1 size-4 shrink-0"
                aria-hidden="true"
              />
            ) : (
              <CircleCheck
                className="mt-1 size-4 shrink-0"
                aria-hidden="true"
              />
            )}
            {message}
          </p>
        )}
        <div className="flex flex-wrap gap-4">
          <button
            className="action action-primary transition-none"
            disabled={!hydrated}
            aria-disabled={!hydrated || pending}
          >
            {pending && (
              <LoaderCircle
                className="size-4 motion-safe:animate-spin"
                aria-hidden="true"
              />
            )}
            {pending ? "Saving status…" : "Save case status"}
          </button>
          <button
            className="action action-outline"
            type="button"
            onClick={() => router.refresh()}
          >
            Reload case
          </button>
        </div>
      </form>
      <noscript>
        <p className="mt-4 text-body">
          Enable JavaScript to change local case status. Case details and
          history remain readable.
        </p>
      </noscript>
    </section>
  );
}
