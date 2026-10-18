// Explicit one-shot owner metadata preparation. No dotenv, polling or approvals.
import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fsyncSync,
  ftruncateSync,
  mkdirSync,
  openSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { z } from "zod";
import { createDatabase } from "../src/lib/db/connection";
import type {
  PrivateWorkflowBinding,
  PrivateWorkflowPacket,
} from "../src/features/private-workflow/config";
import {
  readPrivateWorkflowOperatorScope,
  runPrivateWorkflowOperation,
  type PrivateWorkflowOperatorConnection,
} from "../src/features/private-workflow/operator";
import {
  assertPrivateDirectory,
  loadOwnedPrivateWorkflow,
} from "./private-workflow-local";

export const manualPreviewDispatchLimit = 20;
const targetInput = z.strictObject({
  kind: z.enum(["admission", "screening", "confirmation"]),
  id: z.uuid(),
  blocked: z.boolean(),
});
type Target = Omit<z.infer<typeof targetInput>, "blocked">;
type Receipt = {
  version: 1;
  purpose: "manual_preview_dispatch";
  startedAt: string;
  reviewerEmail: string;
  status: "planned" | "applied" | "partial" | "refused";
  targets: (Target & {
    status: "pending" | "applied" | "unchanged" | "refused";
  })[];
};

/** A single SQL snapshot. Current exact assignments are skipped; conflicting,
 * revoked or expired metadata makes the entire proposed batch refuse. */
