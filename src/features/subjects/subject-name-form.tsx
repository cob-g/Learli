"use client";

import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { subjectName, subjectNameHelp } from "./input";

export function SubjectNameForm({
  subject,
}: {
  subject: { id: string; name: string; nameRevision: number };
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const busy = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const [name, setName] = useState(subject.name);
  const [revision, setRevision] = useState(subject.nameRevision);
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [notice, setNotice] = useState<{ text: string; failed: boolean }>();
  const fieldId = `subject-name-${subject.id}`;
  const helpId = `${fieldId}-help`;
  const noticeId = `${fieldId}-notice`;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || busy.current) return;
    const parsed = subjectName.safeParse(name);
    if (!parsed.success) {
      setInvalid(true);
      setNotice({ text: subjectNameHelp, failed: true });
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    busy.current = true;
    setPending(true);
    setInvalid(false);
    setNotice(undefined);
    try {
      const response = await fetch(
        `/api/admin/subjects/${encodeURIComponent(subject.id)}/name`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: parsed.data,
            expectedRevision: revision,
          }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (
        response.ok &&
        subjectName.safeParse(result.name).success &&
        Number.isInteger(result.nameRevision) &&
        result.nameRevision >= 0
      ) {
        setName(result.name);
        setRevision(result.nameRevision);
        setNotice({ text: "Subject name saved.", failed: false });
        router.refresh();
      } else {
        setNotice({
          text:
            typeof result.message === "string"
              ? result.message
              : "We couldn't confirm the change. Reload the current name before trying again.",
          failed: true,
        });
      }
    } catch {
      setNotice({
        text: "We couldn't confirm the change. Check your connection and reload the current name before trying again.",
        failed: true,
      });
    } finally {
      busy.current = false;
      setPending(false);
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  return (
    <details className="mt-2">
      <summary className="min-h-11 cursor-pointer py-2 text-label text-primary underline">
        Edit name<span className="sr-only"> for {subject.name}</span>
      </summary>
      <form
        action={`/api/admin/subjects/${encodeURIComponent(subject.id)}/name`}
        method="post"
        noValidate
        onSubmit={save}
        aria-busy={pending}
        className="mt-4 space-y-4"
      >
        <div className="space-y-2">
          <label htmlFor={fieldId} className="block text-label">
            Display name
          </label>
          <input
            ref={inputRef}
            id={fieldId}
            name="name"
            className="field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={60}
            disabled={!hydrated || pending}
            aria-invalid={invalid}
            aria-describedby={`${helpId}${invalid ? ` ${noticeId}` : ""}`}
          />
          <p
            id={helpId}
            className="max-w-prose text-small text-muted-foreground"
          >
            Correct the name of this specialized subject. Its existing tutor
            offerings and bookings stay linked.
          </p>
        </div>
        {!hydrated && (
          <p className="text-small">Enable JavaScript to edit subject names.</p>
        )}
        {notice && (
          <p
            ref={noticeRef}
            id={noticeId}
            tabIndex={-1}
            role={notice.failed ? "alert" : "status"}
            className={`flex max-w-prose items-start gap-2 text-small ${notice.failed ? "text-error" : "text-success"}`}
          >
            {notice.failed ? (
              <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
            ) : (
              <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
            )}
            {notice.text}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button
            className="action action-outline"
            type="submit"
            disabled={!hydrated}
            aria-disabled={pending}
          >
            {pending && (
              <LoaderCircle
                className="size-4 motion-safe:animate-spin"
                aria-hidden="true"
              />
            )}
            {pending ? "Saving name…" : "Save subject name"}
          </button>
          {notice?.failed && (
            // A full reload resets the draft/revision; client navigation can reuse them.
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a
              className="text-small text-primary underline"
              href="/admin/subjects"
            >
              Reload current name
            </a>
          )}
        </div>
      </form>
    </details>
  );
}
