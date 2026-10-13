import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { HostedAuthConfig } from "./config";
import { HostedAuthError } from "./config";

export function normalizedIp(value: string): string | undefined {
  if (!isIP(value) || /[\s,%]/.test(value)) return;
  if (isIP(value) === 4) return value;
  const canonical = new URL(`http://[${value}]`).hostname.slice(1, -1);
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(canonical);
  if (!mapped) return canonical;
  const upper = parseInt(mapped[1], 16),
    lower = parseInt(mapped[2], 16);
  return `${upper >> 8}.${upper & 255}.${lower >> 8}.${lower & 255}`;
}
export function stripForwarding(headers: Headers) {
  for (const name of [...headers.keys()])
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
    )
      headers.delete(name);
}
function sameSecret(candidate: string | null, secret: string) {
  if (!candidate || Buffer.byteLength(candidate) !== Buffer.byteLength(secret))
    return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(secret));
}
/** Only the same-process Node ingress may mint this private envelope. */
export function hostedHeadersAllowed(
  config: HostedAuthConfig,
  headers: Headers,
  mutation: boolean,
) {
  return (
    config.ingress.mode === "trusted-proxy" &&
    sameSecret(headers.get("x-learli-ingress-token"), config.ingressSecret) &&
    headers.get("host") === new URL(config.origin).host &&
    headers.get("x-learli-ingress-host") === new URL(config.origin).host &&
    headers.get("x-learli-ingress-proto") === "https" &&
    !!normalizedIp(headers.get("x-learli-client-ip") ?? "") &&
    ((!mutation && !headers.has("origin")) ||
      headers.get("origin") === config.origin)
  );
}
export function hostedProviderHeaders(
  config: HostedAuthConfig,
  source: Headers,
  mutation = false,
) {
  if (!hostedHeadersAllowed(config, source, mutation))
    throw new HostedAuthError("ingress");
  const ip = normalizedIp(source.get("x-learli-client-ip")!)!;
  const headers = new Headers(source);
  stripForwarding(headers);
  headers.set("x-learli-client-ip", ip);
  headers.delete("content-length");
  return headers;
}
