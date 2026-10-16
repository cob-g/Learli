import { getPrivateWorkflow } from "@/features/private-workflow/runtime";
import type { AuthRuntime } from "@/lib/auth-factory";
import { hostedHeadersAllowed, hostedProviderHeaders } from "./ingress";

export function isHostedRuntime(runtime: AuthRuntime) {
  return "hosted" in runtime;
}
export function accountHeadersAllowed(
  runtime: AuthRuntime,
  headers: Headers,
  mutation = false,
) {
  return (
    !isHostedRuntime(runtime) ||
    ("hosted" in runtime &&
      hostedHeadersAllowed(runtime.hosted, headers, mutation))
  );
}
export function providerHeaders(
  runtime: AuthRuntime,
  source: Headers,
  mutation = false,
) {
  if ("hosted" in runtime)
    return hostedProviderHeaders(runtime.hosted, source, mutation);
  const headers = new Headers(source);
  headers.set("x-learli-local-ip", "127.0.0.1");
  return headers;
}
export function permitsAccountEmail(runtime: AuthRuntime, email: string) {
  const privateWorkflow = getPrivateWorkflow(runtime);
  if (privateWorkflow && !privateWorkflow.accountEmails.includes(email))
    return false;
  return !("hosted" in runtime) || runtime.hosted.accountEmails.includes(email);
}
