import { randomUUID } from "node:crypto";
import {
  chmodSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const resend = vi.hoisted(() => ({ create: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/email/resend-transport", () => ({
  createResendTransport: resend.create,
}));

import { parseHostedAuthConfig } from "@/features/hosted-auth/config";
import type { AccountMail } from "@/features/hosted-auth/composition";
import {
  createPrivateAccountCapture,
  privateCaptureLimits,
} from "@/features/hosted-auth/private-capture";
import {
  bindAccountMail,
  hostedAccountMail,
} from "@/features/hosted-auth/mail";
import { createMailAttemptBoundary } from "@/features/hosted-auth/mail-attempt";
import {
  hostedTestOrigin,
  hostedTestPacket,
  hostedTestSource,
} from "../support/hosted-auth-packet";

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "learli-private-capture-"));
  roots.push(root);
  mkdirSync(path.join(root, ".local"), { mode: 0o700 });
  const directory = path.join(root, ".local", "account-captures");
  mkdirSync(directory, { mode: 0o700 });
  const packet = {
    ...hostedTestPacket(),
    mail: {
      mode: "private-capture",
      appOrigin: hostedTestOrigin,
      directory,
    },
  };
  const config = parseHostedAuthConfig(hostedTestSource(), packet);
  return {
    root,
    directory,
    packet,
    config,
    capture: () => createPrivateAccountCapture(config, root),
  };
}
const proof = "fictional-provider-token-for-capture-tests";
function verification(url?: string): AccountMail {
  return {
    kind: "verification",
    to: "hosted@example.test",
    url:
      url ??
      `${hostedTestOrigin}/api/auth/verify-email?token=${proof}&callbackURL=%2Fsign-in%3Fverified%3D1%26next%3D%252Faccount`,
  };
}
function records(directory: string) {
  return readdirSync(directory).map((name) => {
    const file = path.join(directory, name);
    return { file, value: JSON.parse(readFileSync(file, "utf8")) };
  });
}

describe("explicit private fictional capture configuration", () => {
  it("retains disabled defaults and requires an exact matching HTTPS origin", () => {
    const f = fixture();
    expect(f.config.mail).toEqual(f.packet.mail);
    expect(Object.isFrozen(f.config.mail)).toBe(true);
    expect(
      parseHostedAuthConfig(hostedTestSource(), {
        ...f.packet,
        mail: undefined,
      }).mail,
    ).toEqual({ mode: "disabled" });
    for (const appOrigin of [
      "https://other.learli.test",
      `${hostedTestOrigin}/`,
      hostedTestOrigin.replace("https:", "http:"),
    ])
      expect(() =>
        parseHostedAuthConfig(hostedTestSource(), {
          ...f.packet,
          mail: { ...f.packet.mail, appOrigin },
        }),
      ).toThrow("configuration");
  });
  it.each(["production", "development", "test"])(
    "refuses %s and never changes normal environment admission",
    (APP_ENV) => {
      const f = fixture();
      expect(() =>
        parseHostedAuthConfig({ ...hostedTestSource(), APP_ENV }, f.packet),
      ).toThrow("configuration");
    },
  );
  it.each([
    { realIntake: "enabled" },
    { purpose: "real_accounts" },
    { accountEmails: [] },
    { accountEmails: ["owner@gmail.com"] },
    { accountEmails: ["hosted@example.test", "hosted@example.test"] },
    { accountEmails: ["HOSTED@example.test"] },
    {
      accountEmails: Array.from(
        { length: 101 },
        (_, index) => `account-${index}@example.test`,
      ),
    },
  ])("refuses mixed intake or invalid finite account allowlist %j", (value) => {
    const f = fixture();
    expect(() =>
      parseHostedAuthConfig(hostedTestSource(), { ...f.packet, ...value }),
    ).toThrow("configuration");
  });
  it.each([
    ".local/account-captures",
    "/tmp/account-captures",
    "/tmp/.local/../account-captures",
    "/tmp/.local//account-captures",
    "/tmp/.local/account-captures/",
    "/tmp/.local/account-captures\u0000private",
  ])("refuses noncanonical private directory %j", (directory) => {
    const f = fixture();
    expect(() =>
      parseHostedAuthConfig(hostedTestSource(), {
        ...f.packet,
        mail: { ...f.packet.mail, directory },
      }),
    ).toThrow("configuration");
  });
  it("requires registered config, the capture mode and a directory in this checkout", () => {
    const f = fixture();
    expect(() => createPrivateAccountCapture({ ...f.config }, f.root)).toThrow(
      "configuration",
    );
    const disabled = parseHostedAuthConfig(hostedTestSource(), {
      ...f.packet,
      mail: { mode: "disabled" },
    });
    expect(() => createPrivateAccountCapture(disabled, f.root)).toThrow(
      "configuration",
    );
    expect(() => createPrivateAccountCapture(f.config)).toThrow("private_file");
    rmSync(f.directory, { recursive: true });
    expect(f.capture).toThrow("private_file");
    expect(readdirSync(path.dirname(f.directory))).toEqual([]);
  });
});

