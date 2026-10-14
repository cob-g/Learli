import "server-only";

/** The same local default as APP_URL in `src/lib/env/schema.ts`. */
const localOrigin = "http://localhost:3000";
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function configuredOrigin() {
  const value = process.env.APP_URL;
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  return url.protocol === "https:" || url.protocol === "http:" ? url : null;
}

/**
 * The origin this deployment is served from, for canonical and share URLs.
 * It comes from APP_URL alone: the public domain is not decided, so none is
 * written into the code. Any path or credentials in the value are dropped.
 */
export function siteOrigin() {
  return new URL((configuredOrigin() ?? new URL(localOrigin)).origin);
}

/**
 * Whether search engines may index this deployment. Indexing waits for the
 * approved public launch, so it stays closed until the owner opens it with
 * SEARCH_INDEXING=open, and then only for a stated production environment on a
 * real HTTPS origin. Development, test, staging, an unset or unknown
 * environment, and a loopback or plain-HTTP origin never qualify. Like the
 * preview gate, it reads its variables directly so the answer cannot depend on
 * unrelated configuration.
 */
export function indexingAllowed() {
  if (process.env.SEARCH_INDEXING !== "open") return false;
  if (process.env.APP_ENV !== "production") return false;
  const origin = configuredOrigin();
  return origin?.protocol === "https:" && !loopbackHosts.has(origin.hostname);
}
