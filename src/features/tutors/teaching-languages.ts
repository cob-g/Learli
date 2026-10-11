/** Selectable declarations, not verified proficiency or a promise of coverage. */
export const teachingLanguageCodes = [
  "ar",
  "ceb",
  "zh",
  "en",
  "fil",
  "fr",
  "de",
  "hi",
  "ja",
  "ko",
  "pt",
  "es",
] as const;
export type TeachingLanguageCode = (typeof teachingLanguageCodes)[number];

export const teachingLanguageLabels: Record<TeachingLanguageCode, string> = {
  ar: "Arabic",
  ceb: "Cebuano",
  zh: "Chinese",
  en: "English",
  fil: "Filipino",
  fr: "French",
  de: "German",
  hi: "Hindi",
  ja: "Japanese",
  ko: "Korean",
  pt: "Portuguese",
  es: "Spanish",
};

/** Catalogue order is English label order, independent of input/DB row order. */
export function teachingLanguageNames(codes: readonly TeachingLanguageCode[]) {
  return teachingLanguageCodes
    .filter((code) => codes.includes(code))
    .map((code) => teachingLanguageLabels[code]);
}

export function parseTeachingLanguage(value: unknown) {
  return teachingLanguageCodes.find((code) => code === value);
}

export function declaredTeachingLanguages(
  tutors: readonly { teachingLanguages: readonly TeachingLanguageCode[] }[],
) {
  const declared = new Set(tutors.flatMap((tutor) => tutor.teachingLanguages));
  return teachingLanguageCodes.filter((code) => declared.has(code));
}
