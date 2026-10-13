// Exact current-chain expectations; historical baseline projections stay fixed in each test.
import { readFileSync } from "node:fs";
import { loadCandidate } from "../../scripts/staging-migrations/journal";
import { expectedProtections } from "../../scripts/staging-migrations/protections";
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
