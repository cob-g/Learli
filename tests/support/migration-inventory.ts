// Exact current-chain expectations; historical baseline projections stay fixed in each test.
import { readFileSync } from "node:fs";
import { expect } from "vitest";
import {
  loadCandidate,
  digest,
} from "../../scripts/staging-migrations/journal";
import { expectedProtections } from "../../scripts/staging-migrations/protections";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";

/** Historical migrations cannot grant objects introduced by ordinary local operation. */
export const runtimeGrantsBeforeOperation = runtimeGrantsSql
  .split("\n")
  .filter(
    (line) =>
      !line.includes("local_workflow_") &&
      !line.includes("public.workflow_identity("),
  )
  .join("\n");

/** Exact inherited policy before nullable school-grade metadata/functions. */
export const runtimeGrantsBeforeGrade = runtimeGrantsBeforeOperation
  .split("\n")
  .filter(
    (line) =>
      !line.includes("_with_grade(") &&
      !line.includes("GRANT UPDATE (grade) ON learner_profiles"),
  )
  .join("\n");

/** Historical prefix fixtures lack the additive0032 function. Latest-target
 * verification still uses the full canonical policy and exact function set. */
export const runtimeGrantsBeforeParent = runtimeGrantsBeforeGrade
  .split("\n")
  .filter((line) => !line.includes("FUNCTION public.enroll_parent_workspace("))
  .join("\n");
export const currentMigrationCandidate = loadCandidate(process.cwd());
export const currentMigrationFunctionCount = expectedProtections(
  currentMigrationCandidate.entries.flatMap((entry) => entry.statements),
).functions.length;
const last = currentMigrationCandidate.entries.at(-1);
if (!last) throw new Error("Reviewed migration inventory is empty.");
const snapshot = JSON.parse(
  readFileSync(
    `drizzle/meta/${String(currentMigrationCandidate.entries.length - 1).padStart(4, "0")}_snapshot.json`,
    "utf8",
  ),
) as { tables: Record<string, unknown> };
export const currentMigrationPublicTableCount = Object.keys(
  snapshot.tables,
).length;

/** Every old table hash remains exact; only the two explicitly added empty
 * local-operation authority tables may appear during this forward upgrade. */
export function expectLocalOperationRowPreservation(
  before: Record<string, string>,
  after: Record<string, string>,
) {
  const added = ["local_workflow_claims", "local_workflow_staff"];
  expect(Object.keys(after).sort()).toEqual(
    [...Object.keys(before), ...added].sort(),
  );
  for (const [name, hash] of Object.entries(before))
    expect(after[name], name).toBe(hash);
  for (const name of added)
    expect(after[name], name).toBe(digest(JSON.stringify([])));
}
