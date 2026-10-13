/** Local synthetic browser composition. The shipped two factories stay disabled. */
import { createHash, randomUUID } from "node:crypto";
import {
  cp,
  mkdir,
  readdir,
  readFile,
  writeFile,
  symlink,
  chmod,
} from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import {
  assertOwnedReadinessDatabase,
  screeningMirrorPort,
  screeningMirrorOrigin,
} from "../tests/support/readiness-placement";
import { spawn } from "node:child_process";
import {
  openWorld,
  closeWorld,
  createAccount,
  password,
} from "../tests/integration/support";
import { screeningActions } from "../src/features/tutor-screening/policy";
import {
  safeguardingPolicyInput,
  responseActions,
} from "../src/features/safeguarding/policy";
import {
  provisionScreeningPolicy,
  selectScreeningPolicy,
} from "../src/features/tutor-screening/fixture-tooling";
import {
  provisionResponseStaff,
  provisionResponsePolicy,
} from "../src/features/safeguarding/fixture-tooling";
const root = process.cwd(),
  dir = path.join(root, ".local/screening-safeguarding/mirror");
assertOwnedReadinessDatabase(root);
await new Promise<void>((resolve, reject) => {
  const listener = createServer();
  listener.once("error", () =>
    reject(new Error("Assigned screening mirror port is occupied.")),
  );
  listener.listen(screeningMirrorPort, "127.0.0.1", () =>
    listener.close(() => resolve()),
  );
});
await mkdir(dir, { recursive: true, mode: 0o700 });
await chmod(dir, 0o700);
const w = openWorld();
const accounts: Record<string, { id: string; email: string; name: string }> =
  {};
try {
  for (const name of [
    "reviewer",
    "escalation",
    "dispatcher",
    "restriction",
    "outsider",
  ]) {
    const a = await createAccount(w, [], `Fictional W8 ${name}`);
    await w.owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
      [a.id],
    );
    accounts[name] = { id: a.id, email: a.email, name: a.name };
  }
  const now = Date.now(),
    until = new Date(now + 6 * 3600000),
    version = "browser-" + randomUUID();
  const screening = {
    mode: "synthetic_test" as const,
    provenance: "synthetic_readiness" as const,
    version,
    reference: `policy:${randomUUID()}`,
    authorityReference: `synthetic:${randomUUID()}`,
    validFrom: new Date(now - 60000).toISOString(),
    validUntil: until.toISOString(),
    requiredCheckCodes: ["synthetic_check_a", "synthetic_check_b"],
    allowedActions: [...screeningActions],
    expiryRule: "all_checks_current" as const,
  };
  const safeguarding = safeguardingPolicyInput.parse({
    mode: "synthetic_test" as const,
    provenance: "synthetic_readiness" as const,
    version,
    reference: `policy:${randomUUID()}`,
    validFrom: new Date(now - 60000).toISOString(),
    validUntil: until.toISOString(),
    responsibleOwnerId: accounts.reviewer.id,
    escalationOwnerId: accounts.escalation.id,
    reportingGuidanceReference: `synthetic:${randomUUID()}`,
    meetingGuidanceReference: `synthetic:${randomUUID()}`,
    allowedActions: [...responseActions],
    reasonCodes: ["synthetic_safety_restrict", "synthetic_safety_restore"],
  });
  await provisionScreeningPolicy(w.owner, screening);
  await selectScreeningPolicy(w.owner, version);
  for (const name of ["reviewer", "escalation"])
    await provisionResponseStaff(w.owner, accounts[name].id, until);
  await provisionResponsePolicy(w.owner, safeguarding);
  await writeFile(
    path.join(root, ".local/screening-safeguarding/browser-fixture.json"),
    JSON.stringify({ accounts, password, screening, safeguarding }, null, 2),
    { mode: 0o600 },
  );
  const copied = [
    "src",
    ...(existsSync(path.join(root, "public")) ? ["public"] : []),
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
    "postcss.config.mjs",
    "next-env.d.ts",
  ];
  for (const f of copied)
    await cp(path.join(root, f), path.join(dir, f), { recursive: true });
  try {
    await symlink(
      path.join(root, "node_modules"),
      path.join(dir, "node_modules"),
      "dir",
    );
  } catch (e) {
    if (!(e instanceof Error && "code" in e && e.code === "EEXIST")) throw e;
  }
  const hashes: Record<string, string> = {};
  async function inventory(folder: string) {
    for (const f of await readdir(folder, { withFileTypes: true })) {
      const target = path.join(folder, f.name);
      if (f.isDirectory()) await inventory(target);
      else if (f.isFile())
        hashes[path.relative(dir, target)] = createHash("sha256")
          .update(await readFile(target))
          .digest("hex");
    }
  }
  await inventory(path.join(dir, "src"));
  for (const f of copied.filter((f) => !["src", "public"].includes(f)))
    hashes[f] = createHash("sha256")
      .update(await readFile(path.join(dir, f)))
      .digest("hex");
  if (copied.includes("public")) await inventory(path.join(dir, "public"));
  const overrides = [];
  for (const [feature, packet] of [
    ["tutor-screening", screening],
    ["safeguarding", safeguarding],
  ] as const) {
    const rel = `src/features/${feature}/composition.ts`,
      before = await readFile(path.join(dir, rel), "utf8"),
      factory =
        feature === "tutor-screening"
          ? "getScreeningContext"
          : "getSafeguardingContext",
      type =
        feature === "tutor-screening"
          ? "ScreeningContext"
          : "SafeguardingContext",
      field = feature === "tutor-screening" ? "screening" : "safeguarding",
      validate =
        feature === "tutor-screening"
          ? "validateScreeningCapability"
          : "validateSafeguardingCapability";
    const after = `import type {AuthRuntime} from '@/lib/auth-factory';\nimport type {${type}} from './service';\nimport {${validate}} from './policy';\nexport function ${factory}(runtime:AuthRuntime):${type}{return {runtime,${field}:${validate}(${JSON.stringify(packet)},runtime.environment)}}\n`;
    await writeFile(path.join(dir, rel), after);
    overrides.push({
      path: rel,
      before,
      after,
      beforeHash: hashes[rel],
      afterHash: createHash("sha256").update(after).digest("hex"),
    });
  }
  await writeFile(
    path.join(root, ".local/screening-safeguarding/mirror-manifest.json"),
    JSON.stringify(
      { sourceRoot: root, sourceHashes: hashes, overrides },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  const env = {
    ...process.env,
    APP_URL: screeningMirrorOrigin,
    BETTER_AUTH_URL: screeningMirrorOrigin,
  };
  await closeWorld(w);
  if (process.argv.includes("serve")) {
    const executable = path.join(root, "node_modules/next/dist/bin/next");
    let child = spawn(process.execPath, [executable, "build"], {
      cwd: dir,
      env,
      stdio: "inherit",
    });
    for (const signal of ["SIGINT", "SIGTERM"] as const)
      process.on(signal, () => child.kill(signal));
    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`W8 mirror build failed (${code}).`));
      });
    });
    child = spawn(
      process.execPath,
      [
        executable,
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(screeningMirrorPort),
      ],
      { cwd: dir, env, stdio: "inherit" },
    );
    child.on("exit", (code) => {
      process.exitCode = code ?? 1;
    });
  }
} catch (e) {
  await closeWorld(w);
  throw e;
}
