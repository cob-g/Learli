import Link from "next/link";
import {
  groupSubjects,
  learnerLevelOptions,
} from "@/features/subjects/catalog";
import { listTimeZoneOptions } from "@/lib/time/zones";
import type { MatchStep } from "./match";
import { matchingHref, preferenceDraft, type MatchParams } from "./preferences";
import { ChoiceError, PreferenceInputs, WhenForm } from "./when-form";

export function MatchQuestions({
  match,
  params,
}: {
  match: Exclude<MatchStep, { step: "ready" }>;
  params: MatchParams;
}) {
  const draft = preferenceDraft(params);
  const browse = (
    <Link className="inline-flex min-h-11 items-center" href="/tutors">
      Browse all tutors
    </Link>
  );
  const answers = {
    level: match.level,
    subject:
      typeof match.subject === "string" ? match.subject : match.subject?.slug,
    preferences: match.preferences,
  };
  return (
    <div className="page-shell page-space">
      <div className="max-w-2xl">
        <h1 className="text-page-title">Get matched</h1>
        <p className="mt-4 text-small text-muted-foreground">
          Question{" "}
          {match.step === "level" ? 1 : match.step === "subject" ? 2 : 3} of 3
        </p>
        <ol
          aria-label="Matching steps"
          className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-b border-border pb-6 text-small"
        >
          {(["level", "subject", "when"] as const).map((step, index) => (
            <li
              key={step}
              aria-current={match.step === step ? "step" : undefined}
              className={
                match.step === step ? "text-deep-teal" : "text-muted-foreground"
              }
            >
              {index + 1}.{" "}
              {step === "level"
                ? "Learner level"
                : step === "subject"
                  ? "Subject"
                  : "Available time"}
            </li>
          ))}
        </ol>
        {match.step === "when" ? (
          <WhenForm
            key={JSON.stringify(params)}
            level={match.level}
            subject={match.subject.slug}
            preferences={match.preferences}
            draft={draft}
            fields={match.fields}
            zones={listTimeZoneOptions(
              new Date(),
              draft.timezone ? [draft.timezone] : [],
            )}
          />
        ) : (
          <form method="get" className="mt-6">
            <input
              type="hidden"
              name="change"
              value={match.step === "level" ? "subject" : "when"}
            />
            <PreferenceInputs preferences={match.preferences} />
            {match.step === "level" && match.subject && (
              <input type="hidden" name="subject" value={match.subject} />
            )}
            {match.step === "subject" && (
              <input type="hidden" name="level" value={match.level} />
            )}
            <fieldset
              aria-invalid={!!match.error}
              aria-describedby={match.error ? "choice-error" : undefined}
            >
              <legend className="text-section-title">
                {match.step === "level"
                  ? "Which level is the learner at?"
                  : "Which subject do you need help with?"}
              </legend>
              <div className="mt-6">
                <ChoiceError
                  id="choice-error"
                  message={match.error}
                  focusField={match.step}
                />
              </div>
              {match.step === "level" ? (
                <div className="mt-6 flex flex-col gap-3">
                  {learnerLevelOptions.map(([value, label]) => (
                    <label
                      key={value}
                      className="group flex min-h-12 cursor-pointer items-center gap-3 rounded-control border border-control bg-surface px-4 py-3 text-body has-checked:border-primary has-checked:bg-primary has-checked:text-on-inverse has-checked:[--focus-ring:var(--focus-ring-inverse)] has-checked:[&_.text-muted-foreground]:text-on-inverse"
                    >
                      <input
                        type="radio"
                        className="size-5 shrink-0"
                        name="level"
                        value={value}
                        defaultChecked={match.level === value}
                        required
                      />
                      <span className="min-w-0 wrap-anywhere">{label}</span>
                      <span
                        aria-hidden="true"
                        className="ms-auto hidden size-2 shrink-0 rounded-full bg-brand-teal group-has-checked:block"
                      />
                    </label>
                  ))}
                </div>
              ) : (
                groupSubjects(match.choices).map((group) => (
                  <div key={group.category} className="mt-4">
                    <h2 className="text-label text-muted-foreground">
                      {group.label}
                    </h2>
                    <div className="mt-3 flex flex-col gap-3">
                      {group.subjects.map((subject) => (
                        <label
                          key={subject.slug}
                          className="group flex min-h-12 cursor-pointer items-center gap-3 rounded-control border border-control bg-surface px-4 py-3 text-body has-checked:border-primary has-checked:bg-primary has-checked:text-on-inverse has-checked:[--focus-ring:var(--focus-ring-inverse)] has-checked:[&_.text-muted-foreground]:text-on-inverse"
                        >
                          <input
                            type="radio"
                            className="size-5 shrink-0"
                            name="subject"
                            value={subject.slug}
                            defaultChecked={match.subject === subject.slug}
                            required
                          />
                          <span className="min-w-0 wrap-anywhere">
                            {subject.name}
                          </span>
                          <span
                            aria-hidden="true"
                            className="ms-auto hidden size-2 shrink-0 rounded-full bg-brand-teal group-has-checked:block"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </fieldset>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
              <button className="action action-primary" type="submit">
                Continue
              </button>
              {match.step === "subject" && (
                <Link
                  className="inline-flex min-h-11 items-center"
                  href={matchingHref(answers, "level")}
                >
                  Back
                </Link>
              )}
              {browse}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
