import { createServer } from "node:http";
import { describe, expect, it, vi } from "vitest";
import {
  deploymentPreflight,
  parsePreflightArgs,
} from "../../scripts/deployment-preflight";

const privateMarker = "PRIVATE_PREFLIGHT_MARKER";
const runtime = {
  node: "24.20.0",
  npm: "11.19.0",
  pinnedNode: "24.20.0",
  pinnedNpm: "11.19.0",
  buildPresent: true,
};
const local = {
  APP_ENV: "test",
  AUTH_MODE: "local",
  APP_URL: "http://127.0.0.1:3163",
  PORT: "3163",
  BETTER_AUTH_URL: "http://127.0.0.1:3163",
  BETTER_AUTH_SECRET: privateMarker.repeat(3),
  DATABASE_URL: `postgresql://learli_app:${privateMarker}@127.0.0.1:55503/learli_test`,
  DATABASE_URL_DIRECT: `postgresql://learli_owner:${privateMarker}@127.0.0.1:55503/learli_test`,
};
const shell = {
  APP_ENV: "production",
  AUTH_MODE: "disabled",
  APP_URL: "https://shell.example.test",
  PORT: "3163",
};
const healthy = () =>
  Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });

describe("deployment preflight boundaries", () => {
  it("passes only local configuration without contacting a database or network", async () => {
    const request = vi.fn<typeof fetch>();
    const report = await deploymentPreflight(
      local,
      { mode: "local" },
      runtime,
      request,
    );
    expect(report.exitCode).toBe(0);
    expect(request).not.toHaveBeenCalled();
    expect(report.scope).toBe("configuration and optional local liveness only");
    expect(JSON.stringify(report)).not.toContain(privateMarker);
  });

  it("can validate a disabled shell without claiming hosted readiness", async () => {
    const report = await deploymentPreflight(shell, { mode: "shell" }, runtime);
    expect(report.exitCode).toBe(0);
    expect(report.checks.map((item) => item.name)).not.toContain(
      "hosted-readiness",
    );
  });

  it.each([local, shell, { ...shell, AUTH_MODE: "hosted" }])(
    "always blocks hosted readiness without I/O, regardless of env values",
    async (source) => {
      const request = vi.fn<typeof fetch>();
      const report = await deploymentPreflight(
        source,
        { mode: "hosted", health: true },
        runtime,
        request,
      );
      expect(report.exitCode).toBe(2);
      expect(report.checks).toContainEqual(
        expect.objectContaining({
          name: "hosted-readiness",
          status: "BLOCKED",
        }),
      );
      expect(request).not.toHaveBeenCalled();
      expect(JSON.stringify(report)).not.toContain(privateMarker);
    },
  );

  it.each([
    { APP_ENV: "production" },
    { AUTH_MODE: "disabled" },
    { APP_URL: "http://evil.example.test:3163" },
    { BETTER_AUTH_URL: "http://localhost:3163" },
    { BETTER_AUTH_SECRET: "short" },
    {
      DATABASE_URL: `postgresql://learli_app:${privateMarker}@remote.example.test/learli_test`,
    },
    {
      DATABASE_URL: `postgresql://learli_app:${privateMarker}@127.0.0.1:55503/learli_dev`,
    },
    {
      DATABASE_URL: `postgresql://learli_owner:${privateMarker}@127.0.0.1:55503/learli_test`,
    },
    { DATABASE_URL: `${local.DATABASE_URL}?host=remote.example.test` },
    {
      DATABASE_URL_DIRECT: `postgresql://learli_owner:${privateMarker}@127.0.0.1:55504/learli_test`,
    },
    { DATABASE_URL_DIRECT: local.DATABASE_URL },
    { DATABASE_URL_DIRECT: "" },
    { APP_ENV: "development" },
    { PORT: "3164" },
    { RESEND_API_KEY: privateMarker },
  ])(
    "fails unsafe local config without network or secret output: %j",
    async (override) => {
      const request = vi.fn<typeof fetch>();
      const report = await deploymentPreflight(
        { ...local, ...override },
        { mode: "local", health: true },
        runtime,
        request,
      );
      expect(report.exitCode).toBe(1);
      expect(request).not.toHaveBeenCalled();
      expect(JSON.stringify(report)).not.toContain(privateMarker);
    },
  );

  it.each(["0", "80", "-1", "3163.5", "NaN", "65536", "3163\n"])(
    "rejects invalid PORT %s",
    async (PORT) => {
      const report = await deploymentPreflight(
        { ...shell, PORT },
        { mode: "shell" },
        runtime,
      );
      expect(report.exitCode).toBe(1);
    },
  );

  it.each([
    { AUTH_MODE: "local" },
    { DATABASE_URL: local.DATABASE_URL },
    { DATABASE_URL_DIRECT: local.DATABASE_URL_DIRECT },
    { BETTER_AUTH_SECRET: local.BETTER_AUTH_SECRET },
    { RESEND_API_KEY: privateMarker },
    { EMAIL_FROM: "sender@example.test" },
    { APP_URL: "https://user:private@shell.example.test" },
    { APP_URL: "https://shell.example.test/private" },
    { APP_URL: "https://shell.example.test?private=value" },
  ])(
    "refuses integration configuration or unsafe shell origin: %j",
    async (override) => {
      const report = await deploymentPreflight(
        { ...shell, ...override },
        { mode: "shell" },
        runtime,
      );
      expect(report.exitCode).toBe(1);
      expect(JSON.stringify(report)).not.toContain(privateMarker);
    },
  );

  it("requires exact runtime pins and an explicit build marker when requested", async () => {
    for (const override of [
      { node: "22.0.0" },
      { npm: "10.0.0" },
      { buildPresent: false },
    ]) {
      expect(
        (
          await deploymentPreflight(
            local,
            { mode: "local", requireBuild: true },
            { ...runtime, ...override },
          )
        ).exitCode,
      ).toBe(1);
    }
    expect(
      (
        await deploymentPreflight(
          local,
          { mode: "local" },
          { ...runtime, buildPresent: false },
        )
      ).exitCode,
    ).toBe(0);
  });

  it("requests only the loopback health route with no credentials or redirect following", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(healthy());
    const report = await deploymentPreflight(
      local,
      { mode: "local", health: true },
      runtime,
      request,
    );
    expect(report.exitCode).toBe(0);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      new URL("http://127.0.0.1:3163/api/health"),
      expect.objectContaining({
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("refuses optional health for a hosted shell origin", async () => {
    const request = vi.fn<typeof fetch>();
    expect(
      (
        await deploymentPreflight(
          shell,
          { mode: "shell", health: true },
          runtime,
          request,
        )
      ).exitCode,
    ).toBe(1);
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    () => new Response("", { status: 503 }),
    () =>
      new Response("", {
        status: 302,
        headers: { Location: "https://remote.example.test" },
      }),
    () => Response.json({ status: "ok" }),
    () =>
      Response.json(
        { status: "ok", private: privateMarker },
        { headers: { "Cache-Control": "no-store" } },
      ),
    () =>
      new Response(privateMarker.repeat(30), {
        headers: { "Cache-Control": "no-store" },
      }),
    () =>
      new Response("not-json", { headers: { "Cache-Control": "no-store" } }),
  ])(
    "fails invalid health responses without returning their body",
    async (response) => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(response());
      const report = await deploymentPreflight(
        local,
        { mode: "local", health: true },
        runtime,
        request,
      );
      expect(report.exitCode).toBe(1);
      expect(JSON.stringify(report)).not.toContain(privateMarker);
    },
  );

  it("redacts request errors and aborts a stalled request", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error(privateMarker));
    expect(
      JSON.stringify(
        await deploymentPreflight(
          local,
          { mode: "local", health: true },
          runtime,
          request,
        ),
      ),
    ).not.toContain(privateMarker);
    vi.useFakeTimers();
    try {
      const stalled = vi.fn<typeof fetch>().mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new Error(privateMarker)),
            );
          }),
      );
      const pending = deploymentPreflight(
        local,
        { mode: "local", health: true },
        runtime,
        stalled,
      );
      await vi.advanceTimersByTimeAsync(3000);
      expect((await pending).exitCode).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

