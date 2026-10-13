import "server-only";

const previewEnvironments = new Set(["development", "test", "staging"]);

/**
 * Whether design-preview content (the sample reviews) may be rendered.
 * Only in an environment that is stated and is not production: an unset or
 * unknown value shows nothing rather than invented reviews. It reads the one
 * variable directly so the answer cannot depend on unrelated configuration.
 */
export function previewContentAllowed() {
  return previewEnvironments.has(process.env.APP_ENV ?? "");
}
