import { sql } from "drizzle-orm";
import { tutorProfiles, tutorTeachingLanguages } from "@/lib/db/schema";
import type { TeachingLanguageCode } from "./teaching-languages";

/** Read the complete declaration set in the same statement as its profile. */
export function teachingLanguagesSelection() {
  return sql<TeachingLanguageCode[]>`coalesce((
    select array_agg(${tutorTeachingLanguages.languageCode}::text order by ${tutorTeachingLanguages.languageCode})
    from ${tutorTeachingLanguages}
    where ${tutorTeachingLanguages.tutorId} = ${tutorProfiles.id}
  ), ARRAY[]::text[])`;
}
