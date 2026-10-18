// Explicit local test operations only. No dotenv, automatic startup or hosted adapter.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createDatabase } from "../src/lib/db/connection";
import {
  privateWorkflowOperatorInput,
  runPrivateWorkflowOperation,
} from "../src/features/private-workflow/operator";
import { loadOwnedPrivateWorkflow } from "./private-workflow-local";

export async function privateWorkflowMain(
  argv: string[],
  root = process.cwd(),
) {
  let owner: ReturnType<typeof createDatabase> | undefined;
  try {
    const { values } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        test: { type: "boolean" },
        apply: { type: "boolean" },
        config: { type: "string" },
        action: { type: "string" },
        reviewer: { type: "string" },
        admission: { type: "string" },
        tutor: { type: "string" },
        booking: { type: "string" },
        account: { type: "string" },
        "valid-until": { type: "string" },
      },
    });
    // Hosted CLI admission remains unsupported, including when --test is omitted.
    if (
      !values.test ||
      !values.apply ||
      !values.config ||
      process.env.APP_ENV !== "test" ||
      process.env.AUTH_MODE !== "local" ||
      (process.env.DATABASE_MODE && process.env.DATABASE_MODE !== "local")
    )
      throw new Error();
    const command = privateWorkflowOperatorInput.parse({
      apply: true,
      action: values.action,
      reviewerEmail: values.reviewer,
      ...(values.admission ? { admissionId: values.admission } : {}),
      ...(values.tutor ? { tutorId: values.tutor } : {}),
      ...(values.booking ? { bookingId: values.booking } : {}),
      ...(values.account ? { targetId: values.account } : {}),
      ...(values["valid-until"] ? { validUntil: values["valid-until"] } : {}),
    });
    const local = loadOwnedPrivateWorkflow(root, values.config);
    owner = createDatabase(local.ownerUrl, true);
    const connection = await owner.pool.connect();
    try {
      return await runPrivateWorkflowOperation(
        connection,
        local.packet,
        local.expected,
        command,
        local.assertCurrent,
      );
    } finally {
      connection.release();
    }
  } catch {
    return {
      status: "refused" as const,
      message:
        "Explicit owned local --test --apply operation required. Hosted CLI is unsupported. Details omitted.",
    };
  } finally {
    // Cleanup cannot expose raw driver details or misreport an already committed apply.
    await owner?.pool.end().catch(() => undefined);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await privateWorkflowMain(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "applied" ? 0 : 1;
}
