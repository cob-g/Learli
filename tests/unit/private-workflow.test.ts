import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthRuntime } from "@/lib/auth-factory";
import { parseServerEnv } from "@/lib/env/schema";
import { parseHostedAuthConfig } from "@/features/hosted-auth/config";
import { admissionPolicyDigest } from "@/features/learner-admission/policy";
import { bookingPolicyDigest } from "@/features/booking-workflows/policy";
import {
  parsePrivateWorkflow,
  PrivateWorkflowError,
  type PrivateWorkflowBinding,
} from "@/features/private-workflow/config";
import {
  getPrivateWorkflow,
  isPrivateWorkflow,
  privatePolicyEnvironment,
} from "@/features/private-workflow/runtime";
import {
  hostedTestSource,
  hostedTestPacket,
} from "../support/hosted-auth-packet";

const origin = "http://127.0.0.1:3100";
const emails = [
  "parent@example.test",
  "tutor@example.test",
  "admin@example.test",
];
const localTarget = {
  mode: "local-test",
  host: "127.0.0.1",
  port: 55432,
  database: "learli_test",
  runtimeRole: "learli_app",
} as const;
const localBinding: PrivateWorkflowBinding = { origin, database: localTarget };
const localSource = {
  APP_ENV: "test",
  AUTH_MODE: "local",
  APP_URL: origin,
  DATABASE_URL:
    "postgresql://learli_app:fictional-unit-test-credential@127.0.0.1:55432/learli_test",
  BETTER_AUTH_SECRET: "fictional-private-workflow-unit-auth-secret",
};
function packet() {
  const admissionTerms = {
    authority: "synthetic_test",
    source: "synthetic_readiness",
    version: "synthetic-admission-v1",
    reference: "synthetic:admission:v1",
    marketCode: "synthetic_test",
    noticeVersion: "synthetic-notice-v1",
    guardianProofMethod: "synthetic_guardian_review",
    independentEligibilityRule: "synthetic_independent_review",
    reviewerCapabilityCode: "learner_admission_review",
    revocationEffect: "deny_current_learner_access",
  } as const;
  const admission = {
    ...admissionTerms,
    policyId: "11111111-1111-4111-8111-111111111111",
    contentDigest: admissionPolicyDigest(admissionTerms),
  };
  const bookingTerms = {
    authority: "synthetic_test",
    source: "synthetic_readiness",
    version: "synthetic-booking-v2",
    reference: "synthetic:booking:v2",
    admissionPolicyId: admission.policyId,
    durationMinutes: 60,
    stepMinutes: 30,
    noticeMinutes: 60,
    horizonDays: 14,
    provisionalMinutes: 10,
    cancelCutoffMinutes: 60,
    moveCutoffMinutes: 60,
    confirmationPrerequisite: "synthetic_prerequisite_review",
    confirmationActor: "assigned_mfa_admin",
    outcomeActor: "assigned_mfa_admin",
    disputePath: "/support",
    meetingAccess: "confirmed_until_end",
    completionActor: "assigned_tutor",
  } as const;
  return {
    version: 1,
    purpose: "private_fictional_workflow",
    audience: "fictional_only",
    realIntake: "disabled",
    payments: "disabled",
    origin,
    accountEmails: [...emails],
    database: { ...localTarget },
    admission,
    screening: {
      mode: "synthetic_test",
      provenance: "synthetic_readiness",
      version: "fictional-workflow-v1",
      reference: "policy:33333333-3333-4333-8333-333333333333",
      authorityReference: "synthetic:44444444-4444-4444-8444-444444444444",
      validFrom: "2026-10-01T00:00:00Z",
      validUntil: "2026-11-01T00:00:00Z",
      requiredCheckCodes: ["fictional_identity", "fictional_safeguarding"],
      allowedActions: [
        "approve",
        "reject",
        "suspend",
        "reinstate",
        "reopen",
        "revoke",
      ],
      expiryRule: "all_checks_current",
    },
    booking: {
      ...bookingTerms,
      policyId: "22222222-2222-4222-8222-222222222222",
      contentDigest: bookingPolicyDigest(bookingTerms),
    },
  };
}
const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function environment(source: Record<string, string | undefined> = localSource) {
  for (const key of [
    "APP_ENV",
    "APP_URL",
    "AUTH_MODE",
    "DATABASE_MODE",
    "DATABASE_URL",
    "DATABASE_URL_DIRECT",
    "NEON_DEVELOPMENT_CONFIG_FILE",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "HOSTED_INGRESS_SECRET",
    "HOSTED_AUTH_CONFIG_FILE",
    "PRIVATE_WORKFLOW_CONFIG_FILE",
    "RESEND_API_KEY",
    "EMAIL_FROM",
  ])
    vi.stubEnv(key, source[key]);
}
function localRuntime(override: Record<string, unknown> = {}) {
  return {
    environment: "test",
    origin,
    pool: {
      options: {
        host: localTarget.host,
        port: localTarget.port,
        database: localTarget.database,
        user: localTarget.runtimeRole,
      },
    },
    ...override,
  } as unknown as AuthRuntime;
}
function privateFile(value: unknown = packet()) {
  const root = mkdtempSync(path.join(os.tmpdir(), "learli-private-workflow-"));
  roots.push(root);
  const directory = path.join(root, ".local");
  mkdirSync(directory, { mode: 0o700 });
  const file = path.join(directory, "workflow.json");
  writeFileSync(file, JSON.stringify(value), { mode: 0o600 });
  vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", file);
  return { root, directory, file };
}
function hosted() {
  const source = hostedTestSource();
  const config = parseHostedAuthConfig(source, hostedTestPacket(emails));
  const target = config.database.target;
  const database = {
    mode: "hosted-staging",
    projectId: target.projectId,
    branchId: target.branchId,
    endpointId: target.endpointId,
    database: target.database,
  } as const;
  return {
    source,
    config,
    value: { ...packet(), origin: config.origin, database },
    expected: {
      origin: config.origin,
      database,
      accountEmails: config.accountEmails,
    } satisfies PrivateWorkflowBinding,
    runtime: {
      environment: "staging",
      origin: config.origin,
      hosted: config,
    } as unknown as AuthRuntime,
  };
}

