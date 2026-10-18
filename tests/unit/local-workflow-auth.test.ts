import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  mkdir,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AuthRuntime } from "@/lib/auth-factory";
import { parseServerEnv } from "@/lib/env/schema";
import {
  getLocalWorkflow,
  validateLocalWorkflowBinding,
} from "@/features/local-workflow/runtime";
import { permitsAccountEmail } from "@/features/hosted-auth/request";
import { handleAuthRequest } from "@/lib/auth-handler";
import { createMailAttemptBoundary } from "@/features/hosted-auth/mail-attempt";
import {
  captureLocalMail,
  captureOperationalMail,
} from "@/lib/email/local-mail";
import {
  createEmailChangeInput,
  emailChangeInput,
} from "@/features/account-email/input";

vi.mock("server-only", () => ({}));
const roots: string[] = [];
const source = {
  APP_ENV: "development",
  AUTH_MODE: "local",
  DATABASE_MODE: "local",
  LOCAL_WORKFLOW_MODE: "enabled",
  APP_URL: "http://127.0.0.1:3000",
  DATABASE_URL:
    "postgresql://learli_app:unit-only-credential@127.0.0.1:55499/learli_dev",
  BETTER_AUTH_SECRET: "unit-only-local-authentication-secret",
};
const pool = {
  options: {
    host: "127.0.0.1",
    port: 55499,
    database: "learli_dev",
    user: "learli_app",
  },
};
function select() {
  for (const key of [
    ...Object.keys(source),
    "DATABASE_URL_DIRECT",
    "PRIVATE_WORKFLOW_CONFIG_FILE",
    "NEON_DEVELOPMENT_CONFIG_FILE",
    "HOSTED_AUTH_CONFIG_FILE",
    "HOSTED_INGRESS_SECRET",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "BETTER_AUTH_URL",
  ])
    vi.stubEnv(key, source[key as keyof typeof source]);
  const localWorkflow = validateLocalWorkflowBinding(source, pool)!;
  const mailAttempt = createMailAttemptBoundary(async () => {});
  return {
    localWorkflow,
    pool,
    origin: source.APP_URL,
    environment: "development",
    mailAttempt,
    auth: { handler: vi.fn(async () => Response.json({ status: true })) },
  } as unknown as AuthRuntime;
}
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

