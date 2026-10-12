import type {
  APIRequestContext,
  APIResponse,
  Page,
  Route,
} from "@playwright/test";

export const protectedFailureMessage =
  "Cross-browser protected operation failed; sensitive details omitted.";

/** Keep rejection/exit semantics without retaining SDK messages, stacks or causes. */
export async function protectedOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new Error(protectedFailureMessage);
  }
}

export function privateGet(
  client: Pick<APIRequestContext, "get">,
  ...args: Parameters<APIRequestContext["get"]>
) {
  return protectedOperation(() => client.get(...args));
}
export function privatePost(
  client: Pick<APIRequestContext, "post">,
  ...args: Parameters<APIRequestContext["post"]>
) {
  return protectedOperation(() => client.post(...args));
}
export function privatePut(
  client: Pick<APIRequestContext, "put">,
  ...args: Parameters<APIRequestContext["put"]>
) {
  return protectedOperation(() => client.put(...args));
}
export function privateJson(response: Pick<APIResponse, "json">) {
  return protectedOperation(() => response.json());
}
export function privateText(response: Pick<APIResponse, "text">) {
  return protectedOperation(() => response.text());
}
export function privateRouteFetch(
  route: Pick<Route, "fetch">,
  ...args: Parameters<Route["fetch"]>
) {
  return protectedOperation(() => route.fetch(...args));
}
export function privateContinue(
  route: Pick<Route, "continue">,
  ...args: Parameters<Route["continue"]>
) {
  return protectedOperation(() => route.continue(...args));
}
export function privateAbort(
  route: Pick<Route, "abort">,
  ...args: Parameters<Route["abort"]>
) {
  return protectedOperation(() => route.abort(...args));
}
export function privateGoto(
  page: Pick<Page, "goto">,
  ...args: Parameters<Page["goto"]>
) {
  return protectedOperation(() => page.goto(...args));
}
export function privateReload(
  page: Pick<Page, "reload">,
  ...args: Parameters<Page["reload"]>
) {
  return protectedOperation(() => page.reload(...args));
}
export function privateBack(
  page: Pick<Page, "goBack">,
  ...args: Parameters<Page["goBack"]>
) {
  return protectedOperation(() => page.goBack(...args));
}