it("cancels rejected response bodies without reading or disclosing them", async () => {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ cancel });
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(body, { status: 503 }));
  expect(
    (
      await deploymentPreflight(
        local,
        { mode: "local", health: true },
        runtime,
        request,
      )
    ).exitCode,
  ).toBe(1);
  expect(cancel).toHaveBeenCalledTimes(1);
});

it("enforces redirect, streamed-body bound and deadline with native loopback HTTP", async () => {
  let behavior: "healthy" | "redirect" | "oversize" | "stalled" | "bad-status" =
    "healthy";
  const paths: string[] = [];
  const server = createServer((request, response) => {
    paths.push(request.url ?? "");
    if (behavior === "redirect") {
      response.writeHead(302, {
        Location: "/private-should-never-be-requested",
      });
      response.end();
      return;
    }
    if (behavior === "bad-status") {
      response.writeHead(503);
      response.write(privateMarker);
      return;
    }
    response.writeHead(200, { "Cache-Control": "no-store" });
    if (behavior === "healthy") response.end('{"status":"ok"}');
    if (behavior === "oversize") response.end(privateMarker.repeat(30));
    if (behavior === "stalled") response.write('{"status":');
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(3163, "127.0.0.1", resolve);
  });
  try {
    for (const next of [
      "healthy",
      "redirect",
      "oversize",
      "stalled",
      "bad-status",
    ] as const) {
      behavior = next;
      const report = await deploymentPreflight(
        local,
        { mode: "local", health: true },
        runtime,
      );
      expect(report.exitCode).toBe(next === "healthy" ? 0 : 1);
      expect(JSON.stringify(report)).not.toContain(privateMarker);
    }
    expect(paths).toEqual(Array(5).fill("/api/health"));
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}, 10_000);

describe("explicit preflight CLI arguments", () => {
  it("supports bounded options and an explicit environment file", () => {
    expect(
      parsePreflightArgs([
        "--mode",
        "local",
        "--config",
        ".env.test.local",
        "--health",
        "--require-build",
      ]),
    ).toEqual({
      mode: "local",
      envFile: ".env.test.local",
      health: true,
      requireBuild: true,
    });
  });
  it.each([
    { args: [] },
    { args: ["--mode", "production"] },
    { args: ["--mode", "local", "--config"] },
    { args: ["--mode", "local", "--health", "--health"] },
    { args: ["--mode", "local", "--url", privateMarker] },
  ])("refuses ambiguous/unbounded arguments", ({ args }) => {
    expect(() => parsePreflightArgs(args)).toThrow();
  });
});
