import { levelNames } from "@/features/subjects/catalog";
import type { TutorProfile } from "./service";
import { teachingLanguageNames } from "./teaching-languages";

/** Read-only view of what a tutor wrote. Their text is rendered as text. */
export function ProfileSummary({
  profile,
  timeZone,
}: {
  profile: Pick<
    TutorProfile,
    | "headline"
    | "bio"
    | "teachingBackground"
    | "teachingLanguages"
    | "offerings"
  >;
  timeZone: string;
}) {
  return (
    <dl className="max-w-3xl space-y-8 rounded-surface border border-border bg-surface p-6 sm:p-8">
      <div>
        <dt className="text-label text-muted-foreground">Headline</dt>
        <dd className="mt-2 text-item-title wrap-break-word text-primary">
          {profile.headline}
        </dd>
      </div>
      <div>
        <dt className="text-label text-muted-foreground">Introduction</dt>
        <dd className="mt-2 max-w-prose font-reading text-reading wrap-break-word whitespace-pre-line">
          {profile.bio}
        </dd>
      </div>
      <div>
        <dt className="text-label text-muted-foreground">
          Teaching background
        </dt>
        <dd className="mt-2 max-w-prose font-reading text-reading wrap-break-word whitespace-pre-line">
          {profile.teachingBackground}
        </dd>
      </div>
      <div>
        <dt className="text-label text-muted-foreground">Teaching languages</dt>
        <dd className="mt-1 text-body">
          {teachingLanguageNames(profile.teachingLanguages).join(" · ") ||
            "No teaching languages listed"}
        </dd>
      </div>
      <div>
        <dt className="text-label text-muted-foreground">Time zone</dt>
        <dd className="mt-1 text-body">{timeZone}</dd>
      </div>
      <div>
        <dt className="text-label text-muted-foreground">
          Subjects and levels
        </dt>
        <dd className="mt-1">
          <ul className="divide-y divide-border border-y border-border">
            {profile.offerings.map((offering) => (
              <li key={offering.subjectId} className="py-4">
                <p className="text-body">
                  {offering.name}
                  {offering.isActive ? "" : " (not currently offered)"}
                </p>
                <p className="text-small text-muted-foreground">
                  {levelNames(offering.levels).join(" · ")}
                </p>
                {offering.specialty && (
                  <p className="text-small wrap-break-word text-muted-foreground">
                    Specialty: {offering.specialty}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </dd>
      </div>
    </dl>
  );
}
