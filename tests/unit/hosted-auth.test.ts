import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  symlinkSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import {
  hostedOrigin,
  parseHostedAuthConfig,
} from "@/features/hosted-auth/config";
import { readHostedAuthPacket } from "@/features/hosted-auth/config-file";
import {
  selectHostedSingleton,
  closeHostedSingleton,
  type SingletonState,
} from "@/features/hosted-auth/singleton";
import {
  normalizedIp,
  hostedProviderHeaders,
  hostedHeadersAllowed,
} from "@/features/hosted-auth/ingress";
import { admitHostedIngress } from "@/features/hosted-auth/ingress-node";
import { safeHostedCallback } from "@/features/hosted-auth/callback";
import {
  hostedTestSource,
  hostedTestPacket,
  hostedTestOrigin,
} from "../support/hosted-auth-packet";
import type { IncomingMessage } from "node:http";

const config = () =>
  parseHostedAuthConfig(hostedTestSource(), hostedTestPacket());
function envelope() {
  const c = config();
  return new Headers({
    host: new URL(c.origin).host,
    origin: c.origin,
    "x-learli-ingress-host": new URL(c.origin).host,
    "x-learli-ingress-proto": "https",
    "x-learli-ingress-token": c.ingressSecret,
    "x-learli-client-ip": "0.0.0.0",
  });
}
describe("explicit hosted account admission", () => {
  it("accepts only the staging synthetic packet and freezes its consumed fields", () => {
    const c = config();
    expect(c.database.role).toBe("learli_app");
    expect(Object.isFrozen(c.accountEmails)).toBe(true);
    expect(Object.isFrozen(c.ingress)).toBe(true);
    expect(
      parseHostedAuthConfig(hostedTestSource(), {
        ...hostedTestPacket(),
        ingress: undefined,
        mail: undefined,
      }).ingress.mode,
    ).toBe("disabled");
  });
  it.each(["production", "development", "test"])(
    "refuses %s before provider I/O",
    (APP_ENV) =>
      expect(() =>
        parseHostedAuthConfig(
          { ...hostedTestSource(), APP_ENV },
          hostedTestPacket(),
        ),
      ).toThrow("configuration"),
  );
  it.each([
    "https://127.0.0.1:3293",
    "https://[::1]",
    "https://localhost",
    "https://name.localhost",
    "https://learli.test/",
    "https://USER:PASS@learli.test",
    "https://*.learli.test",
    "https://learli.test?q=1",
    "https://learli.test#x",
    "http://learli.test",
    " https://learli.test",
    "https://learli.test\\evil",
  ])("refuses noncanonical origin %s", (APP_URL) => {
    expect(hostedOrigin(APP_URL)).toBe(false);
    expect(() =>
      parseHostedAuthConfig(
        { ...hostedTestSource(), APP_URL, BETTER_AUTH_URL: APP_URL },
        hostedTestPacket(),
      ),
    ).toThrow();
  });
  it.each([
    { AUTH_MODE: "local" },
    { BETTER_AUTH_URL: "https://other.learli.test" },
    { BETTER_AUTH_SECRET: "short" },
    { BETTER_AUTH_SECRETS: "unaccepted-versioned-provider-key" },
    { HOSTED_INGRESS_SECRET: hostedTestSource().BETTER_AUTH_SECRET },
    { DATABASE_URL: "postgresql://a:b@127.0.0.1:55903/learli_test" },
    { DATABASE_URL_DIRECT: "postgresql://a:b@127.0.0.1:55903/learli_test" },
  ])("refuses mixed or incomplete environment %j", (override) =>
    expect(() =>
      parseHostedAuthConfig(
        { ...hostedTestSource(), ...override },
        hostedTestPacket(),
      ),
    ).toThrow(),
  );
  it.each([
    { accountEmails: [] },
    { accountEmails: ["person@gmail.com"] },
    { accountEmails: ["unlisted@EXAMPLE.TEST"] },
    { accountEmails: ["a@example.test", "a@example.test"] },
  ])("refuses invalid selected account set %j", ({ accountEmails }) =>
    expect(() =>
      parseHostedAuthConfig(hostedTestSource(), {
        ...hostedTestPacket(),
        accountEmails,
      }),
    ).toThrow(),
  );
  it("refuses unapproved database target/unknown packet/migration credentials and mail attestations", () => {
    const p = hostedTestPacket();
    for (const packet of [
      { ...p, realIntake: "enabled" },
      { ...p, extra: "credential" },
      { ...p, target: { ...p.target, environment: "production" } },
      { ...p, target: { ...p.target, database: "learli_production" } },
      {
        ...p,
        STAGING_DATABASE_URL: p.STAGING_DATABASE_URL.replace(
          "learli_app",
          "learli_migrator",
        ),
      },
      {
        ...p,
        mail: {
          ...p.mail,
          transport: {
            ...p.mail.transport,
            allowedRecipients: ["other@example.test"],
          },
        },
      },
      {
        ...p,
        mail: {
          ...p.mail,
          transport: {
            ...p.mail.transport,
            verifiedSender: {
              ...p.mail.transport.verifiedSender,
              sender: "wrong@example.test",
            },
          },
        },
      },
    ])
      expect(() => parseHostedAuthConfig(hostedTestSource(), packet)).toThrow();
  });
});
describe("owned private packet", () => {
  it("reads a bounded owner-only regular file, refuses path/symlink/ancestor/size exposure without printing values", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "learli-w3-"));
    mkdirSync(path.join(root, ".local"), { mode: 0o700 });
    const file = path.join(root, ".local", "packet.json");
    writeFileSync(file, '{"private":"synthetic-private-value"}', {
      mode: 0o600,
    });
    expect(readHostedAuthPacket(root, file)).toEqual({
      private: "synthetic-private-value",
    });
    expect(() => readHostedAuthPacket(root, ".local/packet.json")).toThrow(
      "private_file",
    );
    symlinkSync(file, path.join(root, ".local", "linked"));
    expect(() =>
      readHostedAuthPacket(root, path.join(root, ".local", "linked")),
    ).toThrow();
    chmodSync(file, 0o644);
    expect(() => readHostedAuthPacket(root, file)).toThrow();
    chmodSync(file, 0o600);
    chmodSync(path.join(root, ".local"), 0o755);
    expect(() => readHostedAuthPacket(root, file)).toThrow();
    chmodSync(path.join(root, ".local"), 0o700);
    writeFileSync(file, "x".repeat(65537));
    expect(() => readHostedAuthPacket(root, file)).toThrow();
  });
});
describe("account singleton lifetime", () => {
  it("shares one pending initialization and value, refuses changed configuration, closes once", async () => {
    const state: SingletonState<{ close(): Promise<void> }> = {};
    const close = vi.fn(async () => {}),
      initialize = vi.fn(async () => ({ close }));
    const a = selectHostedSingleton(state, "first", initialize),
      b = selectHostedSingleton(state, "first", initialize);
    expect(a).toBe(b);
    const value = await a;
    expect(await selectHostedSingleton(state, "first", initialize)).toBe(value);
    expect(initialize).toHaveBeenCalledTimes(1);
    await expect(
      selectHostedSingleton(state, "changed", initialize),
    ).rejects.toThrow("configuration");
    await Promise.all([
      closeHostedSingleton(state),
      closeHostedSingleton(state),
    ]);
    expect(close).toHaveBeenCalledTimes(1);
    await expect(
      selectHostedSingleton(state, "first", initialize),
    ).rejects.toThrow();
  });
  it("sanitizes failure, permits retry after cleanup/cooldown, closes pending initialization", async () => {
    const state: SingletonState<{ close(): Promise<void> }> = {};
    await expect(
      selectHostedSingleton(state, "same", async () => {
        throw new Error("private-password");
      }),
    ).rejects.toThrow("Details omitted");
    expect(state.pending).toBeUndefined();
    expect(state.value).toBeUndefined();
    await expect(
      selectHostedSingleton(state, "same", async () => ({
        close: async () => {},
      })),
    ).rejects.toThrow();
    const close = vi.fn(async () => {});
    await selectHostedSingleton(
      state,
      "same",
      async () => ({ close }),
      Date.now() + 2000,
    );
    await closeHostedSingleton(state);
    expect(close).toHaveBeenCalledTimes(1);
    const pending: SingletonState<{ close(): Promise<void> }> = {};
    const ready = selectHostedSingleton(pending, "pending", async () => ({
      close,
    }));
    await closeHostedSingleton(pending);
    await ready;
    expect(close).toHaveBeenCalledTimes(2);
  });
});
describe("ingress proof and safe provider headers", () => {
  it("requires independent envelope/Host/Origin proof, strips forwarding and tokens", () => {
    const c = config(),
      headers = envelope();
    expect(hostedHeadersAllowed(c, headers, true)).toBe(true);
    headers.set("forwarded", "for=attacker");
    headers.set("x-forwarded-host", "evil.example");
    headers.set("x-learli-local-ip", "malicious");
    const provider = hostedProviderHeaders(c, headers, true);
    expect(provider.get("x-learli-client-ip")).toBe("0.0.0.0");
    expect(provider.has("forwarded")).toBe(false);
    expect(provider.has("x-learli-ingress-token")).toBe(false);
    expect(provider.has("x-learli-local-ip")).toBe(false);
    for (const name of [
      "host",
      "origin",
      "x-learli-ingress-host",
      "x-learli-ingress-proto",
      "x-learli-ingress-token",
      "x-learli-client-ip",
    ]) {
      const bad = envelope();
      bad.set(name, "spoof");
      expect(() => hostedProviderHeaders(c, bad, true)).toThrow();
    }
  });
  it.each([
    ["::ffff:127.0.0.1", "127.0.0.1"],
    ["2001:0db8:0:0:0:0:0:1", "2001:db8::1"],
    ["127.0.0.1", "127.0.0.1"],
    ["127.0.0.1, 1.2.3.4", undefined],
    ["fe80::1%lo0", undefined],
    [" 127.0.0.1", undefined],
  ])("normalizes client literal %s", (input, output) =>
    expect(normalizedIp(input!)).toBe(output),
  );
  function request(
    raw = [
      "Host",
      "accounts.learli.test",
      "X-Forwarded-Proto",
      "https",
      "Origin",
      hostedTestOrigin,
    ],
    peer = "127.0.0.1",
  ) {
    const headers: Record<string, string> = {};
    for (let i = 0; i < raw.length; i += 2)
      headers[raw[i].toLowerCase()] = raw[i + 1];
    // Test-shaped IncomingMessage; real sockets are exercised by the executable harness.
    return {
      rawHeaders: raw,
      headers,
      socket: { remoteAddress: peer },
      method: "POST",
    } as IncomingMessage;
  }
  it("rejects unknown TCP peer, duplicates, HTTP/missing marker and missing mutation Origin before minting", () => {
    const c = config();
    expect(admitHostedIngress(c, request(undefined, "192.0.2.99"))).toBe(false);
    expect(
      admitHostedIngress(
        c,
        request([
          "Host",
          "accounts.learli.test",
          "Host",
          "accounts.learli.test",
        ]),
      ),
    ).toBe(false);
    for (const raw of [
      ["Host", "accounts.learli.test"],
      ["Host", "accounts.learli.test", "X-Forwarded-Proto", "http"],
      ["Host", "accounts.learli.test", "X-Forwarded-Proto", "https"],
    ])
      expect(admitHostedIngress(c, request(raw))).toBe(false);
    const good = request();
    good.headers["x-learli-ingress-token"] = "forged";
    good.rawHeaders.push(
      "X-Learli-Ingress-Token",
      "forged",
      "X-Forwarded-For",
      "1.2.3.4",
    );
    expect(admitHostedIngress(c, good)).toBe(true);
    expect(good.headers["x-learli-ingress-token"]).toBe(c.ingressSecret);
    expect(good.headers["x-learli-client-ip"]).toBe("0.0.0.0");
    expect(good.headers["x-forwarded-for"]).toBeUndefined();
  });
});
describe("hosted callbacks", () => {
  it("keeps bounded app returns and refuses malformed/external/duplicate/proof redirects", () => {
    expect(
      safeHostedCallback(
        "/sign-in?verified=1&next=%2Faccount",
        hostedTestOrigin,
      ),
    ).toBe(true);
    expect(
      safeHostedCallback(
        "/sign-in?verified=1&next=%2Fbookings%2Fnew%3Fscope%3Dstudent",
        hostedTestOrigin,
      ),
    ).toBe(true);
    expect(safeHostedCallback("/reset-password", hostedTestOrigin, true)).toBe(
      true,
    );
    for (const value of [
      "//evil.test",
      "https://evil.test/account",
      "/sign-in#proof",
      "/account?next=%2Faccount&next=%2Faccount",
      "/account?token=private",
      "/account?next=%2Faccount%23fragment",
      "/account?next=%2F%2Fevil.test",
      "/account?next=%2Faccount%5Cevil",
    ])
      expect(safeHostedCallback(value, hostedTestOrigin)).toBe(false);
  });
});
