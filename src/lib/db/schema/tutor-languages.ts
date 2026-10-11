import { pgEnum, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { teachingLanguageCodes } from "../../../features/tutors/teaching-languages";
import { tutorProfiles } from "./app";

export const teachingLanguageCode = pgEnum(
  "teaching_language_code",
  teachingLanguageCodes,
);

/** Optional declaration set: no row means the tutor has not listed a language. */
export const tutorTeachingLanguages = pgTable(
  "tutor_teaching_languages",
  {
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: "cascade" }),
    languageCode: teachingLanguageCode("language_code").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tutorId, table.languageCode] })],
);