describe("explicit fictional workflow policy packet", () => {
  it("binds local test receipts, normalizes account order and freezes consumed authority", () => {
    const value = packet();
    const result = parsePrivateWorkflow(value, localBinding);
    expect(result.accountEmails).toEqual([...emails].sort());
    expect(result.booking.version).toBe("synthetic-booking-v2");
    expect(result.booking.completionActor).toBe("assigned_tutor");
    for (const part of [
      result,
      result.accountEmails,
      result.database,
      result.admission,
      result.screening,
      result.screening.requiredCheckCodes,
      result.screening.allowedActions,
      result.booking,
    ])
      expect(Object.isFrozen(part)).toBe(true);
    value.screening.requiredCheckCodes[0] = "changed_after_admission";
    expect(result.screening.requiredCheckCodes[0]).toBe("fictional_identity");
  });
  it.each([
    { version: 2 },
    { purpose: "normal_workflow" },
    { audience: "real_families" },
    { realIntake: "enabled" },
    { payments: "enabled" },
    { credentials: "must-not-be-admitted" },
    { origin: "http://127.0.0.1:3999" },
    { origin: `${origin}/` },
    { accountEmails: [] },
    { accountEmails: ["parent@example.com"] },
    { accountEmails: ["Parent@example.test"] },
    { accountEmails: [emails[0], emails[0]] },
    {
      accountEmails: Array.from(
        { length: 101 },
        (_, i) => `a${i}@example.test`,
      ),
    },
    { admission: { authority: "disabled" } },
    { screening: { mode: "disabled" } },
    { booking: { authority: "disabled" } },
  ])("refuses unsafe audience/configuration %j", (override) => {
    expect(() =>
      parsePrivateWorkflow({ ...packet(), ...override }, localBinding),
    ).toThrow(PrivateWorkflowError);
  });
  it("rejects altered or unrelated policy receipts and legacy admin-only completion", () => {
    const value = packet();
    const foreign = {
      ...value.booking,
      admissionPolicyId: "99999999-9999-4999-8999-999999999999",
    };
    foreign.contentDigest = bookingPolicyDigest(foreign);
    const legacy = {
      ...value.booking,
      version: "synthetic-booking-v1" as const,
      reference: "synthetic:booking:v1" as const,
    };
    const { completionActor, ...legacyTerms } = legacy;
    void completionActor;
    legacyTerms.contentDigest = bookingPolicyDigest(legacyTerms);
    for (const override of [
      { admission: { ...value.admission, contentDigest: "0".repeat(64) } },
      { screening: { ...value.screening, requiredCheckCodes: [] } },
      { booking: { ...value.booking, contentDigest: "0".repeat(64) } },
      { booking: foreign },
      { booking: legacyTerms },
    ])
      expect(() =>
        parsePrivateWorkflow({ ...value, ...override }, localBinding),
      ).toThrow(PrivateWorkflowError);
  });
  it("binds exact local database identity and the canonical loopback origin", () => {
    for (const database of [
      { ...localTarget, port: 5432 },
      { ...localTarget, database: "learli_dev" },
      { ...localTarget, runtimeRole: "learli_owner" },
      { ...localTarget, host: "localhost" },
    ])
      expect(() =>
        parsePrivateWorkflow({ ...packet(), database }, localBinding),
      ).toThrow(PrivateWorkflowError);
    const remote = "https://elsewhere.example.test";
    expect(() =>
      parsePrivateWorkflow(
        { ...packet(), origin: remote },
        { ...localBinding, origin: remote },
      ),
    ).toThrow(PrivateWorkflowError);
  });
  it("requires the exact hosted target and selected membership set, regardless of ordering", () => {
    const h = hosted();
    expect(parsePrivateWorkflow(h.value, h.expected).database).toEqual(
      h.value.database,
    );
    expect(
      parsePrivateWorkflow(
        { ...h.value, accountEmails: [...emails].reverse() },
        h.expected,
      ).accountEmails,
    ).toEqual([...emails].sort());
    for (const override of [
      { accountEmails: [emails[0]] },
      { accountEmails: [...emails, "unlisted@example.test"] },
      { database: { ...h.value.database, projectId: "other-project" } },
      { database: { ...h.value.database, branchId: "br-other" } },
      { database: { ...h.value.database, endpointId: "ep-other" } },
      { database: { ...h.value.database, database: "other_staging" } },
    ])
      expect(() =>
        parsePrivateWorkflow({ ...h.value, ...override }, h.expected),
      ).toThrow(PrivateWorkflowError);
  });
});

