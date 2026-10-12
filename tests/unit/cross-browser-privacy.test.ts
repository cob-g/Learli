// @vitest-environment node
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Page } from "@playwright/test";
import {
  privateGoto,
  protectedFailureMessage,
} from "../e2e/cross-browser-privacy";

describe("private browser failure projection", () => {
  it("retains a navigation rejection without secret-bearing messages or causes", async () => {
    const proof = randomUUID();
    const cookie = randomUUID();
    const original = new Error(
      `Navigation failed with ${proof} and ${cookie}`,
      { cause: new Error(cookie) },
    );
    const page: Pick<Page, "goto"> = {
      goto: async () => {
        throw original;
      },
    };
    let failure: unknown;
    try {
      await privateGoto(page, "http://127.0.0.1:3165/");
    } catch (error) {
      failure = error;
    }
    expect(failure instanceof Error).toBe(true);
    if (!(failure instanceof Error))
      throw new Error("Expected retained navigation failure.");
    expect(failure.message === protectedFailureMessage).toBe(true);
    expect(failure.cause === undefined).toBe(true);
    expect(`${failure.stack}`.includes(proof)).toBe(false);
    expect(`${failure.stack}`.includes(cookie)).toBe(false);
  });

  it("keeps a real Playwright request failure nonzero while proof/cookie stay out of its list report", async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Owned local probe address unavailable.");
    const port = address.port;
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    const directory = path.join(
      process.cwd(),
      ".local",
      "readiness-wave",
      `private-failure-probe-${randomUUID()}`,
    );
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const proof = randomUUID();
    const cookie = `synthetic_session=${randomUUID()}`;
    const modulePath = path.join(
      process.cwd(),
      "tests/e2e/cross-browser-privacy.ts",
    );
    await writeFile(
      path.join(directory, "probe.spec.ts"),
      `
import { test } from "@playwright/test";
import { privateGet } from ${JSON.stringify(modulePath)};
test("retained private transport failure", async ({ playwright }) => {
  const context = await playwright.request.newContext({ extraHTTPHeaders: { cookie: process.env.PROBE_COOKIE! } });
  const url = process.env.PROBE_URL!;
  try {
    let rawFailureConfirmed = false;
    try { await context.get(url, { timeout: 1000 }); }
    catch (error) { rawFailureConfirmed = error instanceof Error && error.message.includes(process.env.PROBE_PROOF!) && error.message.includes(process.env.PROBE_COOKIE!); }
    if (!rawFailureConfirmed) throw new Error("Expected raw SDK failure precondition was not observed.");
    console.log("RAW_SENSITIVE_FAILURE_CONFIRMED");
    await privateGet(context, url, { timeout: 1000 });
  } finally { await context.dispose(); }
});
`,
      { mode: 0o600 },
    );
    const config = path.join(directory, "playwright.config.ts");
    await writeFile(
      config,
      `import { defineConfig } from "@playwright/test"; export default defineConfig({ testDir: ${JSON.stringify(directory)}, testMatch: "probe.spec.ts", outputDir: ${JSON.stringify(path.join(directory, "results"))}, workers: 1, retries: 0, timeout: 10000, reporter: [["list"]], use: { trace: "off", screenshot: "off", video: "off" } });`,
      { mode: 0o600 },
    );
    const result = spawnSync(
      process.execPath,
      ["node_modules/@playwright/test/cli.js", "test", "--config", config],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PROBE_COOKIE: cookie,
          PROBE_PROOF: proof,
          PROBE_URL: `http://127.0.0.1:${port}/private-proof?token=${proof}`,
        },
        encoding: "utf8",
        timeout: 20000,
        maxBuffer: 1_000_000,
      },
    );
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    // Original failed probe evidence remains private; never print its payload.
    await writeFile(path.join(directory, "original-list-output.log"), output, {
      mode: 0o600,
    });
    expect(result.status).toBe(1);
    expect(output.includes("RAW_SENSITIVE_FAILURE_CONFIRMED")).toBe(true);
    expect(output.includes(protectedFailureMessage)).toBe(true);
    expect(output.includes(proof)).toBe(false);
    expect(output.includes(cookie)).toBe(false);
  }, 30000);
});