describe("private operator-only provider proof capture", () => {
  it("captures all four actual provider messages exactly, with 0700/0600 modes", async () => {
    const f = fixture();
    const messages: AccountMail[] = [
      verification(),
      {
        kind: "reset",
        to: "hosted@example.test",
        url: `${hostedTestOrigin}/api/auth/reset-password/${proof}?callbackURL=%2Freset-password`,
      },
      ...(["email-change-current", "email-change-new"] as const).map(
        (kind) => ({
          kind,
          to: "hosted@example.test",
          url: `${hostedTestOrigin}/account/email`,
          otp: "012345",
        }),
      ),
    ];
    for (const message of messages) await f.capture()(message);
    const captured = records(f.directory);
    expect(captured).toHaveLength(4);
    expect(captured.map(({ value }) => value.kind).sort()).toEqual(
      messages.map(({ kind }) => kind).sort(),
    );
    for (const message of messages)
      expect(
        captured.find(({ value }) => value.kind === message.kind)?.value,
      ).toMatchObject({
        version: 1,
        purpose: "private-fictional-account-mail",
        ...message,
      });
    for (const { file, value } of captured) {
      expect(path.basename(file)).not.toContain(proof);
      expect(path.basename(file)).not.toContain("hosted");
      expect(lstatSync(file).mode & 0o7777).toBe(0o600);
      expect(lstatSync(file).uid).toBe(process.getuid?.());
      expect(lstatSync(file).nlink).toBe(1);
      expect(lstatSync(file).size).toBeLessThanOrEqual(
        privateCaptureLimits.messageBytes,
      );
      expect(Number.isNaN(Date.parse(value.capturedAt))).toBe(false);
      expect(value).not.toHaveProperty("emailVerified");
      expect(value).not.toHaveProperty("secret");
    }
    expect(lstatSync(f.directory).mode & 0o7777).toBe(0o700);
    expect(lstatSync(path.dirname(f.directory)).mode & 0o7777).toBe(0o700);
  });
  it.each([
    "other@example.test",
    "hosted@gmail.com",
    "HOSTED@example.test",
    "hosted@example.test,second@example.test",
  ])(
    "refuses unlisted or unsafe recipient %s without a capture",
    async (to) => {
      const f = fixture();
      await expect(f.capture()({ ...verification(), to })).rejects.toThrow(
        "Private account capture could not be completed",
      );
      expect(readdirSync(f.directory)).toEqual([]);
    },
  );
  it.each([
    `http://accounts.learli.test/api/auth/verify-email?token=${proof}&callbackURL=%2F`,
    `https://other.learli.test/api/auth/verify-email?token=${proof}&callbackURL=%2F`,
    `https://accounts.learli.test.evil.test/api/auth/verify-email?token=${proof}&callbackURL=%2F`,
    `https://user:password@accounts.learli.test/api/auth/verify-email?token=${proof}&callbackURL=%2F`,
    `${hostedTestOrigin}/api/auth/verify-email?token=${proof}&callbackURL=%2F#private`,
    `${hostedTestOrigin}/account?token=${proof}&callbackURL=%2F`,
    `${hostedTestOrigin}/api/auth/../auth/verify-email?token=${proof}&callbackURL=%2F`,
    `${hostedTestOrigin}/api/auth/%76erify-email?token=${proof}&callbackURL=%2F`,
    `${hostedTestOrigin}/api/auth/verify-email?token=short&callbackURL=%2F`,
    `${hostedTestOrigin}/api/auth/verify-email?token=${proof}`,
    `${hostedTestOrigin}/api/auth/verify-email?token=${proof}&token=${proof}&callbackURL=%2F`,
    `${hostedTestOrigin}/api/auth/verify-email?token=${proof}&callbackURL=%2F&extra=1`,
    `${hostedTestOrigin}/api/auth/verify-email?token=${proof}&callbackURL=https%3A%2F%2Fevil.test%2F`,
    `${hostedTestOrigin}/api/auth/verify-email?token=${proof}&callbackURL=%2F%2Fevil.test`,
    `${hostedTestOrigin}/api/auth/verify-email?token=${proof}%0a&callbackURL=%2F`,
    `${hostedTestOrigin}/api/auth/reset-password/${proof}?callbackURL=%2Freset-password`,
  ])("refuses unsupported or unsafe verification URL %s", async (url) => {
    const f = fixture();
    await expect(f.capture()(verification(url))).rejects.toThrow(
      "Private account capture could not be completed",
    );
    expect(readdirSync(f.directory)).toEqual([]);
  });
  it.each([
    { url: `${hostedTestOrigin}/account/email?proof=private` },
    { url: `${hostedTestOrigin}/account/email#private` },
    { url: `${hostedTestOrigin}/account` },
    { otp: "12345" },
    { otp: "1234567" },
    { otp: "abcdef" },
  ])("refuses altered account email route/code %j", async (override) => {
    const f = fixture();
    await expect(
      f.capture()({
        kind: "email-change-current",
        to: "hosted@example.test",
        url: `${hostedTestOrigin}/account/email`,
        otp: "012345",
        ...override,
      }),
    ).rejects.toThrow("Private account capture could not be completed");
    expect(readdirSync(f.directory)).toEqual([]);
  });
  it("rejects arbitrary fields and oversized proofs rather than recording them", async () => {
    const f = fixture();
    const unknown = { ...verification(), secret: "must-not-be-recorded" };
    await expect(f.capture()(unknown)).rejects.toThrow();
    await expect(
      f.capture()(verification(`${hostedTestOrigin}/${"x".repeat(8193)}`)),
    ).rejects.toThrow();
    expect(readdirSync(f.directory)).toEqual([]);
  });
});

