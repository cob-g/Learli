import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { runtimeGrantsSql } from "../runtime-grants";

export const digest = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export class MigrationFault extends Error {
  constructor(public readonly category: string) {
    super(category);
  }
}
const entrySchema = z
  .object({
    idx: z.number().int().nonnegative(),
    version: z.literal("7"),
    when: z.number().int().positive().safe(),
    tag: z.string().regex(/^\d{4}_[a-z0-9_]+$/),
    breakpoints: z.literal(true),
  })
  .strict();
const journalSchema = z
  .object({
    version: z.literal("7"),
    dialect: z.literal("postgresql"),
    entries: z.array(entrySchema).min(17).max(100),
  })
  .strict();
export type MigrationEntry = Readonly<{
  idx: number;
  tag: string;
  when: number;
  hash: string;
  statements: readonly string[];
}>;
export type Candidate = Readonly<{
  hash: string;
  journalHash: string;
  policyHash: string;
  sourceHash: string;
  entries: readonly MigrationEntry[];
}>;
// The runner, CLI, grant verification and upstream connection bytes are part of
// approval identity; changes require a new plan even when SQL stays unchanged.
export const candidateSources = [
  "scripts/staging-database.ts",
  "scripts/neon-database.ts",
  "scripts/neon-bootstrap.ts",
  "scripts/neon-recovery.ts",
  "src/lib/db/neon-operation-config.ts",
  "src/lib/db/verified-config.ts",
  "src/lib/db/native-tls.ts",
  "src/lib/db/hosted-runtime.ts",
  "src/lib/db/hosted-runtime-validation.ts",
  "src/lib/db/neon-development.ts",
  "src/lib/env/schema.ts",
  "src/lib/auth.ts",
  "src/lib/auth-factory.ts",
  "src/features/hosted-auth/composition.ts",
  "src/features/hosted-auth/config-file.ts",
  "src/lib/email/local-mail.ts",
  "scripts/runtime-grants.ts",
  "scripts/staging-migrations/journal.ts",
  "scripts/staging-migrations/runner.ts",
  "scripts/staging-migrations/privileges.ts",
  "scripts/staging-migrations/protections.ts",
  "src/lib/db/staging-config.ts",
  "src/lib/db/staging-connection.ts",
  "src/lib/db/staging-runtime-guard.ts",
  "package.json",
  "package-lock.json",
] as const;

export function parseJournal(
  journalText: string,
  sqlFiles: Readonly<Record<string, string>>,
  sourceHash: string,
): Candidate {
  try {
    const journal = journalSchema.parse(JSON.parse(journalText));
    const entries = journal.entries.map((entry, index) => {
      if (
        entry.idx !== index ||
        !entry.tag.startsWith(`${String(index).padStart(4, "0")}_`) ||
        (index > 0 && entry.when <= journal.entries[index - 1].when)
      )
        throw new Error();
      const sql = sqlFiles[`${entry.tag}.sql`];
      if (typeof sql !== "string" || sql.length === 0 || sql.length > 1_000_000)
        throw new Error();
      return Object.freeze({
        idx: index,
        tag: entry.tag,
        when: entry.when,
        hash: digest(sql),
        statements: Object.freeze(sql.split("--> statement-breakpoint")),
      });
    });
    if (Object.keys(sqlFiles).length !== entries.length) throw new Error();
    const journalHash = digest(journalText),
      policyHash = digest(runtimeGrantsSql);
    const hash = digest(
      JSON.stringify({
        journalHash,
        policyHash,
        sourceHash,
        entries: entries.map(({ idx, tag, when, hash }) => ({
          idx,
          tag,
          when,
          hash,
        })),
      }),
    );
    return Object.freeze({
      hash,
      journalHash,
      policyHash,
      sourceHash,
      entries: Object.freeze(entries),
    });
  } catch {
    throw new MigrationFault("candidate_invalid");
  }
}
export function loadCandidate(root: string): Candidate {
  try {
    const directory = path.join(root, "drizzle");
    const files = readdirSync(directory).filter((file) =>
      file.endsWith(".sql"),
    );
    const sql = Object.fromEntries(
      files.map((file) => [
        file,
        readFileSync(path.join(directory, file), "utf8"),
      ]),
    );
    const sourceHash = digest(
      JSON.stringify(
        candidateSources.map((file) => [
          file,
          digest(readFileSync(path.join(root, file))),
        ]),
      ),
    );
    return parseJournal(
      readFileSync(path.join(directory, "meta/_journal.json"), "utf8"),
      sql,
      sourceHash,
    );
  } catch {
    throw new MigrationFault("candidate_invalid");
  }
}
export const historySchema = z
  .array(
    z
      .object({
        hash: z.string().regex(/^[a-f0-9]{64}$/),
        when: z.number().int().positive().safe(),
      })
      .strict(),
  )
  .max(100);
export type History = z.infer<typeof historySchema>;
export function validateHistory(candidate: Candidate, value: unknown): History {
  const result = historySchema.safeParse(value);
  if (!result.success || result.data.length > candidate.entries.length)
    throw new MigrationFault("history_divergent");
  for (const [index, row] of result.data.entries()) {
    const expected = candidate.entries[index];
    if (row.hash !== expected.hash || row.when !== expected.when)
      throw new MigrationFault("history_divergent");
  }
  return result.data;
}
