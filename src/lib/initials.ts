/** First and last initials for an avatar; empty when no name is known. */
export function nameInitials(name: string | undefined) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return [words[0], words.length > 1 ? words.at(-1) : undefined]
    .map((word) => (word ? [...word][0] : ""))
    .join("")
    .toLocaleUpperCase("en");
}