describe("private filesystem boundaries and bounded retention", () => {
  it.each([".local", "account-captures"])(
    "refuses exposed %s directory permissions before and after binding",
    async (name) => {
      const f = fixture();
      const send = f.capture();
      const target =
        name === ".local" ? path.dirname(f.directory) : f.directory;
      chmodSync(target, 0o755);
      expect(f.capture).toThrow("private_file");
      await expect(send(verification())).rejects.toThrow();
      expect(readdirSync(f.directory)).toEqual([]);
    },
  );
  it("refuses wrong ownership without changing permissions or writing a file", () => {
    const f = fixture();
    const uid = process.getuid?.();
    if (uid === undefined) throw new Error("Owner checks require POSIX.");
    vi.spyOn(process, "getuid").mockReturnValue(uid + 1);
    expect(f.capture).toThrow("private_file");
    expect(readdirSync(f.directory)).toEqual([]);
  });
  it.each(["directory", "ancestor"])(
    "refuses a symbolic %s, including a replacement after binding",
    async (kind) => {
      const f = fixture();
      const send = f.capture();
      const replacement = path.join(f.root, "replacement");
      mkdirSync(replacement, { mode: 0o700 });
      const target =
        kind === "directory" ? f.directory : path.dirname(f.directory);
      rmSync(target, { recursive: true });
      symlinkSync(replacement, target, "dir");
      expect(f.capture).toThrow("private_file");
      await expect(send(verification())).rejects.toThrow();
      expect(readdirSync(replacement)).toEqual([]);
    },
  );
  it.each(["symlink", "hardlink", "exposed", "oversized", "directory"])(
    "refuses an unsafe existing capture: %s",
    async (kind) => {
      const f = fixture();
      const file = path.join(f.directory, `${randomUUID()}.json`);
      if (kind === "directory") mkdirSync(file, { mode: 0o700 });
      else if (kind === "symlink" || kind === "hardlink") {
        const outside = path.join(f.root, "outside.json");
        writeFileSync(outside, "private-existing-value", { mode: 0o600 });
        if (kind === "symlink") symlinkSync(outside, file);
        else linkSync(outside, file);
      } else
        writeFileSync(
          file,
          kind === "oversized"
            ? "x".repeat(privateCaptureLimits.messageBytes + 1)
            : "private-existing-value",
          { mode: kind === "exposed" ? 0o644 : 0o600 },
        );
      await expect(f.capture()(verification())).rejects.toThrow();
      expect(readdirSync(f.directory)).toEqual([path.basename(file)]);
      if (kind === "symlink" || kind === "hardlink")
        expect(readFileSync(path.join(f.root, "outside.json"), "utf8")).toBe(
          "private-existing-value",
        );
    },
  );
  it("refuses full capture storage without deleting or overwriting old records", async () => {
    const f = fixture();
    for (let index = 0; index < privateCaptureLimits.files; index++)
      writeFileSync(
        path.join(f.directory, `${randomUUID()}.json`),
        JSON.stringify({ existing: index }),
        { mode: 0o600 },
      );
    const before = records(f.directory);
    await expect(f.capture()(verification())).rejects.toThrow();
    expect(records(f.directory)).toEqual(before);
  });
  it("refuses existing locks and unrecognized files without stale-lock cleanup", async () => {
    const f = fixture();
    const lock = path.join(f.directory, ".capture.lock");
    writeFileSync(lock, "existing lock", { mode: 0o600 });
    await expect(f.capture()(verification())).rejects.toThrow();
    expect(readFileSync(lock, "utf8")).toBe("existing lock");
    rmSync(lock);
    writeFileSync(path.join(f.directory, "unexpected"), "existing", {
      mode: 0o600,
    });
    await expect(f.capture()(verification())).rejects.toThrow();
    expect(readdirSync(f.directory)).toEqual(["unexpected"]);
  });
  it("reports missing-directory failures safely through the existing attempt boundary", async () => {
    const f = fixture();
    const send = f.capture();
    const logs = ["log", "warn", "error"] as const;
    const spies = logs.map((kind) => vi.spyOn(console, kind));
    rmSync(f.directory, { recursive: true });
    const boundary = createMailAttemptBoundary(send);
    const outcome = await boundary.run(async () => {
      try {
        await boundary.send(verification());
      } catch (error) {
        expect(String(error)).not.toContain(f.directory);
        expect(String(error)).not.toContain(proof);
        expect(String(error)).not.toContain("hosted@example.test");
      }
    });
    expect(outcome.failed).toBe(true);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(readdirSync(path.dirname(f.directory))).toEqual([]);
  });
});

