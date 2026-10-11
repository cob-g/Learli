"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  groupSubjects,
  learnerLevelOptions,
  type CatalogSubject,
} from "@/features/subjects/catalog";
import type { LearnerLevel } from "@/lib/db/schema/app";
import type { TimeZoneOption } from "@/lib/time/zones";
import type { TutorProfileField } from "./input";

type Selection = Record<string, { levels: LearnerLevel[]; specialty: string }>;
type FieldErrors = Partial<Record<TutorProfileField, string>>;
export type TutorProfileFormValues = {
  headline: string;
  bio: string;
  teachingBackground: string;
  timezone: string;
  offerings: {
    subjectId: string;
    levels: LearnerLevel[];
    specialty: string | null;
  }[];
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-start gap-1 text-small text-error">
      <CircleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

export function TutorProfileForm({
  initial,
  resubmitting = false,
  subjects,
  timeZones,
  defaultTimeZone,
}: {
  initial: TutorProfileFormValues | null;
  /** A rejected profile: saving it sends it for review again. */
  resubmitting?: boolean;
  subjects: CatalogSubject[];
  timeZones: TimeZoneOption[];
  defaultTimeZone: string;
}) {
  const router = useRouter();
  const creating = !initial || resubmitting;
  const [selection, setSelection] = useState<Selection>(() =>
    Object.fromEntries(
      (initial?.offerings ?? [])
        // A subject deactivated since the last save is no longer selectable.
        .filter((offering) =>
          subjects.some((subject) => subject.id === offering.subjectId),
        )
        .map((offering) => [
          offering.subjectId,
          { levels: offering.levels, specialty: offering.specialty ?? "" },
        ]),
    ),
  );
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<{ text: string; failed: boolean }>();
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const offeringsRef = useRef<HTMLFieldSetElement>(null);

  function toggleLevel(subjectId: string, level: LearnerLevel, on: boolean) {
    if (on) setErrors((current) => ({ ...current, offerings: undefined }));
    setSelection((current) => {
      const entry = current[subjectId] ?? { levels: [], specialty: "" };
      const levels = on
        ? [...entry.levels, level]
        : entry.levels.filter((value) => value !== level);
      return { ...current, [subjectId]: { ...entry, levels } };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const offerings = Object.entries(selection)
      .filter(([, entry]) => entry.levels.length > 0)
      .map(([subjectId, entry]) => ({
        subjectId,
        levels: entry.levels,
        ...(entry.specialty.trim()
          ? { specialty: entry.specialty.trim() }
          : {}),
      }));
    if (offerings.length === 0) {
      setNotice(undefined);
      setErrors({
        offerings: "Choose at least one subject and a level you teach it at.",
      });
      offeringsRef.current?.querySelector("input")?.focus();
      return;
    }
    const data = new FormData(event.currentTarget);
    setPending(true);
    setNotice(undefined);
    setErrors({});
    try {
      const response = await fetch("/api/tutor/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: data.get("headline"),
          bio: data.get("bio"),
          teachingBackground: data.get("teachingBackground"),
          timezone: data.get("timezone"),
          offerings,
        }),
      });
      const body: {
        submitted?: boolean;
        message?: string;
        fields?: FieldErrors;
      } = await response.json().catch(() => ({}));
      if (response.ok) {
        setNotice({
          text: body.submitted ? "Application submitted." : "Profile saved.",
          failed: false,
        });
        router.refresh();
      } else {
        setErrors(body.fields ?? {});
        setNotice({
          text: body.message ?? "Your profile wasn't saved. Try again.",
          failed: true,
        });
      }
    } catch {
      setNotice({
        text: "We couldn't reach Learli. Check your connection, then try again.",
        failed: true,
      });
    } finally {
      setPending(false);
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  return (
    <form
      className="max-w-xl space-y-6"
      onSubmit={submit}
      aria-busy={pending}
      aria-label="Tutor profile"
    >
      <p className="text-small text-muted-foreground">
        All fields are required unless marked optional.
      </p>
      <div className="space-y-2">
        <label htmlFor="headline" className="block text-label">
          Headline
        </label>
        <input
          className="field"
          id="headline"
          name="headline"
          defaultValue={initial?.headline}
          required
          maxLength={100}
          aria-invalid={!!errors.headline}
          aria-describedby="headline-help headline-error"
        />
        <p id="headline-help" className="text-small text-muted-foreground">
          One line that says what you teach. 100 characters or fewer.
        </p>
        <FieldError id="headline-error" message={errors.headline} />
      </div>
      <div className="space-y-2">
        <label htmlFor="bio" className="block text-label">
          Introduction
        </label>
        <textarea
          className="field"
          id="bio"
          name="bio"
          rows={6}
          defaultValue={initial?.bio}
          required
          maxLength={1500}
          aria-invalid={!!errors.bio}
          aria-describedby="bio-help bio-error"
        />
        <p id="bio-help" className="text-small text-muted-foreground">
          Tell learners and families how you teach. 1,500 characters or fewer.
        </p>
        <FieldError id="bio-error" message={errors.bio} />
      </div>
      <div className="space-y-2">
        <label htmlFor="teachingBackground" className="block text-label">
          Teaching background
        </label>
        <textarea
          className="field"
          id="teachingBackground"
          name="teachingBackground"
          rows={4}
          defaultValue={initial?.teachingBackground}
          required
          maxLength={1000}
          aria-invalid={!!errors.teachingBackground}
          aria-describedby="background-help background-error"
        />
        <p id="background-help" className="text-small text-muted-foreground">
          Describe your experience and qualifications in your own words. 1,000
          characters or fewer.
        </p>
        <FieldError id="background-error" message={errors.teachingBackground} />
      </div>
      <div className="space-y-2">
        <label htmlFor="timezone" className="block text-label">
          Time zone
        </label>
        <select
          className="field"
          id="timezone"
          name="timezone"
          defaultValue={initial?.timezone ?? defaultTimeZone}
          aria-invalid={!!errors.timezone}
          aria-describedby="timezone-help timezone-error"
        >
          {timeZones.map((zone) => (
            <option key={zone.value} value={zone.value}>
              {zone.label}
            </option>
          ))}
        </select>
        <p id="timezone-help" className="text-small text-muted-foreground">
          Choose the time zone you teach from. If you have weekly hours, change
          this on the <Link href="/tutor/availability">Availability page</Link>.
        </p>
        <FieldError id="timezone-error" message={errors.timezone} />
      </div>
      <fieldset
        ref={offeringsRef}
        aria-describedby="offerings-help offerings-error"
      >
        <legend className="text-item-title">Subjects and levels</legend>
        <p
          id="offerings-help"
          className="mt-2 text-small text-muted-foreground"
        >
          Choose every level you teach for each subject. Leave a subject
          unchecked if you do not teach it.
        </p>
        <div className="mt-2">
          <FieldError id="offerings-error" message={errors.offerings} />
        </div>
        {groupSubjects(subjects).map((group) => (
          <div key={group.category} className="mt-6">
            <h2 className="text-label text-muted-foreground">{group.label}</h2>
            {group.subjects.map((subject) => {
              const entry = selection[subject.id];
              return (
                <fieldset
                  key={subject.id}
                  className="mt-2 border-b border-border pb-2"
                >
                  <legend className="text-body">{subject.name}</legend>
                  <div className="flex flex-wrap gap-x-6">
                    {learnerLevelOptions.map(([level, label]) => (
                      <label
                        key={level}
                        className="inline-flex min-h-11 items-center gap-2 text-body"
                      >
                        <input
                          type="checkbox"
                          className="size-5"
                          checked={entry?.levels.includes(level) ?? false}
                          onChange={(event) =>
                            toggleLevel(subject.id, level, event.target.checked)
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {entry && entry.levels.length > 0 && (
                    <div className="mb-2 space-y-2">
                      <label
                        htmlFor={`specialty-${subject.id}`}
                        className="block text-label"
                      >
                        {subject.name} specialty{" "}
                        <span className="text-caption text-muted-foreground">
                          (optional)
                        </span>
                      </label>
                      <input
                        className="field"
                        id={`specialty-${subject.id}`}
                        maxLength={120}
                        value={entry.specialty}
                        onChange={(event) =>
                          setSelection((current) => ({
                            ...current,
                            [subject.id]: {
                              ...current[subject.id],
                              specialty: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>
        ))}
      </fieldset>
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
        {pending && (
          <LoaderCircle
            size={16}
            aria-hidden="true"
            className="motion-safe:animate-spin motion-reduce:hidden"
          />
        )}
        {pending
          ? creating
            ? "Submitting application…"
            : "Saving profile…"
          : creating
            ? "Submit application"
            : "Save profile"}
      </button>
    </form>
  );
}
