/** Local synthetic browser composition. The shipped four factories stay disabled. */
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
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import {
  assertOwnedReadinessDatabase,
  screeningMirrorOrigin,
  screeningMirrorPort,
} from "../tests/support/readiness-placement";
import {
  openWorld,
  closeWorld,
  createAccount,
  password,
} from "../tests/integration/support";
import {
  safeguardingPolicyInput,
  responseActions,
} from "../src/features/safeguarding/policy";
import {
  provisionResponseStaff,
  provisionResponsePolicy,
} from "../src/features/safeguarding/fixture-tooling";
import {
  workflowFixture,
  admittedFixture,
} from "../tests/support/booking-workflows-fixtures";
import { provisionPublicationPolicy } from "../tests/support/review-publication-fixtures";
const root = process.cwd(),
  dir = path.join(root, ".local/screening-safeguarding/mirror");
assertOwnedReadinessDatabase(root);
await new Promise<void>((resolve, reject) => {
  const listener = createServer();
  listener.once("error", () =>
    reject(new Error("Assigned readiness mirror port is occupied.")),
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
  const setupReviewer = await createAccount(
    w,
    ["admin"],
    "Fictional W6 setup reviewer",
  );
  const publication = await provisionPublicationPolicy(w);
  const publicationReviewer = await createAccount(
    w,
    [],
    "Fictional W7 browser moderator",
  );
  await w.owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
    [publicationReviewer.id],
  );
  await mkdir(path.join(root, ".local/review-publication"), {
    recursive: true,
    mode: 0o700,
  });
  await writeFile(
    path.join(root, ".local/review-publication/browser-fixture.json"),
    JSON.stringify({
      publication,
      reviewer: {
        id: publicationReviewer.id,
        email: publicationReviewer.email,
      },
      password,
      origin: screeningMirrorOrigin,
      sourceRoot: root,
    }),
    { mode: 0o600 },
  );
  const workflow = await workflowFixture(w, setupReviewer),
    college = await admittedFixture(w, setupReviewer, "self"),
    browserReviewer = await createAccount(
      w,
      [],
      "Fictional W6 browser reviewer",
    );
  await w.owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
    [browserReviewer.id],
  );
  const now = Date.now(),
    until = new Date(now + 6 * 3600000),
    version = "browser-" + randomUUID();
  const screening = workflow.policy;
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

  for (const name of ["reviewer", "escalation"])
    await provisionResponseStaff(w.owner, accounts[name].id, until);
  await provisionResponsePolicy(w.owner, safeguarding);
  await writeFile(
    path.join(root, ".local/screening-safeguarding/browser-fixture.json"),
    JSON.stringify({ accounts, password, screening, safeguarding }, null, 2),
    { mode: 0o600 },
  );
  await mkdir(path.join(root, ".local/booking-workflows"), {
    recursive: true,
    mode: 0o700,
  });
  await writeFile(
    path.join(root, ".local/booking-workflows/browser-fixture.json"),
    JSON.stringify({
      parent: {
        id: workflow.requester.id,
        email: workflow.requester.email,
        learnerId: workflow.learner.id,
        learnerName: workflow.learner.displayName,
      },
      college: {
        id: college.requester.id,
        email: college.requester.email,
        learnerId: college.learner.id,
        learnerName: college.learner.displayName,
      },
      reviewer: { id: browserReviewer.id, email: browserReviewer.email },
      tutor: {
        id: workflow.tutor.id,
        email: workflow.tutor.email,
        profileId: workflow.profile.id,
        slug: workflow.profile.slug,
      },
      password,
      booking: workflow.booking,
      admission: workflow.admission,
      origin: screeningMirrorOrigin,
      sourceRoot: root,
    }),
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
  for (const [rel, after] of [
    [
      "src/features/learner-admission/context.ts",
      `import type {AuthRuntime} from '@/lib/auth-factory';import type {AdmissionContext} from './service';import {validateAdmissionCapability} from './policy';export function admissionContext(runtime:AuthRuntime):AdmissionContext{return {runtime,admission:validateAdmissionCapability(${JSON.stringify(workflow.admission)})}}`,
    ],
    [
      "src/features/booking-workflows/composition.ts",
      `import type {AuthRuntime} from '@/lib/auth-factory';import type {BookingWorkflowContext} from './service';import {validateBookingCapability} from './policy';export function bookingWorkflowContext(runtime:AuthRuntime):BookingWorkflowContext{return {runtime,booking:validateBookingCapability(${JSON.stringify(workflow.booking)},runtime.environment)}}`,
    ],
    [
      "src/features/review-publication/composition.ts",
      `import type {AuthRuntime} from '@/lib/auth-factory';import type {PublicationContext} from './service';import {validatePublicationCapability} from './policy';export function publicationContext(runtime:AuthRuntime):PublicationContext{return {runtime,publication:validatePublicationCapability(${JSON.stringify(publication)},runtime.environment)}}`,
    ],
  ] as const) {
    const before = await readFile(path.join(dir, rel), "utf8");
    await writeFile(path.join(dir, rel), after);
    overrides.push({
      path: rel,
      before,
      after,
      beforeHash: hashes[rel],
      afterHash: createHash("sha256").update(after).digest("hex"),
    });
  }
  const actualHashes: Record<string, string> = {};
  async function actualInventory(folder: string) {
    for (const file of await readdir(folder, { withFileTypes: true })) {
      const target = path.join(folder, file.name);
      if (file.isDirectory()) await actualInventory(target);
      else if (file.isFile())
        actualHashes[path.relative(dir, target)] = createHash("sha256")
          .update(await readFile(target))
          .digest("hex");
    }
  }
  await actualInventory(path.join(dir, "src"));
  for (const name of copied.filter((name) => !["src", "public"].includes(name)))
    actualHashes[name] = createHash("sha256")
      .update(await readFile(path.join(dir, name)))
      .digest("hex");
  if (copied.includes("public"))
    await actualInventory(path.join(dir, "public"));
  const allowed = new Map(overrides.map((o) => [o.path, o.afterHash]));
  if (
    overrides.length !== 5 ||
    Object.keys(actualHashes).length !== Object.keys(hashes).length ||
    Object.keys(hashes).some(
      (name) => actualHashes[name] !== (allowed.get(name) ?? hashes[name]),
    )
  )
    throw new Error("Exact five-factory mirror identity mismatch.");
  await writeFile(
    path.join(root, ".local/screening-safeguarding/mirror-manifest.json"),
    JSON.stringify(
      { sourceRoot: root, sourceHashes: hashes, actualHashes, overrides },
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
  if (process.argv.includes("serve") || process.argv.includes("build")) {
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
        else reject(new Error(`W6 mirror build failed (${code}).`));
      });
    });
    if (process.argv.includes("build")) process.exit(0);
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
