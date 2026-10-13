// Test-only fixture setup uses real provider enrollment/verification, never receipts.
import { createHmac } from "node:crypto";
import type { AuthRuntime } from "../../src/lib/auth-factory";
import { handleAuthRequest } from "../../src/lib/auth-handler";
import { sql } from "drizzle-orm";

const secrets = new Map<string, string>();
export function totpCode(base32: string, at = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...base32.toUpperCase().replace(/=+$/, "")]
    .map((c) => {
      const index = alphabet.indexOf(c);
      if (index < 0) throw new Error("Invalid test authenticator key.");
      return index.toString(2).padStart(5, "0");
    })
    .join("");
  const bytes = Buffer.from(
    Array.from({ length: Math.floor(bits.length / 8) }, (_, i) =>
      Number.parseInt(bits.slice(i * 8, i * 8 + 8), 2),
    ),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const hash = createHmac("sha1", bytes).update(counter).digest(),
    offset = hash[19] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
export function mergeCookies(
  cookie: string,
  response: Pick<Response, "headers">,
) {
  const jar = new Map<string, string>();
  for (const part of cookie
    .split(";")
    .concat(response.headers.getSetCookie().map((v) => v.split(";")[0]))) {
    const index = part.indexOf("=");
    if (index > 0) jar.set(part.slice(0, index).trim(), part.slice(index + 1));
  }
  return [...jar].map(([key, value]) => `${key}=${value}`).join("; ");
}
export function mfaRequest(
  runtime: AuthRuntime,
  action: string,
  cookie: string,
  body: unknown,
) {
  return handleAuthRequest(
    runtime,
    new Request(`${runtime.origin}/api/auth/two-factor/${action}`, {
      method: "POST",
      headers: {
        origin: runtime.origin,
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
}
export async function enrollTestAdmin(
  runtime: AuthRuntime,
  cookie: string,
  password: string,
) {
  const current = await runtime.auth.api.getSession({
    headers: new Headers({ cookie }),
  });
  if (!current)
    throw new Error(
      "Test administrator needs an actual signed-in provider session.",
    );
  const role = await runtime.db.execute(
    sql`SELECT 1 FROM public.user_roles WHERE user_id=${current.user.id} AND role='admin'`,
  );
  if (!role.rowCount) return cookie;
  let secret = secrets.get(current.user.id);
  if (!current.user.twoFactorEnabled) {
    const setup = await mfaRequest(runtime, "enable", cookie, { password });
    if (!setup.ok) throw new Error("Provider test enrollment refused.");
    const value = await setup.json();
    secret = value.secret;
    if (typeof secret !== "string")
      throw new Error("Provider test key unavailable.");
    secrets.set(current.user.id, secret);
    secrets.set(current.user.email, secret);
    cookie = mergeCookies(cookie, setup);
  }
  if (!secret) throw new Error("Provider test authenticator unavailable.");
  const verified = await mfaRequest(runtime, "verify-totp", cookie, {
    code: totpCode(secret),
  });
  if (!verified.ok) throw new Error("Provider test verification refused.");
  return mergeCookies(cookie, verified);
}

export async function refreshTestAdmin(
  runtime: AuthRuntime,
  actor: { email: string; cookie: string; headers: Headers },
  password: string,
) {
  const current = await runtime.auth.api.getSession({ headers: actor.headers });
  let cookie = actor.cookie;
  if (!current) {
    const signed = await handleAuthRequest(
      runtime,
      new Request(`${runtime.origin}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { origin: runtime.origin, "content-type": "application/json" },
        body: JSON.stringify({ email: actor.email, password }),
      }),
    );
    if (!signed.ok) throw new Error("Test administrator re-sign-in refused.");
    cookie = mergeCookies("", signed);
    const result = await signed.json();
    if (result.twoFactorRedirect) {
      const secret = secrets.get(actor.email);
      if (!secret) throw new Error("Test authenticator missing.");
      const verified = await mfaRequest(runtime, "verify-totp", cookie, {
        code: totpCode(secret),
      });
      if (!verified.ok)
        throw new Error("Test administrator challenge refused.");
      cookie = mergeCookies(cookie, verified);
    }
  } else cookie = await enrollTestAdmin(runtime, cookie, password);
  actor.cookie = cookie;
  actor.headers = new Headers({ cookie });
}
