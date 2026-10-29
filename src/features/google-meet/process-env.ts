/** Process-specific credentials. Next loads .env.local itself, so the empty web
 * override is intentional: deleting the key would let dotenv restore the URL. */
export function googleMeetChildEnvironments(
  source: Record<string, string | undefined>,
) {
  const web: NodeJS.ProcessEnv = {
    ...source,
    NODE_ENV: "development",
    GOOGLE_MEET_WORKER_DATABASE_URL: "",
  };
  const worker: NodeJS.ProcessEnv = { NODE_ENV: "development" };
  for (const key of [
    "PATH",
    "NODE_OPTIONS",
    "TZ",
    "FORCE_COLOR",
    "NO_COLOR",
    "APP_ENV",
    "APP_URL",
    "AUTH_MODE",
    "DATABASE_MODE",
    "LOCAL_WORKFLOW_MODE",
    "GOOGLE_MEET_ENABLED",
    "GOOGLE_MEET_CLIENT_ID",
    "GOOGLE_MEET_CLIENT_SECRET",
    "GOOGLE_MEET_REDIRECT_URI",
    "GOOGLE_MEET_KEY_ID",
    "GOOGLE_MEET_KEYS",
    "GOOGLE_MEET_WORKER_DATABASE_URL",
  ])
    worker[key] = source[key];
  return { web, worker };
}
