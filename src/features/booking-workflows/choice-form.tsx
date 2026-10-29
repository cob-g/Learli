"use client";

import { useMemo, useState } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import type { TimeZoneOption } from "@/lib/time/zones";
import {
  bookingSubjects,
  bookingTutors,
  type BookingLearnerChoice,
  type BookingTutorChoice,
} from "./choice-options";

type InitialChoice = {
  learnerId: string;
  subjectSlug: string;
  tutorSlug: string;
  displayTimezone: string;
};

type RequestedTime = {
  level: string;
  startAtUtc: string;
  endAtUtc: string;
};

export function BookingChoiceForm({
  learners,
  tutors,
  zones,
  initial,
  requestedTime,
  scopeHint,
  privateWorkflow,
}: {
  learners: BookingLearnerChoice[];
  tutors: BookingTutorChoice[];
  zones: TimeZoneOption[];
  initial: InitialChoice;
  requestedTime?: RequestedTime;
  scopeHint?: "guardian" | "student";
  privateWorkflow: boolean;
}) {
  const hydrated = useHydrated();
  const initialLearner = learners.find(
    (learner) => learner.id === initial.learnerId,
  );
  const initialSubjects = bookingSubjects(tutors, initialLearner?.level);
  const compatibleInitialSubject = initialSubjects.some(
    (subject) => subject.value === initial.subjectSlug,
  )
    ? initial.subjectSlug
    : "";
  const initialTutors = bookingTutors(
    tutors,
    initialLearner?.level,
    compatibleInitialSubject || undefined,
  );
  const initialTutorCompatible = initialTutors.some(
    (tutor) => tutor.slug === initial.tutorSlug,
  );
  const [learnerId, setLearnerId] = useState(initialLearner?.id ?? "");
  const [subjectSlug, setSubjectSlug] = useState(compatibleInitialSubject);
  const [tutorSlug, setTutorSlug] = useState(
    initialTutorCompatible ? initial.tutorSlug : "",
  );
  const [displayTimezone, setDisplayTimezone] = useState(
    zones.some((zone) => zone.value === initial.displayTimezone)
      ? initial.displayTimezone
      : (zones[0]?.value ?? "UTC"),
  );
  const [keepRequestedTime, setKeepRequestedTime] = useState(
    !initial.learnerId ||
      (!!initialLearner &&
        compatibleInitialSubject === initial.subjectSlug &&
        initialTutorCompatible),
  );
  const learner = learners.find((row) => row.id === learnerId);
  // Native GET choices stay usable across learner changes before enhancement.
  const subjects = useMemo(
    () => bookingSubjects(tutors, hydrated ? learner?.level : undefined),
    [hydrated, learner?.level, tutors],
  );
  const compatibleTutors = useMemo(
    () =>
      bookingTutors(
        tutors,
        hydrated ? learner?.level : undefined,
        hydrated ? subjectSlug || undefined : undefined,
      ),
    [hydrated, learner?.level, subjectSlug, tutors],
  );

  function choicesChanged() {
    setKeepRequestedTime(false);
  }

  return (
    <form
      method="get"
      action={privateWorkflow ? "/bookings/new" : undefined}
      className="mt-6 max-w-xl space-y-4"
    >
      {scopeHint && <input type="hidden" name="scope" value={scopeHint} />}
      {keepRequestedTime && requestedTime && (
        <>
          <input type="hidden" name="level" value={requestedTime.level} />
          <input
            type="hidden"
            name="startAtUtc"
            value={requestedTime.startAtUtc}
          />
          <input type="hidden" name="endAtUtc" value={requestedTime.endAtUtc} />
        </>
      )}
      <div>
        <label htmlFor="learnerId" className="text-label">
          Learner
        </label>
        <select
          required
          id="learnerId"
          name="learnerId"
          className="field mt-2"
          value={learnerId}
          onChange={(event) => {
            const nextLearnerId = event.target.value;
            const nextLevel = learners.find(
              (row) => row.id === nextLearnerId,
            )?.level;
            const nextSubjects = bookingSubjects(tutors, nextLevel);
            const nextSubject = nextSubjects.some(
              (row) => row.value === subjectSlug,
            )
              ? subjectSlug
              : "";
            const nextTutors = bookingTutors(
              tutors,
              nextLevel,
              nextSubject || undefined,
            );
            const tutorStillEligible = nextTutors.some(
              (row) => row.slug === tutorSlug,
            );
            setLearnerId(nextLearnerId);
            setSubjectSlug(nextSubject);
            if (!tutorStillEligible) setTutorSlug("");
            // Choosing the learner for a time picked on a tutor profile keeps
            // that time; only a learner it no longer fits clears it. The
            // server still rechecks availability and eligibility.
            if (
              nextLevel !== requestedTime?.level ||
              nextSubject !== subjectSlug ||
              !tutorStillEligible
            )
              choicesChanged();
          }}
        >
          <option value="">Choose learner</option>
          {learners.map((row) => (
            <option key={row.id} value={row.id}>
              {row.displayName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="subjectSlug" className="text-label">
          Subject
        </label>
        <select
          required
          id="subjectSlug"
          name="subjectSlug"
          className="field mt-2"
          value={subjectSlug}
          onChange={(event) => {
            const nextSubject = event.target.value;
            const nextTutors = bookingTutors(
              tutors,
              learner?.level,
              nextSubject || undefined,
            );
            setSubjectSlug(nextSubject);
            if (!nextTutors.some((row) => row.slug === tutorSlug))
              setTutorSlug("");
            choicesChanged();
          }}
        >
          <option value="">Choose subject</option>
          {subjects.map((row) => (
            <option key={row.value} value={row.value}>
              {row.label}
            </option>
          ))}
        </select>
        {learner && subjects.length === 0 && (
          <p className="mt-2 text-small text-muted-foreground">
            No subjects currently have an eligible tutor for this learner level.
          </p>
        )}
      </div>
      <div>
        <label htmlFor="tutorSlug" className="text-label">
          Tutor
        </label>
        <select
          required
          id="tutorSlug"
          name="tutorSlug"
          className="field mt-2"
          value={tutorSlug}
          onChange={(event) => {
            setTutorSlug(event.target.value);
            choicesChanged();
          }}
        >
          <option value="">Choose tutor</option>
          {compatibleTutors.map((row) => (
            <option key={row.slug} value={row.slug}>
              {row.displayName}
            </option>
          ))}
        </select>
        {learner && subjectSlug && compatibleTutors.length === 0 && (
          <p className="mt-2 text-small text-muted-foreground">
            No eligible tutor currently offers this subject at the selected
            education level.
          </p>
        )}
      </div>
      <div>
        <label htmlFor="displayTimezone" className="text-label">
          Time zone
        </label>
        <select
          required
          id="displayTimezone"
          name="displayTimezone"
          className="field mt-2"
          value={displayTimezone}
          onChange={(event) => {
            setDisplayTimezone(event.target.value);
          }}
        >
          {zones.map((row) => (
            <option key={row.value} value={row.value}>
              {row.label}
            </option>
          ))}
        </select>
      </div>
      <button className="action action-outline" type="submit">
        {privateWorkflow ? "Show available times" : "Load synthetic times"}
      </button>
    </form>
  );
}
