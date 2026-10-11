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
      <div className="mx-auto max-w-xl">
        <h1 className="text-page-title">Get matched</h1>
        <p className="mt-4 text-small text-muted-foreground">
          Question{" "}
          {match.step === "level" ? 1 : match.step === "subject" ? 2 : 3} of 3
        </p>
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
          <form method="get" className="mt-2">
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
              <div className="mt-2">
                <ChoiceError
                  id="choice-error"
                  message={match.error}
                  focusField={match.step}
                />
              </div>
              {match.step === "level" ? (
                <div className="mt-2 flex flex-col">
                  {learnerLevelOptions.map(([value, label]) => (
                    <label
                      key={value}
                      className="inline-flex min-h-11 items-center gap-2 text-body"
                    >
                      <input
                        type="radio"
                        className="size-5"
                        name="level"
                        value={value}
                        defaultChecked={match.level === value}
                        required
                      />
                      {label}
                    </label>
                  ))}
                </div>
              ) : (
                groupSubjects(match.choices).map((group) => (
                  <div key={group.category} className="mt-4">
                    <h2 className="text-label text-muted-foreground">
                      {group.label}
                    </h2>
                    <div className="flex flex-col">
                      {group.subjects.map((subject) => (
                        <label
                          key={subject.slug}
                          className="inline-flex min-h-11 items-center gap-2 text-body"
                        >
                          <input
                            type="radio"
                            className="size-5"
                            name="subject"
                            value={subject.slug}
                            defaultChecked={match.subject === subject.slug}
                            required
                          />
                          {subject.name}
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
