import { randomUUID } from "node:crypto";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookingPolicyDigest } from "@/features/booking-workflows/policy";
import { parsePrivateWorkflow } from "@/features/private-workflow/config";
import { createDatabase } from "@/lib/db/connection";
import {
  readPrivateWorkflowOperatorScope,
  runPrivateWorkflowOperation,
} from "@/features/private-workflow/operator";
import {
  dispatchManualPreview,
  manualPreviewDispatchMain,
} from "../../scripts/manual-preview-dispatch";
import { loadOwnedPrivateWorkflow } from "../../scripts/private-workflow-local";
import { syntheticAdmissionPolicy } from "../support/learner-admission-fixtures";

vi.mock("@/lib/db/connection", () => ({ createDatabase: vi.fn() }));
vi.mock("@/features/private-workflow/operator", async (original) => ({
  ...(await original<typeof import("@/features/private-workflow/operator")>()),
  readPrivateWorkflowOperatorScope: vi.fn(),
  runPrivateWorkflowOperation: vi.fn(),
}));

const origin = "http://127.0.0.1:3200";
const reviewerEmail = "manual-admin@learli.test";
const expected = {
  origin,
  database: {
    mode: "local-test",
    host: "127.0.0.1",
    port: 55433,
    database: "learli_test",
    runtimeRole: "learli_app",
  },
} as const;
const roots: string[] = [];
const applied = {
  action: "assign-admission" as const,
  status: "applied" as const,
  policies: 0,
  reviewers: 0,
  assignments: 1,
  confirmationGrants: 0,
};

