"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";

const unreachable =
  "We couldn't reach Learli. Check your connection, then try again.";

async function send(url: string, method: "POST" | "PATCH", body: unknown) {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return null;
    const failure: unknown = await response.json().catch(() => null);
    return typeof failure === "object" &&
      failure !== null &&
      "message" in failure &&
      typeof failure.message === "string" &&
      failure.message
      ? failure.message
      : "That change wasn't saved. Try again.";
  } catch {
    return unreachable;
  }
}

export function AddSubjectForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; failed: boolean }>();
  const noticeRef = useRef<HTMLParagraphElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "");
    setPending(true);
    setNotice(undefined);
    const failure = await send("/api/admin/subjects", "POST", { name });
    if (failure) setNotice({ text: failure, failed: true });
    else {
      form.reset();
      setNotice({ text: "Subject added.", failed: false });
      router.refresh();
    }
    setPending(false);
    requestAnimationFrame(() => noticeRef.current?.focus());
  }

  return (
    <form className="max-w-md space-y-4" onSubmit={submit} aria-busy={pending}>
      <div className="space-y-2">
        <label htmlFor="subject-name" className="block text-label">
          Subject name
        </label>
        <input
          className="field"
          id="subject-name"
          name="name"
          required
          minLength={2}
          maxLength={60}
          aria-describedby="subject-name-help"
        />
        <p id="subject-name-help" className="text-small text-muted-foreground">
          Add a specialized subject only when a tutor offers it.
        </p>
      </div>
      {notice && (
        <p
          ref={noticeRef}
          tabIndex={-1}
          role={notice.failed ? "alert" : "status"}
          className={notice.failed ? "text-body text-error" : "text-body"}
        >
          {notice.text}
        </p>
      )}
      <button
        className="action action-primary"
        type="submit"
        aria-disabled={pending}
      >
        {pending ? "Adding subject…" : "Add subject"}
      </button>
    </form>
  );
}

export function SubjectStateButton({
  subject,
  tile = false,
}: {
  subject: { id: string; name: string; isActive: boolean };
  /** Admin subject tile presentation; the request is unchanged. */
  tile?: boolean;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [saving, setSaving] = useState(false);
  const pending = saving || refreshing;
  const [error, setError] = useState("");
  const verb = subject.isActive ? "Deactivate" : "Activate";

  async function toggle() {
    if (pending) return;
    setSaving(true);
    setError("");
    const failure = await send(
      `/api/admin/subjects/${encodeURIComponent(subject.id)}`,
      "PATCH",
      { isActive: !subject.isActive },
    );
    if (failure) setError(failure);
    else startRefresh(() => router.refresh());
    setSaving(false);
  }

  return (
    <div className={tile ? "subject-toggle" : "flex flex-col items-end gap-2"}>
      <button
        type="button"
        className={
          tile && !subject.isActive
            ? "action action-primary"
            : "action action-outline"
        }
        aria-label={`${verb} ${subject.name}`}
        aria-disabled={pending}
        onClick={toggle}
      >
        {pending && !error ? "Updating…" : verb}
      </button>
      {error && (
        <p role="alert" className="text-small text-error">
          {error}
        </p>
      )}
    </div>
  );
}