describe("private workflow runtime admission", () => {
  it("preserves absent defaults and the actual legacy validation environment", () => {
    environment();
    expect(getPrivateWorkflow(localRuntime())).toBeNull();
    expect(isPrivateWorkflow(localRuntime())).toBe(false);
    expect(
      privatePolicyEnvironment(localRuntime(), "booking", packet().booking),
    ).toBe("test");
    const h = hosted();
    expect(getPrivateWorkflow(h.runtime)).toBeNull();
    expect(
      privatePolicyEnvironment(h.runtime, "booking", packet().booking),
    ).toBe("staging");
  });
  it("reads each private packet afresh and fails closed after removal or unsafe replacement", () => {
    environment();
    const { file } = privateFile();
    const runtime = localRuntime();
    expect(isPrivateWorkflow(runtime)).toBe(true);
    writeFileSync(file, JSON.stringify({ ...packet(), payments: "enabled" }));
    expect(() => getPrivateWorkflow(runtime)).toThrow(PrivateWorkflowError);
    rmSync(file);
    expect(() => getPrivateWorkflow(runtime)).toThrow(PrivateWorkflowError);
  });
  it.each([
    "world-readable",
    "unsafe-directory",
    "symlink",
    "oversized",
    "malformed",
  ])("rejects a %s packet without exposing its contents or path", (mode) => {
    environment();
    const { file, directory } = privateFile();
    if (mode === "world-readable") chmodSync(file, 0o644);
    if (mode === "unsafe-directory") chmodSync(directory, 0o755);
    if (mode === "symlink") {
      const next = path.join(directory, "linked.json");
      symlinkSync(file, next);
      vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", next);
    }
    if (mode === "oversized")
      writeFileSync(file, "sensitive-marker".repeat(5000));
    if (mode === "malformed") writeFileSync(file, '{"sensitive-marker":');
    let error: unknown;
    try {
      getPrivateWorkflow(localRuntime());
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(PrivateWorkflowError);
    expect(String(error)).not.toContain("sensitive-marker");
    expect(String(error)).not.toContain(file);
  });
  it.each([
    { APP_ENV: "production", AUTH_MODE: "disabled" },
    { APP_ENV: "development" },
    { AUTH_MODE: "disabled" },
    { DATABASE_MODE: "neon-development" },
  ])("refuses incompatible mode before reading a packet %j", (override) => {
    environment({ ...localSource, ...override });
    vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", "/missing/private-file.json");
    expect(() => getPrivateWorkflow(localRuntime())).toThrow(
      PrivateWorkflowError,
    );
  });
  it("rejects a runtime origin or actual local pool that disagrees with admitted configuration", () => {
    environment();
    privateFile();
    expect(() =>
      getPrivateWorkflow(localRuntime({ origin: "http://127.0.0.1:3999" })),
    ).toThrow(PrivateWorkflowError);
    for (const override of [
      { user: "learli_owner" },
      { host: "localhost" },
      { port: 5432 },
      { database: "learli_dev" },
    ]) {
      const base = localRuntime();
      const pool = {
        options: {
          ...("options" in base.pool ? base.pool.options : {}),
          ...override,
        },
      };
      expect(() => getPrivateWorkflow(localRuntime({ pool }))).toThrow(
        PrivateWorkflowError,
      );
    }
  });
  it("accepts only a registered hosted configuration and scopes test context to exact receipts", () => {
    const h = hosted();
    environment(h.source);
    privateFile(h.value);
    expect(isPrivateWorkflow(h.runtime)).toBe(true);
    for (const kind of ["admission", "screening", "booking"] as const)
      expect(privatePolicyEnvironment(h.runtime, kind, h.value[kind])).toBe(
        "test",
      );
    expect(
      privatePolicyEnvironment(h.runtime, "booking", { authority: "disabled" }),
    ).toBe("staging");
    expect(
      privatePolicyEnvironment(h.runtime, "screening", { mode: "disabled" }),
    ).toBe("staging");
    const foreign = {
      ...h.value.booking,
      policyId: "99999999-9999-4999-8999-999999999999",
    };
    expect(privatePolicyEnvironment(h.runtime, "booking", foreign)).toBe(
      "staging",
    );
    expect(
      privatePolicyEnvironment(h.runtime, "admission", { malformed: true }),
    ).toBe("staging");
    const forged = { ...h.runtime, hosted: { ...h.config } } as AuthRuntime;
    expect(() => getPrivateWorkflow(forged)).toThrow(PrivateWorkflowError);
  });
  it("refuses an active invalid packet even when merely checking policy environment", () => {
    environment();
    privateFile({ ...packet(), payments: "enabled" });
    expect(() => isPrivateWorkflow(localRuntime())).toThrow(
      PrivateWorkflowError,
    );
    expect(() =>
      privatePolicyEnvironment(localRuntime(), "booking", packet().booking),
    ).toThrow(PrivateWorkflowError);
  });
  it("admits the selector only in explicit local test or hosted staging environment modes", () => {
    const selected = { PRIVATE_WORKFLOW_CONFIG_FILE: "/private/workflow.json" };
    expect(
      parseServerEnv({ ...localSource, ...selected })
        .PRIVATE_WORKFLOW_CONFIG_FILE,
    ).toBe(selected.PRIVATE_WORKFLOW_CONFIG_FILE);
    expect(
      parseServerEnv({ ...hostedTestSource(), ...selected })
        .PRIVATE_WORKFLOW_CONFIG_FILE,
    ).toBe(selected.PRIVATE_WORKFLOW_CONFIG_FILE);
    for (const APP_ENV of ["production", "development"])
      expect(() =>
        parseServerEnv({ ...localSource, ...selected, APP_ENV }),
      ).toThrow("PRIVATE_WORKFLOW_CONFIG_FILE");
  });
});
