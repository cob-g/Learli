"use client";
import { useRef, useState, type FormEvent } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { learnerLevelOptions } from "@/features/subjects/catalog";
import type { TimeZoneOption } from "@/lib/time/zones";
import type { PrivateLearner } from "./service";

export function LearnerForm({
  profile,
  zones,
  reviewed = false,
}: {
  profile: PrivateLearner;
  zones: TimeZoneOption[];
  reviewed?: boolean;
}) {
  const router = useRouter();
  const ready = useHydrated();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const noticeRef = useRef<HTMLParagraphElement>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setNotice("");
    setFields({});
    try {
      const response = await fetch(`/api/learners/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: data.get("displayName"),
          ...(!reviewed ? { level: data.get("level") } : {}),
          timezone: data.get("timezone"),
        }),
      });
      setFailed(!response.ok);
      if (response.ok) {
        setNotice("Profile saved");
        router.refresh();
      } else {
        const result = await response.json();
        const errors: Record<string, string> = {};
        for (const key of ["displayName", "level", "timezone"]) {
          if (typeof result.fields?.[key] === "string")
            errors[key] = result.fields[key];
        }
        setFields(errors);
        setNotice(
          "Profile could not be saved. Check the fields and your account access, then try again.",
        );
      }
    } catch {
      setFailed(true);
      setNotice(
        "Profile could not be saved. Check your connection and try again.",
      );
    } finally {
      setPending(false);
      requestAnimationFrame(() => {
        const invalidField = form.querySelector<HTMLElement>(
          '[aria-invalid="true"]',
        );
        (invalidField ?? noticeRef.current)?.focus();
      });
    }
  }

  return (
    <form
      className="mt-8 max-w-xl space-y-4"
      onSubmit={save}
      method="post"
      action={`/api/learners/${profile.id}`}
      aria-busy={pending}
      noValidate
    >
      <noscript>
        <p className="text-body">
          JavaScript is required to edit a local demonstration profile. You can
          still view your learners.
        </p>
      </noscript>
      <p className="text-small text-muted-foreground">
        All fields are required.
      </p>
      <div className="space-y-2">
        <label className="block text-label" htmlFor="displayName">
          Display name
        </label>
        <input
          className="field"
          id="displayName"
          name="displayName"
          disabled={!ready}
          defaultValue={profile.displayName}
          maxLength={80}
          required
          autoComplete="off"
          aria-invalid={!!fields.displayName}
          aria-describedby={
            fields.displayName ? "displayName-error" : undefined
          }
        />
        {fields.displayName && (
          <p className="text-small text-error" id="displayName-error">
            {fields.displayName}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label className="block text-label" htmlFor="level">
          Level
        </label>
        <select
          className="field"
          id="level"
          name="level"
          disabled={!ready || reviewed}
          defaultValue={profile.level}
          aria-invalid={!!fields.level}
          aria-describedby={fields.level ? "level-error" : undefined}
        >
          {learnerLevelOptions
            .filter(
              ([value]) =>
                profile.management !== "self" || value === "college_support",
            )
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </select>
        {fields.level && (
          <p className="text-small text-error" id="level-error">
            {fields.level}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label className="block text-label" htmlFor="timezone">
          Time zone
        </label>
        <select
          className="field"
          id="timezone"
          name="timezone"
          disabled={!ready}
          defaultValue={profile.timezone}
          aria-invalid={!!fields.timezone}
          aria-describedby={fields.timezone ? "timezone-error" : undefined}
        >
          {zones.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {fields.timezone && (
          <p className="text-small text-error" id="timezone-error">
            {fields.timezone}
          </p>
        )}
      </div>
      {notice && (
        <p
          ref={noticeRef}
          tabIndex={-1}
          role={failed ? "alert" : "status"}
          className={`flex items-start gap-2 text-body ${failed ? "text-error" : "text-success"}`}
        >
          {failed ? (
            <CircleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <CircleCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />
          )}
          {notice}
        </p>
      )}
      <button
        type="submit"
        className="action action-primary"
        disabled={!ready || pending}
      >
        {pending && (
          <LoaderCircle
            className="size-4 motion-safe:animate-spin"
            aria-hidden="true"
          />
        )}
        {pending ? "Saving profile…" : "Save profile"}
      </button>
    </form>
  );
}
