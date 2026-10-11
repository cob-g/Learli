"use client";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { categoryLabels } from "./input";

const subscribeToHydration = () => () => {};
const hydratedSnapshot = () => true;
const serverSnapshot = () => false;

export function CaseForm({
  concern = false,
  bookingId,
}: {
  concern?: boolean;
  bookingId?: string;
}) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    hydratedSnapshot,
    serverSnapshot,
  );
  const busy = useRef(false);
  const key = useRef<string | null>(null);
  const notice = useRef<HTMLParagraphElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    key.current ??= crypto.randomUUID();
    busy.current = true;
    setPending(true);
    setMessage("");
    setFields({});
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey: key.current,
          category: data.get("category"),
          subject: data.get("subject"),
          body: data.get("body"),
          ...(bookingId ? { bookingId } : {}),
        }),
      });
      const result = await response.json();
      if (response.ok && typeof result.id === "string") {
        router.push(`/support/${result.id}`);
        router.refresh();
        return;
      }
      const errors: Record<string, string> = {};
      for (const field of ["subject", "category", "body"])
        if (typeof result.fields?.[field] === "string")
          errors[field] = result.fields[field];
      setFields(errors);
      setMessage(
        typeof result.message === "string"
          ? result.message
          : "Report could not be saved. Try again.",
      );
      // A validation refusal did not create a case; a corrected request starts afresh.
      if (response.status === 400 || response.status === 409)
        key.current = null;
    } catch {
      setMessage(
        "Report could not be saved. Check your connection and try again.",
      );
    } finally {
      busy.current = false;
      setPending(false);
      requestAnimationFrame(() =>
        (
          form.querySelector<HTMLElement>('[aria-invalid="true"]') ??
          notice.current
        )?.focus(),
      );
    }
  }
  return (
    <form
      className="mt-8 max-w-xl space-y-4"
      method="post"
      onSubmit={save}
      noValidate
      aria-busy={pending}
    >
      <p className="text-small text-muted-foreground">
        All fields are required. Use fictional details only.
      </p>
      {!hydrated && (
        <p className="text-small text-muted-foreground">
          Saving fictional reports requires JavaScript. If this message remains,
          enable JavaScript and reload to use this local test form.
        </p>
      )}
      <div className="space-y-2">
        <label className="block text-label" htmlFor="category">
          Category
        </label>
        <select
          className={`field ${fields.category ? "border-error" : ""}`}
          id="category"
          name="category"
          defaultValue={concern ? "safety" : "general"}
          aria-invalid={!!fields.category}
          aria-describedby={fields.category ? "category-error" : undefined}
        >
          {Object.entries(categoryLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {fields.category && (
          <p id="category-error" className="text-small text-error">
            {fields.category}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label className="block text-label" htmlFor="subject">
          Subject
        </label>
        <input
          className={`field ${fields.subject ? "border-error" : ""}`}
          id="subject"
          name="subject"
          required
          maxLength={120}
          autoComplete="off"
          aria-invalid={!!fields.subject}
          aria-describedby={fields.subject ? "subject-error" : undefined}
        />
        {fields.subject && (
          <p id="subject-error" className="text-small text-error">
            {fields.subject}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label className="block text-label" htmlFor="body">
          Fictional description
        </label>
        <textarea
          className={`field min-h-40 ${fields.body ? "border-error" : ""}`}
          id="body"
          name="body"
          required
          maxLength={2000}
          aria-invalid={!!fields.body}
          aria-describedby={fields.body ? "body-error" : "body-help"}
        />
        <p
          id="body-help"
          className="max-w-prose text-small text-muted-foreground"
        >
          Describe a made-up issue in 2000 characters or fewer.
        </p>
        {fields.body && (
          <p id="body-error" className="text-small text-error">
            {fields.body}
          </p>
        )}
      </div>
      {message && (
        <p
          ref={notice}
          tabIndex={-1}
          role="alert"
          className="flex max-w-prose items-start gap-2 text-body text-error"
        >
          <CircleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
          {message}
        </p>
      )}
      <button
        type="submit"
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
        {pending ? "Saving fictional report…" : "Save fictional report"}
      </button>
    </form>
  );
}