function packet() {
  const admission = syntheticAdmissionPolicy(randomUUID());
  const terms = {
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
  return parsePrivateWorkflow(
    {
      version: 1,
      purpose: "private_fictional_workflow",
      audience: "fictional_only",
      realIntake: "disabled",
      payments: "disabled",
      origin,
      accountEmails: [
        reviewerEmail,
        "manual-parent@learli.test",
        "manual-tutor@learli.test",
      ],
      database: expected.database,
      admission,
      screening: {
        mode: "synthetic_test",
        provenance: "synthetic_readiness",
        version: "manual-dispatch-test",
        reference: `policy:${randomUUID()}`,
        authorityReference: `synthetic:${randomUUID()}`,
        validFrom: new Date(Date.now() - 60000).toISOString(),
        validUntil: new Date(Date.now() + 86400000).toISOString(),
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
        ...terms,
        policyId: randomUUID(),
        contentDigest: bookingPolicyDigest(terms),
      },
    },
    expected,
  );
}
function connection(rows: Record<string, unknown>[] = []) {
  return {
    query: vi.fn(async (text: string) => ({
      rows: text.includes("SELECT kind,id,blocked") ? rows : [],
      rowCount: 0,
    })),
  };
}
function local() {
  const root = mkdtempSync(path.join(os.tmpdir(), "learli-manual-dispatch-"));
  roots.push(root);
  mkdirSync(path.join(root, ".local/postgres"), {
    recursive: true,
    mode: 0o700,
  });
  writeFileSync(
    path.join(root, ".local/postgres/learli-owned"),
    "Learli local development cluster\n",
    { mode: 0o600 },
  );
  writeFileSync(
    path.join(root, ".local/database.json"),
    JSON.stringify({
      ports: { database: 55433 },
      ownerPassword: "fictional-owner",
      appPassword: "fictional-app",
    }),
    { mode: 0o600 },
  );
  const file = path.join(root, ".local/packet.json");
  writeFileSync(file, JSON.stringify(packet()), { mode: 0o600 });
  for (const [key, value] of Object.entries({
    APP_ENV: "test",
    AUTH_MODE: "local",
    DATABASE_MODE: "local",
    APP_URL: origin,
    DATABASE_URL:
      "postgresql://learli_app:fictional-app@127.0.0.1:55433/learli_test",
    DATABASE_URL_DIRECT:
      "postgresql://learli_owner:fictional-owner@127.0.0.1:55433/learli_test",
  }))
    vi.stubEnv(key, value);
  return { root, file };
}

beforeEach(() => {
  vi.mocked(readPrivateWorkflowOperatorScope).mockResolvedValue(
    "manual-admin-id",
  );
  vi.mocked(runPrivateWorkflowOperation).mockResolvedValue(applied);
});
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("bounded explicit manual preparation", () => {
  it("records exact scope first, runs only sequential strict metadata actions and prints safe counts", async () => {
    const value = packet();
    const targets = ["admission", "screening", "confirmation"].map((kind) => ({
      kind,
      id: randomUUID(),
      blocked: false,
    }));
    const client = connection(targets);
    const receipts: unknown[] = [];
    const assertCurrent = vi.fn();
    const record = vi.fn((receipt) => receipts.push(structuredClone(receipt)));
    vi.mocked(runPrivateWorkflowOperation).mockImplementation(
      async (_c, _p, _e, input, recheck) => {
        expect(record).toHaveBeenCalled();
        recheck?.();
        const action = (input as { action: string }).action;
        return {
          ...applied,
          assignments: action === "grant-confirmation" ? 0 : 1,
          confirmationGrants: action === "grant-confirmation" ? 1 : 0,
        };
      },
    );
    const result = await dispatchManualPreview(
      client,
      value,
      expected,
      reviewerEmail,
      { assertCurrent, record },
    );
    expect(result).toEqual({
      status: "applied",
      discovered: 3,
      attempted: 3,
      applied: 3,
      unchanged: 0,
      admissions: 1,
      screenings: 1,
      confirmations: 1,
    });
    const commands = vi
      .mocked(runPrivateWorkflowOperation)
      .mock.calls.map((call) => call[3]);
    expect(commands).toEqual([
      {
        apply: true,
        reviewerEmail,
        newOnly: true,
        action: "assign-admission",
        admissionId: targets[0].id,
      },
      {
        apply: true,
        reviewerEmail,
        newOnly: true,
        action: "assign-screening",
        tutorId: targets[1].id,
        validUntil: value.screening.validUntil,
      },
      {
        apply: true,
        reviewerEmail,
        newOnly: true,
        action: "grant-confirmation",
        bookingId: targets[2].id,
        validUntil: value.screening.validUntil,
      },
    ]);
    expect(receipts[0]).toMatchObject({
      status: "planned",
      targets: targets.map(({ kind, id }) => ({ kind, id, status: "pending" })),
    });
    expect(receipts.at(-1)).toMatchObject({ status: "applied" });
    for (const privateValue of [
      reviewerEmail,
      targets[0].id,
      value.admission.policyId,
    ])
      expect(JSON.stringify(result)).not.toContain(privateValue);
    expect(
      client.query.mock.calls.filter(([sql]) =>
        sql.includes("SELECT kind,id,blocked"),
      ),
    ).toHaveLength(1);
  });

  it.each([
    { targets: [] },
    { targets: [{ kind: "admission", id: randomUUID(), blocked: false }] },
  ])(
    "safely skips empty/already-correct work without renewing it",
    async ({ targets }) => {
      vi.mocked(runPrivateWorkflowOperation).mockResolvedValue({
        ...applied,
        assignments: 0,
      });
      const result = await dispatchManualPreview(
        connection(targets),
        packet(),
        expected,
        reviewerEmail,
        { assertCurrent: vi.fn(), record: vi.fn() },
      );
      expect(result).toMatchObject({
        status: "applied",
        applied: 0,
        unchanged: targets.length,
      });
      expect(runPrivateWorkflowOperation).toHaveBeenCalledTimes(targets.length);
    },
  );

  it.each(["overflow", "conflicting", "duplicate", "invalid"])(
    "refuses a %s snapshot before any assignment",
    async (mode) => {
      const target = { kind: "admission", id: randomUUID(), blocked: false };
      const rows =
        mode === "overflow"
          ? Array.from({ length: 21 }, () => ({ ...target, id: randomUUID() }))
          : mode === "conflicting"
            ? [{ ...target, blocked: true }]
            : mode === "duplicate"
              ? [target, target]
              : [{ ...target, id: "private-sensitive-id" }];
      const client = connection(rows);
      expect(
        await dispatchManualPreview(client, packet(), expected, reviewerEmail, {
          assertCurrent: vi.fn(),
          record: vi.fn(),
        }),
      ).toMatchObject({ status: "refused", applied: 0 });
      expect(runPrivateWorkflowOperation).not.toHaveBeenCalled();
      expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    },
  );

  it("stops on the first locked refusal and retains committed counts and private per-record status", async () => {
    const targets = Array.from({ length: 3 }, () => ({
      kind: "admission",
      id: randomUUID(),
      blocked: false,
    }));
    vi.mocked(runPrivateWorkflowOperation)
      .mockResolvedValueOnce(applied)
      .mockRejectedValueOnce(new Error("private-sensitive-driver-detail"));
    const receipts: unknown[] = [];
    const result = await dispatchManualPreview(
      connection(targets),
      packet(),
      expected,
      reviewerEmail,
      {
        assertCurrent: vi.fn(),
        record: (receipt) => receipts.push(structuredClone(receipt)),
      },
    );
    expect(result).toMatchObject({
      status: "partial",
      discovered: 3,
      attempted: 2,
      applied: 1,
    });
    expect(runPrivateWorkflowOperation).toHaveBeenCalledTimes(2);
    expect(receipts.at(-1)).toMatchObject({
      status: "partial",
      targets: [
        { status: "applied" },
        { status: "refused" },
        { status: "pending" },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("private-sensitive");
  });

  it("refuses an unavailable private receipt before mutation and a replaced packet between operations", async () => {
    const targets = Array.from({ length: 2 }, () => ({
      kind: "admission",
      id: randomUUID(),
      blocked: false,
    }));
    await dispatchManualPreview(
      connection(targets),
      packet(),
      expected,
      reviewerEmail,
      {
        assertCurrent: vi.fn(),
        record: () => {
          throw new Error();
        },
      },
    );
    expect(runPrivateWorkflowOperation).not.toHaveBeenCalled();
    let replaced = false;
    const result = await dispatchManualPreview(
      connection(targets),
      packet(),
      expected,
      reviewerEmail,
      {
        assertCurrent() {
          if (replaced) throw new Error();
        },
        record(receipt) {
          if (receipt.targets.some((target) => target.status === "applied"))
            replaced = true;
        },
      },
    );
    expect(result).toMatchObject({
      status: "partial",
      attempted: 1,
      applied: 1,
    });
    expect(runPrivateWorkflowOperation).toHaveBeenCalledTimes(1);
  });
});

describe("owned local command admission and private receipts", () => {
  it.each(
    [
      [],
      ["--test"],
      ["--apply"],
      ["--test", "--apply", "--hosted"],
      [
        "--test",
        "--apply",
        "--config",
        ".local/missing.json",
        "--reviewer",
        reviewerEmail,
        "positional",
      ],
    ].map((argv) => ({ argv })),
  )(
    "requires explicit complete arguments %j before any connection",
    async ({ argv }) => {
      expect((await manualPreviewDispatchMain(argv)).status).toBe("refused");
      expect(createDatabase).not.toHaveBeenCalled();
    },
  );

  it.each([
    "production",
    "hosted",
    "foreign-port",
    "foreign-runtime",
    "unsafe-file",
    "symlink",
    "marker",
  ])("refuses %s without connecting", async (mode) => {
    const { root, file } = local();
    if (mode === "production") vi.stubEnv("APP_ENV", "production");
    if (mode === "hosted") vi.stubEnv("AUTH_MODE", "hosted-synthetic");
    if (mode === "foreign-port")
      vi.stubEnv(
        "DATABASE_URL_DIRECT",
        "postgresql://learli_owner:fictional-owner@127.0.0.1:55434/learli_test",
      );
    if (mode === "foreign-runtime")
      vi.stubEnv(
        "DATABASE_URL",
        "postgresql://learli_owner:fictional-owner@127.0.0.1:55433/learli_test",
      );
    if (mode === "unsafe-file") chmodSync(file, 0o644);
    if (mode === "symlink") {
      renameSync(file, `${file}.saved`);
      symlinkSync(`${file}.saved`, file);
    }
    if (mode === "marker")
      writeFileSync(
        path.join(root, ".local/postgres/learli-owned"),
        "foreign-marker",
      );
    expect(
      (
        await manualPreviewDispatchMain(
          ["--test", "--apply", "--config", file, "--reviewer", reviewerEmail],
          root,
        )
      ).status,
    ).toBe("refused");
    expect(createDatabase).not.toHaveBeenCalled();
  });

  it("detects deletion or replacement of an admitted packet even when replacement content matches", () => {
    const { root, file } = local();
    const localTarget = loadOwnedPrivateWorkflow(root, file);
    localTarget.assertCurrent();
    const content = readFileSync(file, "utf8");
    renameSync(file, `${file}.saved`);
    writeFileSync(file, content, { mode: 0o600 });
    expect(() => localTarget.assertCurrent()).toThrow();
    rmSync(file);
    expect(() => localTarget.assertCurrent()).toThrow();
  });

  it("refuses an out-of-packet reviewer before connecting", async () => {
    const { root, file } = local();
    expect(
      (
        await manualPreviewDispatchMain(
          [
            "--test",
            "--apply",
            "--config",
            file,
            "--reviewer",
            "unlisted@learli.test",
          ],
          root,
        )
      ).status,
    ).toBe("refused");
    expect(createDatabase).not.toHaveBeenCalled();
  });

  it("writes a fresh 0600 private receipt on repeat invocation without exposing paths or identities", async () => {
    const { root, file } = local();
    const client = { ...connection(), release: vi.fn() };
    const end = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createDatabase).mockReturnValue({
      pool: { connect: vi.fn().mockResolvedValue(client), end },
    } as unknown as ReturnType<typeof createDatabase>);
    const argv = [
      "--test",
      "--apply",
      "--config",
      file,
      "--reviewer",
      reviewerEmail,
    ];
    for (let run = 0; run < 2; run++)
      expect(await manualPreviewDispatchMain(argv, root)).toMatchObject({
        status: "applied",
        discovered: 0,
      });
    const directory = path.join(root, ".local/manual-preview-dispatch");
    expect(lstatSync(directory).mode & 0o777).toBe(0o700);
    const receipts = readdirSync(directory);
    expect(receipts).toHaveLength(2);
    for (const receipt of receipts) {
      const receiptPath = path.join(directory, receipt);
      expect(lstatSync(receiptPath).mode & 0o777).toBe(0o600);
      expect(JSON.parse(readFileSync(receiptPath, "utf8"))).toMatchObject({
        status: "applied",
        targets: [],
      });
    }
    expect(client.release).toHaveBeenCalledTimes(2);
    expect(end).toHaveBeenCalledTimes(2);
  });
});