export async function discoverManualPreviewWork(
  connection: PrivateWorkflowOperatorConnection,
  packet: PrivateWorkflowPacket,
  expected: PrivateWorkflowBinding,
  reviewerEmail: string,
) {
  let transaction = false;
  try {
    await connection.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    transaction = true;
    await connection.query("SET LOCAL lock_timeout='5s'");
    const reviewer = await readPrivateWorkflowOperatorScope(
      connection,
      packet,
      expected,
      reviewerEmail,
    );
    const result = await connection.query(
      `SELECT kind,id,blocked FROM (
        SELECT 'admission'::text AS kind,a.id,
          x.admission_id IS NOT NULL OR NOT coalesce(r.active,false) AS blocked
        FROM public.learner_admissions a
        JOIN public."user" u ON u.id=a.requester_user_id
        JOIN public.user_access ua ON ua.user_id=u.id AND ua.status='active'
        JOIN public.learner_profiles l ON l.id=a.learner_id AND l.source=a.source
        LEFT JOIN public.learner_admission_assignments x ON x.admission_id=a.id
        LEFT JOIN public.learner_admission_reviewers r ON r.user_id=$5
          AND r.source=a.source AND r.capability_code='learner_admission_review'
        WHERE a.source='synthetic_readiness' AND a.state='pending'
          AND a.policy_id=$2::uuid AND u.email_verified
          AND u.email=ANY($1::text[]) AND u.id<>$5
          AND (x.admission_id IS NULL OR x.reviewer_user_id<>$5 OR NOT coalesce(r.active,false))
        UNION ALL
        SELECT 'screening',c.tutor_id,
          x.tutor_id IS NOT NULL OR NOT EXISTS(
            SELECT 1 FROM public.tutor_screening_staff st WHERE st.user_id=$5
              AND st.provenance='synthetic_readiness' AND st.status='authorized'
              AND st.valid_until>clock_timestamp()) AS blocked
        FROM public.tutor_screening_cases c
        JOIN public.tutor_profiles t ON t.id=c.tutor_id
        JOIN public."user" u ON u.id=t.user_id
        JOIN public.user_access ua ON ua.user_id=u.id AND ua.status='active'
        LEFT JOIN public.tutor_screening_assignments x ON x.tutor_id=t.id
        WHERE c.provenance='synthetic_readiness' AND c.policy_version=$3
          AND c.state='pending' AND t.review_status='pending' AND u.email_verified
          AND u.email=ANY($1::text[]) AND u.id<>$5
          AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='tutor')
          AND (x.tutor_id IS NULL OR x.reviewer_user_id<>$5 OR x.status<>'authorized'
            OR x.provenance<>'synthetic_readiness' OR NOT EXISTS(
              SELECT 1 FROM public.tutor_screening_staff st WHERE st.user_id=$5
                AND st.provenance='synthetic_readiness' AND st.status='authorized'
                AND st.valid_until>clock_timestamp()))
        UNION ALL
        SELECT 'confirmation',b.id,
          EXISTS(SELECT 1 FROM public.booking_workflow_grants g
            WHERE g.logical_booking_id=b.logical_booking_id AND g.action='confirm') AS blocked
        FROM public.bookings b
        JOIN public."user" u ON u.id=b.booked_by_user_id
        JOIN public.user_access ua ON ua.user_id=u.id AND ua.status='active'
        JOIN public.tutor_profiles t ON t.id=b.tutor_id
        JOIN public."user" tu ON tu.id=t.user_id
        JOIN public.tutor_screening_cases c ON c.tutor_id=t.id
          AND c.provenance='synthetic_readiness' AND c.policy_version=$3
        WHERE b.source='synthetic_readiness' AND b.workflow_policy_id=$4::uuid
          AND b.admission_policy_id=$2::uuid AND b.state='provisional'
          AND b.expires_at>clock_timestamp() AND u.email_verified AND tu.email_verified
          AND u.email=ANY($1::text[]) AND tu.email=ANY($1::text[])
          AND u.id<>$5 AND tu.id<>$5
          AND NOT EXISTS(SELECT 1 FROM public.bookings newer
            WHERE newer.logical_booking_id=b.logical_booking_id AND newer.revision>b.revision)
          AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id)
          AND public.has_current_tutor_screening(b.tutor_id,'synthetic_readiness')
          AND (NOT EXISTS(SELECT 1 FROM public.booking_workflow_grants g
                WHERE g.logical_booking_id=b.logical_booking_id AND g.action='confirm')
            OR EXISTS(SELECT 1 FROM public.booking_workflow_grants g
                WHERE g.logical_booking_id=b.logical_booking_id AND g.action='confirm'
                  AND (g.actor_user_id<>$5 OR NOT g.active OR g.valid_until<=clock_timestamp())))
      ) work ORDER BY kind,id LIMIT 21`,
      [
        packet.accountEmails,
        packet.admission.policyId,
        packet.screening.version,
        packet.booking.policyId,
        reviewer,
      ],
    );
    const targets = z
      .array(targetInput)
      .max(manualPreviewDispatchLimit)
      .parse(result.rows);
    if (
      targets.some((target) => target.blocked) ||
      new Set(targets.map((target) => `${target.kind}:${target.id}`)).size !==
        targets.length
    )
      throw new Error();
    await connection.query("COMMIT");
    transaction = false;
    return targets.map(({ kind, id }) => ({ kind, id }));
  } finally {
    if (transaction) await connection.query("ROLLBACK").catch(() => undefined);
  }
}

/** Serial exact operations own independent transactions. A failure stops this
 * finite batch; committed metadata remains available for an explicit safe retry. */