describe("ordinary local auth admission", () => {
  it("admits normal mailboxes only through the selected pool-bound runtime and leaves old modes synthetic", () => {
    const runtime = select();
    expect(getLocalWorkflow(runtime)).toMatchObject({
      source: "local_operation",
      environment: "development",
    });
    expect(permitsAccountEmail(runtime, "person@example.com")).toBe(true);
    expect(permitsAccountEmail(runtime, "person+lessons@example.org")).toBe(
      true,
    );
    expect(permitsAccountEmail(runtime, "not-an-address")).toBe(false);
    expect(
      permitsAccountEmail(
        runtime,
        "person@example.com\r\nBcc:other@example.com",
      ),
    ).toBe(false);
    vi.stubEnv("LOCAL_WORKFLOW_MODE", "disabled");
    expect(() => getLocalWorkflow(runtime)).toThrow(
      "Local workflow configuration",
    );
    const synthetic = { ...runtime, localWorkflow: null } as AuthRuntime;
    expect(getLocalWorkflow(synthetic)).toBeNull();
    expect(permitsAccountEmail(synthetic, "person@example.com")).toBe(false);
    expect(permitsAccountEmail(synthetic, "person@example.test")).toBe(true);
  });

  it.each([
    { APP_ENV: "test" },
    { APP_ENV: "staging" },
    { APP_ENV: "production" },
    { AUTH_MODE: "disabled" },
    { AUTH_MODE: "hosted-synthetic" },
    { DATABASE_MODE: "neon-development" },
    { DATABASE_URL: source.DATABASE_URL.replace("learli_dev", "learli_test") },
    { DATABASE_URL: source.DATABASE_URL.replace("learli_app", "learli_owner") },
    { APP_URL: "https://example.com" },
    { APP_URL: "http://127.0.0.1:3000/" },
    { BETTER_AUTH_URL: "http://localhost:3000" },
    { DATABASE_URL_DIRECT: source.DATABASE_URL },
    { PRIVATE_WORKFLOW_CONFIG_FILE: "/private/workflow.json" },
    { HOSTED_AUTH_CONFIG_FILE: "/private/hosted.json" },
    { HOSTED_INGRESS_SECRET: "unit-only-independent-ingress-secret" },
    { RESEND_API_KEY: "unit-only-provider-key" },
    { EMAIL_FROM: "sender@example.com" },
  ])(
    "refuses conflicting ordinary configuration before authority: %j",
    (patch) => {
      expect(() => parseServerEnv({ ...source, ...patch })).toThrow(
        "Invalid server configuration",
      );
    },
  );

  it("refuses pool swaps, forged capabilities and missing selected capability", () => {
    const runtime = select();
    expect(() =>
      getLocalWorkflow({
        ...runtime,
        pool: { options: { ...pool.options, port: 55500 } },
      } as AuthRuntime),
    ).toThrow();
    const capability = getLocalWorkflow(runtime)!;
    expect(() =>
      getLocalWorkflow({
        ...runtime,
        localWorkflow: { ...capability },
      } as AuthRuntime),
    ).toThrow();
    expect(() =>
      getLocalWorkflow({ ...runtime, localWorkflow: null } as AuthRuntime),
    ).toThrow();
  });

  it("uses the normal address policy in the HTTP boundary without widening fields or origin", async () => {
    const runtime = select();
    const request = (body: unknown, origin = source.APP_URL) =>
      new Request(`${source.APP_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const input = {
      email: "person@example.com",
      name: "Local owner",
      password: "unit-only-passphrase",
    };
    expect((await handleAuthRequest(runtime, request(input))).status).toBe(200);
    expect(
      (await handleAuthRequest(runtime, request({ ...input, role: "admin" })))
        .status,
    ).toBe(400);
    expect(
      (
        await handleAuthRequest(
          runtime,
          request(input, "https://foreign.example.com"),
        )
      ).status,
    ).toBe(403);
    vi.stubEnv("LOCAL_WORKFLOW_MODE", "disabled");
    const synthetic = { ...runtime, localWorkflow: null } as AuthRuntime;
    expect((await handleAuthRequest(synthetic, request(input))).status).toBe(
      400,
    );
  });

  it("projects a swallowed ordinary capture failure as uncertain instead of reporting success", async () => {
    const selected = select();
    const mailAttempt = createMailAttemptBoundary(async () => {
      throw new Error("private capture failure");
    });
    const runtime = { ...selected, mailAttempt } as AuthRuntime;
    runtime.auth.handler = async () => {
      await runtime.mailAttempt
        .send({
          kind: "verification",
          to: "person@example.com",
          url: "private-provider-url",
        })
        .catch(() => undefined);
      return Response.json({ status: true, private: "provider-payload" });
    };
    const response = await handleAuthRequest(
      runtime,
      new Request(`${source.APP_URL}/api/auth/send-verification-email`, {
        method: "POST",
        headers: { origin: source.APP_URL, "content-type": "application/json" },
        body: JSON.stringify({ email: "person@example.com" }),
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(
      /private-provider-url|provider-payload|private capture failure/,
    );
  });

  it("accepts normal email-change inputs only with explicit ordinary schema while retaining strict proof fields", () => {
    const input = {
      action: "request",
      newEmail: " New@Example.com ",
      code: "123456",
    };
    expect(emailChangeInput.safeParse(input).success).toBe(false);
    expect(createEmailChangeInput(true).parse(input)).toEqual({
      ...input,
      newEmail: "new@example.com",
    });
    for (const extra of [
      { userId: "another-owner" },
      { role: "admin" },
      { callbackURL: "/account" },
    ])
      expect(
        createEmailChangeInput(true).safeParse({ ...input, ...extra }).success,
      ).toBe(false);
  });
});

describe("ordinary owner-private local mail", () => {
  it("captures an actual exact-origin provider link and masked-change code in private files without sending", async () => {
    const runtime = select();
    const capability = getLocalWorkflow(runtime)!;
    const root = await mkdtemp(
      path.join(os.tmpdir(), "learli-operational-mail-"),
    );
    roots.push(root);
    const url = `${source.APP_URL}/api/auth/verify-email?token=unit-only-provider-token&callbackURL=%2Faccount`;
    await captureOperationalMail(
      capability,
      { kind: "verification", to: "person@example.com", url },
      root,
    );
    await captureOperationalMail(
      capability,
      {
        kind: "email-change-new",
        to: "new@example.com",
        url: `${source.APP_URL}/account/email`,
        otp: "123456",
      },
      root,
    );
    const directory = path.join(root, ".local/mail/development");
    expect((await stat(directory)).mode & 0o7777).toBe(0o700);
    const names = await readdir(directory);
    expect(names).toHaveLength(4);
    for (const name of names)
      expect((await stat(path.join(directory, name))).mode & 0o7777).toBe(
        0o600,
      );
    const messages = await Promise.all(
      names
        .filter((name) => name.endsWith(".json"))
        .map(async (name) =>
          JSON.parse(await readFile(path.join(directory, name), "utf8")),
        ),
    );
    expect(messages).toContainEqual({
      kind: "verification",
      to: "person@example.com",
      url,
    });
    const html = await Promise.all(
      names
        .filter((name) => name.endsWith(".html"))
        .map((name) => readFile(path.join(directory, name), "utf8")),
    );
    expect(
      html.every(
        (body) =>
          body.includes("No email was sent.") && !body.includes("test account"),
      ),
    ).toBe(true);
  });

  it("refuses normal recipients in the old sink and foreign origins, callbacks, proof paths and directory symlinks in ordinary capture", async () => {
    const capability = getLocalWorkflow(select())!;
    const root = await mkdtemp(
      path.join(os.tmpdir(), "learli-operational-refusal-"),
    );
    roots.push(root);
    const mail = {
      kind: "verification" as const,
      to: "person@example.com",
      url: `${source.APP_URL}/api/auth/verify-email?token=unit-only-provider-token&callbackURL=%2Faccount`,
    };
    await expect(captureLocalMail("development", mail)).rejects.toThrow(
      "destination rejected",
    );
    for (const url of [
      mail.url.replace("127.0.0.1", "localhost"),
      mail.url.replace("%2Faccount", "https%3A%2F%2Fforeign.example.com"),
      mail.url.replace("/api/auth/verify-email", "/foreign"),
      `${mail.url}&token=duplicate-token`,
    ])
      await expect(
        captureOperationalMail(capability, { ...mail, url }, root),
      ).rejects.toThrow();
    await mkdir(path.join(root, "foreign"), { mode: 0o700 });
    await symlink(path.join(root, "foreign"), path.join(root, ".local"));
    await expect(
      captureOperationalMail(capability, mail, root),
    ).rejects.toThrow("mailbox is unavailable");
    expect(await readdir(path.join(root, "foreign"))).toEqual([]);
  });
});
