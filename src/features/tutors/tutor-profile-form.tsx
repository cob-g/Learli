"use client";

import {
  ArrowRight,
  Check,
  CircleAlert,
  Globe,
  LoaderCircle,
} from "lucide-react";
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
import {
  teachingLanguageCodes,
  teachingLanguageLabels,
  type TeachingLanguageCode,
} from "./teaching-languages";
import "./tutor-profile.css";
import { nameInitials } from "@/lib/initials";

const shortLevels: Record<LearnerLevel, string> = {
  elementary: "Elem.",
  middle_school: "Middle",
  high_school: "High",
  college_support: "College",
};
type Draft = {
  headline: string;
  bio: string;
  teachingBackground: string;
  timezone: string;
  languages: string[];
};
function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className="profile-count" aria-hidden="true">
      {value.length.toLocaleString("en-US")} / {max.toLocaleString("en-US")}
    </span>
  );
}
type Selection = Record<string, { levels: LearnerLevel[]; specialty: string }>;
type FieldErrors = Partial<Record<TutorProfileField, string>>;
export type TutorProfileFormValues = {
  headline: string;
  bio: string;
  teachingBackground: string;
  teachingLanguages: TeachingLanguageCode[];
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
  previewName = "",
  previewTag = "Not public yet",
}: {
  initial: TutorProfileFormValues | null;
  /** A rejected profile: saving it sends it for review again. */
  resubmitting?: boolean;
  subjects: CatalogSubject[];
  timeZones: TimeZoneOption[];
  defaultTimeZone: string;
  /** The tutor's display name, shown only in the learner preview. */
  previewName?: string;
  previewTag?: string;
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
  // Display only: the uncontrolled fields are still read from FormData on submit.
  const [draft, setDraft] = useState<Draft>(() => ({
    headline: initial?.headline ?? "",
    bio: initial?.bio ?? "",
    teachingBackground: initial?.teachingBackground ?? "",
    timezone: initial?.timezone ?? defaultTimeZone,
    languages: initial?.teachingLanguages ?? [],
  }));
  const [dirty, setDirty] = useState(false);
  const offeringsRef = useRef<HTMLFieldSetElement>(null);

  function edited() {
    setDirty(true);
    setNotice((current) => (current?.failed ? current : undefined));
  }

  function toggleLevel(subjectId: string, level: LearnerLevel, on: boolean) {
    edited();
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
          teachingLanguages: data.getAll("teachingLanguages"),
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
        setDirty(false);
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
      requestAnimationFrame(() => {
        const invalid = document.querySelector<HTMLElement>(
          '[aria-label="Tutor profile"] [aria-invalid="true"]',
        );
        if (invalid) invalid.focus();
        else noticeRef.current?.focus();
      });
    }
  }

  const zoneLabel =
    timeZones.find((zone) => zone.value === draft.timezone)?.label ??
    draft.timezone;
  const offered = groupSubjects(subjects)
    .flatMap((group) => group.subjects)
    .flatMap((subject) => {
      const levels = selection[subject.id]?.levels ?? [];
      return levels.length ? [{ subject, levels }] : [];
    });
  const submitLabel = pending
    ? creating
      ? "Submitting application…"
      : "Saving profile…"
    : creating
      ? "Submit application"
      : "Save profile";
  return (
    <form
      className="profile-layout"
      onSubmit={submit}
      onInput={(event) => {
        const data = new FormData(event.currentTarget);
        edited();
        setDraft({
          headline: String(data.get("headline") ?? ""),
          bio: String(data.get("bio") ?? ""),
          teachingBackground: String(data.get("teachingBackground") ?? ""),
          timezone: String(data.get("timezone") ?? ""),
          languages: data.getAll("teachingLanguages").map(String),
        });
      }}
      aria-busy={pending}
      aria-label="Tutor profile"
    >
      <div className="profile-stack">
        <section className="profile-card" aria-labelledby="profile-about-title">
          <h2 id="profile-about-title" className="profile-section-title">
            <span className="profile-num" aria-hidden="true">
              01
            </span>
            About you
          </h2>
          <p className="profile-required">
            All fields are required unless marked optional.
          </p>
          <div className="profile-field">
            <div className="profile-field-top">
              <label htmlFor="headline" className="text-label">
                Headline
              </label>
              <Counter value={draft.headline} max={100} />
            </div>
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
            <p id="headline-help" className="profile-help">
              One line that says what you teach. 100 characters or fewer.
            </p>
            <FieldError id="headline-error" message={errors.headline} />
          </div>
          <div className="profile-field">
            <div className="profile-field-top">
              <label htmlFor="bio" className="text-label">
                Introduction
              </label>
              <Counter value={draft.bio} max={1500} />
            </div>
            <textarea
              className="field"
              id="bio"
              name="bio"
              rows={5}
              defaultValue={initial?.bio}
              required
              maxLength={1500}
              aria-invalid={!!errors.bio}
              aria-describedby="bio-help bio-error"
            />
            <p id="bio-help" className="profile-help">
              Tell learners and families how you teach. 1,500 characters or
              fewer.
            </p>
            <FieldError id="bio-error" message={errors.bio} />
          </div>
          <div className="profile-field">
            <div className="profile-field-top">
              <label htmlFor="teachingBackground" className="text-label">
                Teaching background
              </label>
              <Counter value={draft.teachingBackground} max={1000} />
            </div>
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
            <p id="background-help" className="profile-help">
              Describe your experience and qualifications in your own words.
              1,000 characters or fewer.
            </p>
            <FieldError
              id="background-error"
              message={errors.teachingBackground}
            />
          </div>
          <div className="profile-field">
            <label htmlFor="timezone" className="text-label">
              Time zone
            </label>
            <span className="profile-select">
              <Globe size={18} aria-hidden="true" />
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
            </span>
            <p id="timezone-help" className="profile-help">
              Choose the time zone you teach from. If you have weekly hours,
              change this on the{" "}
              <Link href="/tutor/availability">Availability page</Link>.
            </p>
            <FieldError id="timezone-error" message={errors.timezone} />
          </div>
        </section>
        <section className="profile-card">
          <fieldset aria-describedby="languages-help languages-error">
            <legend className="profile-section-title">
              <span className="profile-num" aria-hidden="true">
                02
              </span>
              Teaching languages{" "}
              <span className="profile-optional">(optional)</span>
            </legend>
            <p id="languages-help" className="profile-section-help">
              Choose the languages you use to teach. These are your
              declarations; Learli has not checked your proficiency.
            </p>
            <div className="profile-chips">
              {teachingLanguageCodes.map((code) => (
                <label key={code} className="profile-chip">
                  <input
                    type="checkbox"
                    name="teachingLanguages"
                    value={code}
                    defaultChecked={
                      initial?.teachingLanguages.includes(code) ?? false
                    }
                    aria-invalid={!!errors.teachingLanguages}
                    aria-describedby="languages-help languages-error"
                  />
                  <span aria-hidden="true">
                    <Check size={10} />
                  </span>
                  {teachingLanguageLabels[code]}
                </label>
              ))}
            </div>
            <FieldError
              id="languages-error"
              message={errors.teachingLanguages}
            />
          </fieldset>
        </section>
        <section className="profile-card">
          <fieldset
            ref={offeringsRef}
            aria-describedby="offerings-help offerings-error"
          >
            <legend className="profile-section-title">
              <span className="profile-num" aria-hidden="true">
                03
              </span>
              Subjects and levels
            </legend>
            <p id="offerings-help" className="profile-section-help">
              Choose every level you teach for each subject. Leave a subject
              unchecked if you do not teach it.
            </p>
            <FieldError id="offerings-error" message={errors.offerings} />
            {groupSubjects(subjects).map((group) => (
              <div key={group.category} className="profile-group">
                <h2>{group.label}</h2>
                {group.subjects.map((subject) => {
                  const entry = selection[subject.id];
                  const count = entry?.levels.length ?? 0;
                  return (
                    <fieldset
                      key={subject.id}
                      className="profile-subject"
                      data-on={count > 0 || undefined}
                    >
                      <legend>{subject.name}</legend>
                      <span
                        className="profile-subject-count"
                        aria-hidden="true"
                      >
                        {count === 0
                          ? "Not taught"
                          : count === learnerLevelOptions.length
                            ? "All levels"
                            : `${count} of ${learnerLevelOptions.length} levels`}
                      </span>
                      <div className="profile-chips">
                        {learnerLevelOptions.map(([level, label]) => (
                          <label key={level} className="profile-chip">
                            <input
                              type="checkbox"
                              checked={entry?.levels.includes(level) ?? false}
                              onChange={(event) =>
                                toggleLevel(
                                  subject.id,
                                  level,
                                  event.target.checked,
                                )
                              }
                            />
                            <span aria-hidden="true">
                              <Check size={10} />
                            </span>
                            {label}
                          </label>
                        ))}
                      </div>
                      {entry && entry.levels.length > 0 && (
                        <div className="profile-specialty">
                          <label htmlFor={`specialty-${subject.id}`}>
                            {subject.name} specialty{" "}
                            <span className="profile-optional">(optional)</span>
                          </label>
                          <input
                            className="field"
                            id={`specialty-${subject.id}`}
                            maxLength={120}
                            value={entry.specialty}
                            onChange={(event) => {
                              edited();
                              setSelection((current) => ({
                                ...current,
                                [subject.id]: {
                                  ...current[subject.id],
                                  specialty: event.target.value,
                                },
                              }));
                            }}
                          />
                        </div>
                      )}
                    </fieldset>
                  );
                })}
              </div>
            ))}
          </fieldset>
        </section>
        <div className="workspace-savebar">
          <div className="workspace-save-state">
            {notice ? (
              <p
                ref={noticeRef}
                tabIndex={-1}
                role={notice.failed ? "alert" : "status"}
                data-state={notice.failed ? "error" : "saved"}
              >
                {notice.text}
              </p>
            ) : (
              <p data-state={dirty ? "dirty" : undefined}>
                <i aria-hidden="true" />
                {dirty ? "Unsaved changes" : "No unsaved changes"}
              </p>
            )}
          </div>
          <button
            className="action workspace-action"
            type="submit"
            aria-disabled={pending}
          >
            {submitLabel}
            <span className="workspace-action-icon" aria-hidden="true">
              {pending ? (
                <LoaderCircle size={13} className="motion-safe:animate-spin" />
              ) : (
                <ArrowRight size={13} />
              )}
            </span>
          </button>
        </div>
      </div>
      <section
        className="profile-preview"
        aria-labelledby="profile-preview-title"
      >
        <div className="profile-preview-head" data-surface="inverse">
          <div className="profile-preview-kicker">
            <h2 id="profile-preview-title">Learner preview</h2>
            <em>{previewTag}</em>
          </div>
          <div className="profile-preview-who">
            <span aria-hidden="true">{nameInitials(previewName) || "?"}</span>
            <div className="min-w-0">
              <b>{previewName || "Your name"}</b>
              <small>{zoneLabel}</small>
            </div>
          </div>
          <p
            className="profile-preview-headline"
            data-empty={!draft.headline.trim() || undefined}
          >
            {draft.headline.trim() || "Add a headline"}
          </p>
        </div>
        <div className="profile-preview-body">
          <div>
            <h3>Introduction</h3>
            <p className="profile-preview-intro">{draft.bio.trim() || "—"}</p>
          </div>
          <div>
            <h3>Languages</h3>
            {draft.languages.length ? (
              <p className="profile-preview-tags">
                {draft.languages.map((code) => (
                  <span key={code}>
                    {teachingLanguageLabels[code as TeachingLanguageCode] ??
                      code}
                  </span>
                ))}
              </p>
            ) : (
              <p className="profile-preview-none">No languages selected</p>
            )}
          </div>
          <div>
            <h3>Subjects</h3>
            {offered.length ? (
              <ul className="profile-preview-subjects">
                {offered.map(({ subject, levels }) => (
                  <li key={subject.id}>
                    <b>{subject.name}</b>
                    <span>
                      {levels.length === learnerLevelOptions.length
                        ? "All levels"
                        : learnerLevelOptions
                            .filter(([level]) => levels.includes(level))
                            .map(([level]) => shortLevels[level])
                            .join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="profile-preview-none">No subjects selected</p>
            )}
          </div>
        </div>
        <p className="profile-preview-foot">
          Updates as you edit. Learners see this once your profile is public.
        </p>
      </section>
    </form>
  );
}