export async function dispatchManualPreview(
  connection: PrivateWorkflowOperatorConnection,
  packet: PrivateWorkflowPacket,
  expected: PrivateWorkflowBinding,
  reviewerEmail: string,
  hooks: { assertCurrent: () => void; record: (receipt: Receipt) => void },
) {
  let receipt: Receipt | undefined;
  const counts = {
    discovered: 0,
    attempted: 0,
    applied: 0,
    unchanged: 0,
    admissions: 0,
    screenings: 0,
    confirmations: 0,
  };
  try {
    hooks.assertCurrent();
    const targets = await discoverManualPreviewWork(
      connection,
      packet,
      expected,
      reviewerEmail,
    );
    counts.discovered = targets.length;
    hooks.assertCurrent();
    receipt = {
      version: 1,
      purpose: "manual_preview_dispatch",
      startedAt: new Date().toISOString(),
      reviewerEmail,
      status: "planned",
      targets: targets.map((target) => ({ ...target, status: "pending" })),
    };
    // Persist the exact proposed scope privately before the first mutation.
    hooks.record(receipt);
    for (const target of receipt.targets) {
      hooks.assertCurrent();
      counts.attempted++;
      const base = { apply: true, reviewerEmail, newOnly: true } as const;
      const command =
        target.kind === "admission"
          ? { ...base, action: "assign-admission", admissionId: target.id }
          : target.kind === "screening"
            ? {
                ...base,
                action: "assign-screening",
                tutorId: target.id,
                validUntil: packet.screening.validUntil,
              }
            : {
                ...base,
                action: "grant-confirmation",
                bookingId: target.id,
                validUntil: packet.screening.validUntil,
              };
      const result = await runPrivateWorkflowOperation(
        connection,
        packet,
        expected,
        command,
        hooks.assertCurrent,
      );
      const changed = result.assignments + result.confirmationGrants > 0;
      target.status = changed ? "applied" : "unchanged";
      if (changed) {
        counts.applied++;
        counts[
          target.kind === "admission"
            ? "admissions"
            : target.kind === "screening"
              ? "screenings"
              : "confirmations"
        ]++;
      } else counts.unchanged++;
      hooks.record(receipt);
    }
    receipt.status = "applied";
    hooks.record(receipt);
    return { status: "applied" as const, ...counts };
  } catch {
    const status = counts.applied ? ("partial" as const) : ("refused" as const);
    if (receipt) {
      receipt.status = status;
      const pending = receipt.targets.find(
        (target) => target.status === "pending",
      );
      if (pending && counts.attempted > counts.applied + counts.unchanged)
        pending.status = "refused";
      try {
        hooks.record(receipt);
      } catch {
        /* No raw filesystem details. */
      }
    }
    return { status, ...counts };
  }
}

export async function manualPreviewDispatchMain(
  argv: string[],
  root = process.cwd(),
) {
  let owner: ReturnType<typeof createDatabase> | undefined;
  let descriptor: number | undefined;
  try {
    const { values } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        test: { type: "boolean" },
        apply: { type: "boolean" },
        config: { type: "string" },
        reviewer: { type: "string" },
      },
    });
    if (!values.test || !values.apply || !values.config || !values.reviewer)
      throw new Error();
    const local = loadOwnedPrivateWorkflow(root, values.config);
    if (!local.packet.accountEmails.includes(values.reviewer))
      throw new Error();
    const directory = path.join(root, ".local/manual-preview-dispatch");
    assertPrivateDirectory(root, path.join(root, ".local"));
    mkdirSync(directory, { mode: 0o700, recursive: true });
    assertPrivateDirectory(root, directory);
    const file = path.join(directory, `${randomUUID()}.json`);
    descriptor = openSync(
      file,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    owner = createDatabase(local.ownerUrl, true);
    const connection = await owner.pool.connect();
    try {
      return await dispatchManualPreview(
        connection,
        local.packet,
        local.expected,
        values.reviewer,
        {
          assertCurrent: local.assertCurrent,
          record(receipt) {
            ftruncateSync(descriptor!, 0);
            writeSync(descriptor!, `${JSON.stringify(receipt)}\n`, 0, "utf8");
            fsyncSync(descriptor!);
          },
        },
      );
    } finally {
      try {
        connection.release();
      } catch {
        /* Preserve committed counts. */
      }
    }
  } catch {
    return {
      status: "refused" as const,
      discovered: 0,
      attempted: 0,
      applied: 0,
      unchanged: 0,
      admissions: 0,
      screenings: 0,
      confirmations: 0,
    };
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        /* No raw cleanup details. */
      }
    }
    await owner?.pool.end().catch(() => undefined);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await manualPreviewDispatchMain(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "applied" ? 0 : 1;
}