describe("account callback transport selection", () => {
  it("selects private capture before creating or calling any remote transport", async () => {
    const f = fixture();
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(f.root);
    const send = hostedAccountMail(f.config);
    const bound = bindAccountMail(f.config, { send: resend.send });
    cwd.mockRestore();
    await send(verification());
    await bound(verification());
    expect(records(f.directory)).toHaveLength(2);
    expect(resend.create).not.toHaveBeenCalled();
    expect(resend.send).not.toHaveBeenCalled();
  });
  it("preserves disabled refusal and the existing Resend send path", async () => {
    resend.send.mockResolvedValue({ status: "accepted", providerId: "test" });
    resend.create.mockReturnValue({ send: resend.send });
    const disabled = parseHostedAuthConfig(hostedTestSource(), {
      ...hostedTestPacket(),
      mail: { mode: "disabled" },
    });
    await expect(hostedAccountMail(disabled)(verification())).rejects.toThrow(
      "Account messages are unavailable",
    );
    expect(resend.create).toHaveBeenCalledWith(undefined);
    expect(resend.send).not.toHaveBeenCalled();
    const config = parseHostedAuthConfig(
      hostedTestSource(),
      hostedTestPacket(),
    );
    await hostedAccountMail(config)(verification());
    expect(resend.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true, environment: "staging" }),
    );
    expect(resend.send).toHaveBeenCalledTimes(1);
  });
});
