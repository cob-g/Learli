import type { IncomingMessage, ServerResponse } from "node:http";
import type { HostedAuthConfig } from "./config";
import { normalizedIp } from "./ingress";

/** Require raw transport peer and unambiguous proxy headers before Next sees a request. */
export function admitHostedIngress(
  config: HostedAuthConfig,
  request: IncomingMessage,
): boolean {
  const counts = new Map<string, number>();
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    const name = request.rawHeaders[index].toLowerCase();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const contract = config.ingress;
  const peer = normalizedIp(request.socket.remoteAddress ?? "");
  const ip =
    contract.mode === "trusted-proxy" &&
    contract.clientIp === "overwritten-single-header"
      ? normalizedIp(String(request.headers["x-forwarded-for"] ?? ""))
      : "0.0.0.0";
  const mutates = !["GET", "HEAD"].includes(request.method ?? "");
  if (
    contract.mode !== "trusted-proxy" ||
    !peer ||
    !contract.trustedPeerAddresses.some((p) => normalizedIp(p) === peer) ||
    ["host", "origin", "x-forwarded-proto", "x-forwarded-for"].some(
      (name) => (counts.get(name) ?? 0) > 1,
    ) ||
    request.headers.host !== new URL(config.origin).host ||
    request.headers["x-forwarded-proto"] !== "https" ||
    !ip ||
    ((mutates || request.headers.origin !== undefined) &&
      request.headers.origin !== config.origin)
  )
    return false;
  const retained: string[] = [];
  for (let i = 0; i < request.rawHeaders.length; i += 2) {
    const name = request.rawHeaders[i].toLowerCase();
    if (
      name.startsWith("x-learli-") ||
      [
        "forwarded",
        "x-forwarded-host",
        "x-forwarded-for",
        "x-forwarded-proto",
        "x-real-ip",
        "cf-connecting-ip",
      ].includes(name)
    ) {
      delete request.headers[name];
    } else retained.push(request.rawHeaders[i], request.rawHeaders[i + 1]);
  }
  const envelope = {
    "x-learli-ingress-token": config.ingressSecret,
    "x-learli-ingress-host": new URL(config.origin).host,
    "x-learli-ingress-proto": "https",
    "x-learli-client-ip": ip,
  };
  for (const [name, value] of Object.entries(envelope)) {
    request.headers[name] = value;
    retained.push(name, value);
  }
  request.rawHeaders = retained;
  return true;
}
export function hostedResponseHeaders(response: ServerResponse) {
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Robots-Tag", "noindex, nofollow");
}
