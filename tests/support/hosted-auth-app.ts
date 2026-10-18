import {
  hostedBackendPort,
  hostedHttpsPort,
  hostedTlsPort,
  hostedBrowserHost,
} from "./hosted-auth-placement";
// Owned executable fixture. Only the three blueprint-named exports are substituted.
import { createHash, randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:net";
import { request } from "node:http";
import { createHostedAuthDatabase } from "./hosted-auth-runtime";
import { hostedTestOrigin, hostedTestPacket } from "./hosted-auth-packet";
import {
  createHostedBrowserProxy,
  hostedBrowserOrigin,
  ownedHttpsProbe,
} from "./hosted-auth-proxy";

const root = process.cwd(),
  output = path.join(root, ".local", "hosted-auth");
const statePath = path.join(output, "browser-state.json");
function privateWrite(file: string, value: unknown) {
  writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600 });
}
function digest(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}
async function free(port: number) {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once("error", () => reject(new Error("W3 assigned port occupied.")));
    server.listen(port, "127.0.0.1", () =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
}
async function files(directory: string): Promise<string[]> {
  const list: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) list.push(...(await files(file)));
    else if (entry.isFile()) list.push(file);
  }
  return list;
}
async function waitHealth(child: ChildProcess, signal: AbortSignal) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (signal.aborted) throw new Error("Owned fixture stop requested.");
    if (child.exitCode !== null)
      throw new Error("Owned hosted entry exited before ready.");
    const status = await probe("/api/health").catch(() => 0);
    if (status === 200) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Owned hosted entry readiness timed out.");
}
function probe(url: string, headers: Record<string, string> = {}) {
  return new Promise<number>((resolve, reject) => {
    const call = request(
      { host: "127.0.0.1", port: hostedBackendPort, path: url, headers },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    call.on("error", reject);
    call.end();
  });
}
async function stop(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null) return;
  const exit = new Promise<void>((resolve) =>
    child.once("exit", () => resolve()),
  );
  child.kill("SIGTERM");
  const timeout = setTimeout(() => child.kill("SIGKILL"), 15000);
  await exit;
  clearTimeout(timeout);
  if (child.exitCode !== 0)
    throw new Error("Owned hosted entry shutdown failed.");
}
async function main() {
  if (process.env.APP_ENV !== "test" || process.env.AUTH_MODE !== "local")
    throw new Error("Harness parent must use owned local test environment.");
  mkdirSync(output, { recursive: true, mode: 0o700 });
  for (const port of [hostedBackendPort, hostedHttpsPort, hostedTlsPort])
    await free(port);
  const termination = new AbortController();
  const requestStop = () => termination.abort();
  process.on("SIGTERM", requestStop);
  process.on("SIGINT", requestStop);
  process.env.LEARLI_STAGING_TEST_PORT = String(hostedTlsPort);
  let database:
    Awaited<ReturnType<typeof createHostedAuthDatabase>> | undefined;
  let backend: ChildProcess | undefined,
    proxy: Awaited<ReturnType<typeof createHostedBrowserProxy>> | undefined;
  let mirrorDirectory: string | undefined;
  try {
    database = await createHostedAuthDatabase();
    if (termination.signal.aborted)
      throw new Error("Owned fixture stop requested.");
    mkdirSync(output, { recursive: true, mode: 0o700 });
    const mirror = mkdtempSync(path.join(output, "browser-mirror-"));
    mirrorDirectory = mirror;
    mkdirSync(path.join(mirror, ".local"), { mode: 0o700 });
    const sources: Record<string, string> = {};
    for (const directory of ["src", "scripts", "tests", "public", "drizzle"]) {
      if (directory === "public" && !existsSync(path.join(root, directory)))
        continue;
      cpSync(path.join(root, directory), path.join(mirror, directory), {
        recursive: true,
      });
      for (const file of await files(path.join(root, directory)))
        sources[path.relative(root, file)] = digest(file);
    }
    for (const filename of [
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "next-env.d.ts",
      "next.config.ts",
      "postcss.config.mjs",
      "eslint.config.mjs",
      "playwright.config.ts",
      ".npmrc",
    ]) {
      if (!existsSync(path.join(root, filename))) continue;
      cpSync(path.join(root, filename), path.join(mirror, filename));
      sources[filename] = digest(path.join(root, filename));
    }
    symlinkSync(
      path.join(root, "node_modules"),
      path.join(mirror, "node_modules"),
      "dir",
    );
    const fixturePath = path.join(mirror, ".local", "fixture.json"),
      packetPath = path.join(mirror, ".local", "packet.json"),
      captures = path.join(mirror, ".local", "sdk-capture");
    const fixtureValue = {
      version: 1,
      origin: hostedBrowserOrigin,
      canonicalOrigin: hostedTestOrigin,
      trustedPeer: "192.0.2.10",
      pool: database.harness.settings("learli_app"),
      captureDirectory: captures,
    };
    privateWrite(fixturePath, fixtureValue);
    privateWrite(packetPath, hostedTestPacket());
    const configPath = path.join(mirror, "src/features/hosted-auth/config.ts"),
      stagingPath = path.join(mirror, "src/lib/db/staging-config.ts"),
      factoryPath = path.join(mirror, "src/features/hosted-auth/factory.ts");
    renameSync(
      configPath,
      configPath.replace("config.ts", "config-original.ts"),
    );
    renameSync(
      stagingPath,
      stagingPath.replace("staging-config.ts", "staging-config-original.ts"),
    );
    renameSync(
      factoryPath,
      factoryPath.replace("factory.ts", "factory-original.ts"),
    );
    // Fixture path is an owned generated literal, never an application env override.
    writeFileSync(
      configPath,
      `export * from "./config-original";\nimport { parseHostedAuthConfig as real, type HostedAuthConfig } from "./config-original";\nimport { readHostedAuthPacket } from "./config-file";\nconst fixturePath = ${JSON.stringify(fixturePath)};\nexport function parseHostedAuthConfig(source: Record<string,string|undefined>, packet: unknown): HostedAuthConfig {\nconst fixture = readHostedAuthPacket(process.cwd(), fixturePath) as {version:number; origin:string; canonicalOrigin:string; trustedPeer:string};\nif (fixture.version!==1 || fixture.origin!==${JSON.stringify(hostedBrowserOrigin)} || fixture.canonicalOrigin!=="https://accounts.learli.test" || !["127.0.0.1","192.0.2.10"].includes(fixture.trustedPeer) || source.APP_URL!==fixture.origin || source.BETTER_AUTH_URL!==fixture.origin) throw new Error("Owned fixture refused.");\nconst parsed = real({...source,APP_URL:fixture.canonicalOrigin,BETTER_AUTH_URL:fixture.canonicalOrigin},packet);\nreturn {...parsed,origin:fixture.origin,ingress:{mode:"trusted-proxy",clientIp:"shared-bucket",httpsHeader:"x-forwarded-proto",trustedPeerAddresses:[fixture.trustedPeer]},mail:parsed.mail.mode==="resend-single-attempt" ? {...parsed.mail,transport:{...parsed.mail.transport,appOrigin:fixture.origin,verifiedSender:{...parsed.mail.transport.verifiedSender,appOrigin:fixture.origin}}} : parsed.mail};\n}\n`,
      { mode: 0o600 },
    );
    writeFileSync(
      stagingPath,
      `export * from "./staging-config-original";\nimport { stagingPoolConfig as real, type StagingDatabaseConfig } from "./staging-config-original";\nimport { readHostedAuthPacket } from "../../features/hosted-auth/config-file";\nimport type { PoolConfig } from "pg";\nexport function stagingPoolConfig(config: StagingDatabaseConfig): PoolConfig {real(config); const fixture = readHostedAuthPacket(process.cwd(),${JSON.stringify(fixturePath)}) as {pool:PoolConfig}; if(fixture.pool.host!=="127.0.0.1" || fixture.pool.port!==${hostedTlsPort} || fixture.pool.database!=="learli_staging" || fixture.pool.user!=="learli_app" || typeof fixture.pool.ssl!=="object" || !fixture.pool.ssl.rejectUnauthorized) throw new Error("Owned TLS fixture refused."); return fixture.pool;}\n`,
      { mode: 0o600 },
    );
    writeFileSync(
      factoryPath,
      `import "server-only";\nimport {createSyntheticHostedProvider} from "../../../tests/support/hosted-auth-provider";\nimport {readHostedAuthPacket} from "./config-file";\nimport type {HostedAuthConfig} from "./config";\nexport async function createHostedAuth(config:HostedAuthConfig) {const fixture=readHostedAuthPacket(process.cwd(),${JSON.stringify(fixturePath)}) as {captureDirectory:string};if(config.origin!==${JSON.stringify(hostedBrowserOrigin)} || fixture.captureDirectory!==${JSON.stringify(captures)}) throw new Error("Owned provider fixture refused.");return createSyntheticHostedProvider(config,fixture.captureDirectory);}\nexport type HostedAuthRuntime=Awaited<ReturnType<typeof createHostedAuth>>;\n`,
      { mode: 0o600 },
    );
    const replacements = Object.fromEntries(
      [configPath, stagingPath, factoryPath].map((file) => [
        path.relative(mirror, file),
        {
          original: sources[path.relative(mirror, file)],
          replacement: digest(file),
        },
      ]),
    );
    privateWrite(path.join(mirror, ".local", "source-manifest.json"), {
      sources,
      replacements,
      allowedSeams: [
        "parseHostedAuthConfig",
        "stagingPoolConfig",
        "createHostedAuth",
      ],
      acceptance:
        "local fixture after admission; production parser/factory acceptance is separately denied",
    });
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      APP_ENV: "staging",
      AUTH_MODE: "hosted-synthetic",
      APP_URL: hostedBrowserOrigin,
      BETTER_AUTH_URL: hostedBrowserOrigin,
      HOSTED_AUTH_CONFIG_FILE: packetPath,
      HOSTED_INGRESS_SECRET: randomBytes(48).toString("hex"),
      BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
      PORT: String(hostedBackendPort),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
    };
    for (const key of [
      "DATABASE_URL",
      "DATABASE_URL_DIRECT",
      "RESEND_API_KEY",
      "EMAIL_FROM",
    ])
      delete env[key];
    const { openSync } = await import("node:fs");
    const buildLog = openSync(
      path.join(mirror, ".local", "build.log"),
      "w",
      0o600,
    );
    const build = spawn(
      process.execPath,
      [path.join(root, "node_modules/next/dist/bin/next"), "build"],
      {
        cwd: mirror,
        env: { ...env, AUTH_MODE: "disabled" },
        signal: termination.signal,
        stdio: ["ignore", buildLog, buildLog],
      },
    );
    const buildExit = await new Promise<number | null>((resolve) => {
      build.once("exit", resolve);
      build.once("error", () => resolve(1));
    });
    if (buildExit !== 0)
      throw new Error(
        "Owned mirrored app build failed. Private evidence retained.",
      );
    const privateMarkers = [
      env.BETTER_AUTH_SECRET!,
      env.HOSTED_INGRESS_SECRET!,
      String(fixtureValue.pool.password),
      fixturePath,
      captures,
    ];
    const clientFiles = await files(path.join(mirror, ".next/static"));
    if (
      clientFiles.some((file) => {
        const bytes = readFileSync(file).toString("utf8");
        return privateMarkers.some((marker) => bytes.includes(marker));
      })
    )
      throw new Error("Owned client artifact privacy failed.");
    const launch = () => {
      const log = openSync(
        path.join(mirror, ".local", `entry-${Date.now()}.log`),
        "w",
        0o600,
      );
      return spawn(
        process.execPath,
        ["--import", "tsx", "scripts/start-hosted-auth.ts"],
        { cwd: mirror, env, detached: true, stdio: ["ignore", log, log] },
      );
    };
    backend = launch();
    await waitHealth(backend, termination.signal);
    const deniedPeer = await probe("/sign-in", {
      Host: hostedBrowserHost,
      "x-forwarded-proto": "https",
      "x-learli-ingress-token": env.HOSTED_INGRESS_SECRET!,
    });
    if (deniedPeer !== 403)
      throw new Error("Actual unknown-peer startup denial failed.");
    await stop(backend);
    backend = undefined;
    await free(hostedBackendPort);
    privateWrite(fixturePath, { ...fixtureValue, trustedPeer: "127.0.0.1" });
    backend = launch();
    await waitHealth(backend, termination.signal);
    if (
      (await probe("/sign-in", {
        Host: hostedBrowserHost,
        "x-forwarded-proto": "http",
      })) !== 403
    )
      throw new Error("HTTP marker denial failed.");
    proxy = await createHostedBrowserProxy(database.harness.directory);
    if ((await ownedHttpsProbe(database.harness.ca)) !== 200)
      throw new Error("Owned HTTPS validation failed.");
    let wrongCaDenied = false;
    try {
      await ownedHttpsProbe(database.harness.untrustedCa);
    } catch {
      wrongCaDenied = true;
    }
    if (!wrongCaDenied) throw new Error("Wrong HTTPS trust was accepted.");
    privateWrite(statePath, {
      version: 1,
      mirror,
      captures,
      ownerSettings: database.harness.settings("learli_migrator"),
      origin: hostedBrowserOrigin,
      startup: {
        deniedPeer,
        httpMarkerDenied: true,
        realCaValidated: true,
        wrongCaDenied,
        firstEntryExited: true,
      },
      replacements,
      privateMarkers,
      bundlePrivacy: {
        scanned: clientFiles.length,
        privateMarkersAbsent: true,
      },
    });
    process.stdout.write("Owned hosted HTTPS fixture ready.\n");
    await new Promise<void>((resolve) => {
      if (termination.signal.aborted) return resolve();
      termination.signal.addEventListener("abort", () => resolve(), {
        once: true,
      });
      backend!.once("exit", resolve);
    });
  } finally {
    const stopped = await Promise.allSettled([proxy?.close(), stop(backend)]);
    try {
      await database?.close();
    } finally {
      const ports = await Promise.allSettled([
        free(hostedBackendPort),
        free(hostedHttpsPort),
        free(hostedTlsPort),
      ]);
      const shutdownProof = {
        mirror: mirrorDirectory ?? null,
        stopped: stopped.every((r) => r.status === "fulfilled"),
        portsClosed: ports.every((r) => r.status === "fulfilled")
          ? [hostedBackendPort, hostedHttpsPort, hostedTlsPort]
          : [],
      };
      if (mirrorDirectory)
        privateWrite(
          path.join(mirrorDirectory, ".local/shutdown.json"),
          shutdownProof,
        );
      privateWrite(path.join(output, "browser-shutdown.json"), shutdownProof);
      if (
        stopped.some((r) => r.status === "rejected") ||
        ports.some((r) => r.status === "rejected")
      )
        throw new Error("Owned harness cleanup incomplete.");
    }
  }
}
void main().catch(() => {
  process.stderr.write(
    "Owned hosted HTTPS harness failed. Private evidence retained.\n",
  );
  process.exitCode = 1;
});
