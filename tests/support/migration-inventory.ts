// Exact current-chain expectations; historical baseline projections stay fixed in each test.
import { readFileSync } from "node:fs";
import { loadCandidate } from "../../scripts/staging-migrations/journal";
import { expectedProtections } from "../../scripts/staging-migrations/protections";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";

/** Historical prefix fixtures lack the additive0032 function. Latest-target
 * verification still uses the full canonical policy and exact function set. */
export const runtimeGrantsBeforeParent = runtimeGrantsSql
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
