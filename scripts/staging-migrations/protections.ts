import type { PoolClient } from "pg";
import { type Candidate, MigrationFault } from "./journal";

const compact = (text: string) =>
  text.replace(/::text/g, "").replace(/[\s()"]+/g, "");
const bookingDefinitions: Record<string, string> = {
  bookings_local_source: "CHECK ((source = 'local_simulation'::text))",
  bookings_demo_state:
    "CHECK ((state = ANY (ARRAY['demo_reserved'::text, 'demo_expired'::text])))",
  bookings_interval_valid:
    "CHECK ((isfinite(start_at_utc) AND isfinite(end_at_utc) AND (end_at_utc > start_at_utc)))",
  bookings_expiry_valid:
    "CHECK ((isfinite(created_at) AND isfinite(expires_at) AND (expires_at > created_at)))",
  bookings_tutor_no_overlap:
    "EXCLUDE USING gist (tutor_id WITH =, tstzrange(start_at_utc, end_at_utc, '[)'::text) WITH &&) WHERE ((state = 'demo_reserved'::text))",
};
const lifecycleBookingDefinitions: Record<string, string> = {
  ...bookingDefinitions,
  bookings_demo_state:
    "CHECK ((state = ANY (ARRAY['demo_reserved'::text, 'demo_expired'::text, 'demo_cancelled'::text, 'demo_replaced'::text, 'demo_confirmed'::text, 'demo_completed'::text])))",
  bookings_tutor_no_overlap:
    "EXCLUDE USING gist (tutor_id WITH =, tstzrange(start_at_utc, end_at_utc, '[)'::text) WITH &&) WHERE ((state = ANY (ARRAY['demo_reserved'::text, 'demo_confirmed'::text])))",
  bookings_logical_fk:
    "FOREIGN KEY (logical_booking_id) REFERENCES bookings(id) ON DELETE RESTRICT",
  bookings_replaces_fk:
    "FOREIGN KEY (replaces_booking_id) REFERENCES bookings(id) ON DELETE RESTRICT",
  bookings_replaces_unique: "UNIQUE (replaces_booking_id)",
  bookings_revision_valid:
    "CHECK (((revision >= 0) AND (((revision = 0) AND (replaces_booking_id IS NULL) AND (logical_booking_id = id)) OR ((revision > 0) AND (replaces_booking_id IS NOT NULL) AND (logical_booking_id <> id)))))",
};
const workflowBookingDefinitions: Record<string, string> = {
  ...lifecycleBookingDefinitions,
  bookings_demo_state:
    "CHECK ((((source = 'local_simulation'::text) AND (state = ANY (ARRAY['demo_reserved'::text, 'demo_expired'::text, 'demo_cancelled'::text, 'demo_replaced'::text, 'demo_confirmed'::text, 'demo_completed'::text])) AND (workflow_policy_id IS NULL) AND (admission_policy_id IS NULL) AND (workflow_revision = 0)) OR ((source = 'synthetic_readiness'::text) AND (state = ANY (ARRAY['provisional'::text, 'confirmed'::text, 'completed'::text, 'no_show'::text, 'expired'::text, 'cancelled'::text, 'replaced'::text])) AND (workflow_policy_id IS NOT NULL) AND (admission_policy_id IS NOT NULL) AND (workflow_revision >= 0))))",
  bookings_local_source:
    "CHECK ((source = ANY (ARRAY['local_simulation'::text, 'synthetic_readiness'::text])))",
  bookings_tutor_no_overlap:
    "EXCLUDE USING gist (tutor_id WITH =, tstzrange(start_at_utc, end_at_utc, '[)'::text) WITH &&) WHERE ((state = ANY (ARRAY['demo_reserved'::text, 'demo_confirmed'::text, 'provisional'::text, 'confirmed'::text])))",
};
const localOperationBookingDefinitions: Record<string, string> = {
  ...workflowBookingDefinitions,
  bookings_demo_state: workflowBookingDefinitions.bookings_demo_state.replace(
    "(source = 'synthetic_readiness'::text)",
    "(source = ANY (ARRAY['synthetic_readiness'::text, 'local_operation'::text]))",
  ),
  bookings_local_source:
    "CHECK ((source = ANY (ARRAY['local_simulation'::text, 'synthetic_readiness'::text, 'local_operation'::text])))",
};
// Keep grouping for mixed AND/OR expressions; removing parentheses could hide
// a weakened revision predicate with a different logical precedence.
const grouped = (text: string) => text.replace(/[\s"]+/g, "");
type ExpectedFunction = {
  name: string;
  body: string;
  language: string;
  returns: string;
  definer: boolean;
  searchPath: string | undefined;
};
type ExpectedTrigger = {
  name: string;
  table: string;
  function: string;
  type: number;
  constraint: boolean;
  deferrable: boolean;
  deferred: boolean;
};

/** Interpret only the protection DDL forms used by reviewed migrations, in
 * order. Replacements must supersede the earlier body; a dropped/recreated
 * trigger must have one final definition. This is not a general SQL parser. */
export function expectedProtections(statements: readonly string[]) {
  const functions = new Map<string, ExpectedFunction>();
  const triggers = new Map<string, ExpectedTrigger>();
  for (const original of statements) {
    const statement = original.replace(/^(?:\s|--[^\n]*(?:\n|$))*/, "");
    if (/^CREATE (?:OR REPLACE )?FUNCTION\b/.test(statement)) {
      const name = statement.match(
        /^CREATE (?:OR REPLACE )?FUNCTION (?:public\.)?"?([a-z_]+)"?\s*\(/,
      )?.[1];
      const body = statement.match(/AS\s+\$\$([\s\S]*?)\$\$/)?.[1].trim();
      const language = statement.match(/LANGUAGE\s+(\w+)/)?.[1].toLowerCase();
      const returns = statement.match(/RETURNS\s+([\s\S]+?)\s+LANGUAGE/)?.[1];
      const searchPath = statement
        .match(/SET search_path\s*=\s*([^\n]+?)\s+AS/)?.[1]
        .trim();
      if (
        !name ||
        !body ||
        !language ||
        !returns ||
        (functions.has(name) && !/^CREATE OR REPLACE FUNCTION/.test(statement))
      )
        throw new MigrationFault("candidate_invalid");
      functions.set(name, {
        name,
        body,
        language,
        returns,
        definer: /SECURITY DEFINER/.test(statement),
        searchPath,
      });
    } else if (/^DROP TRIGGER\b/.test(statement)) {
      const match = statement.match(
        /^DROP TRIGGER (\w+) ON (?:public\.)?(\w+)\s*;\s*$/,
      );
      if (!match || !triggers.delete(`${match[2]}.${match[1]}`))
        throw new MigrationFault("candidate_invalid");
    } else if (/^CREATE (?:CONSTRAINT )?TRIGGER\b/.test(statement)) {
      const match = statement.match(
        /^CREATE (CONSTRAINT )?TRIGGER (\w+) (BEFORE|AFTER) ((?:INSERT|UPDATE|DELETE)(?: OR (?:INSERT|UPDATE|DELETE))*)\s+ON (?:public\.)?(\w+)\s+(?:(DEFERRABLE INITIALLY (DEFERRED|IMMEDIATE))\s+)?FOR EACH ROW EXECUTE FUNCTION (?:public\.)?(\w+)\(\)\s*;\s*$/,
      );
      if (!match || (match[6] && !match[1]))
        throw new MigrationFault("candidate_invalid");
      const key = `${match[5]}.${match[2]}`;
      if (triggers.has(key)) throw new MigrationFault("candidate_invalid");
      triggers.set(key, {
        name: match[2],
        table: match[5],
        function: match[8],
        type:
          1 +
          (match[3] === "BEFORE" ? 2 : 0) +
          (/INSERT/.test(match[4]) ? 4 : 0) +
          (/DELETE/.test(match[4]) ? 8 : 0) +
          (/UPDATE/.test(match[4]) ? 16 : 0),
        constraint: Boolean(match[1]),
        deferrable: Boolean(match[6]),
        deferred: match[7] === "DEFERRED",
      });
    } else if (/^(?:DROP|ALTER) FUNCTION\b|^ALTER TRIGGER\b/.test(statement)) {
      throw new MigrationFault("candidate_invalid");
    }
  }
  return {
    functions: [...functions.values()],
    triggers: [...triggers.values()],
  };
}
/** Compare stored custom functions/triggers to their exact reviewed SQL bodies.
 * Journal truth alone cannot prove protections still exist or remain enabled. */
export async function verifyProtections(
  client: PoolClient,
  candidate: Candidate,
  applied: number,
) {
  const statements = candidate.entries
    .slice(0, applied)
    .flatMap((entry) => entry.statements);
  const { functions: expectedFunctions, triggers } =
    expectedProtections(statements);
  const hasLifecycle = candidate.entries
    .slice(0, applied)
    .some((entry) => entry.tag === "0017_local_booking_lifecycle");
  const hasWorkflow = candidate.entries
    .slice(0, applied)
    .some((e) => e.tag === "0025_booking_workflows");
  const hasLocalOperation = candidate.entries
    .slice(0, applied)
    .some((entry) => entry.tag === "0035_local_operational_workflow");
  const expectedBookingDefinitions = hasLocalOperation
    ? localOperationBookingDefinitions
    : hasWorkflow
      ? workflowBookingDefinitions
      : hasLifecycle
        ? lifecycleBookingDefinitions
        : bookingDefinitions;
  const actual = await client.query<{
    name: string;
    body: string;
    language: string;
    returns: string;
    definer: boolean;
    config: string[] | null;
  }>(`
    SELECT p.proname AS name,p.prosrc AS body,l.lanname AS language,
      pg_get_function_result(p.oid) AS returns,p.prosecdef AS definer,p.proconfig AS config
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_depend d
      WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')`);
  if (
    actual.rows.length !== expectedFunctions.length ||
    expectedFunctions.some((expected) => {
      const matches = actual.rows.filter((row) => row.name === expected.name),
        row = matches[0];
      return (
        matches.length !== 1 ||
        row.body.trim() !== expected.body ||
        row.language !== expected.language ||
        compact(row.returns) !== compact(expected.returns) ||
        row.definer !== expected.definer ||
        JSON.stringify(row.config ?? []) !==
          JSON.stringify(
            expected.searchPath ? [`search_path=${expected.searchPath}`] : [],
          )
      );
    })
  )
    throw new MigrationFault("protection_mismatch");
  const stored = await client.query<{
    name: string;
    table: string;
    function: string;
    type: number;
    enabled: string;
    plain: boolean;
    constraint: boolean;
    deferrable: boolean;
    deferred: boolean;
  }>(`
    SELECT t.tgname AS name,c.relname AS "table",p.proname AS function,t.tgtype AS type,t.tgenabled AS enabled,
      (t.tgqual IS NULL AND t.tgattr::text='' AND t.tgnargs=0
        AND p.pronamespace='public'::regnamespace AND p.pronargs=0) AS plain,
      (t.tgconstraint<>0) AS "constraint",t.tgdeferrable AS deferrable,t.tginitdeferred AS deferred
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_proc p ON p.oid=t.tgfoid WHERE n.nspname='public' AND NOT t.tgisinternal`);
  if (
    stored.rows.length !== triggers.length ||
    triggers.some(
      (expected) =>
        !stored.rows.some(
          (row) =>
            row.enabled === "O" &&
            row.plain &&
            row.name === expected.name &&
            row.table === expected.table &&
            row.function === expected.function &&
            row.type === expected.type &&
            row.constraint === expected.constraint &&
            row.deferrable === expected.deferrable &&
            row.deferred === expected.deferred,
        ),
    )
  )
    throw new MigrationFault("protection_mismatch");
  if (applied >= 9) {
    const constraints = await client.query<{
      name: string;
      definition: string;
      valid: boolean;
    }>(
      `
      SELECT conname AS name,pg_get_constraintdef(oid) AS definition,convalidated AS valid
      FROM pg_constraint WHERE conrelid='public.bookings'::regclass AND conname=ANY($1::text[])`,
      [Object.keys(expectedBookingDefinitions)],
    );
    if (
      constraints.rows.length !==
        Object.keys(expectedBookingDefinitions).length ||
      constraints.rows.some(
        (row) =>
          !row.valid ||
          (row.name === "bookings_revision_valid" ||
          (hasWorkflow && row.name === "bookings_demo_state")
            ? grouped(row.definition) !==
              grouped(expectedBookingDefinitions[row.name])
            : compact(row.definition) !==
              compact(expectedBookingDefinitions[row.name])),
      )
    )
      throw new MigrationFault("protection_mismatch");
  }
  if (hasLifecycle) {
    const index = await client.query<{ safe: boolean; predicate: string }>(`
      SELECT (i.indisunique AND i.indisvalid AND i.indisready AND i.indnatts=1
        AND i.indnkeyatts=1 AND i.indexprs IS NULL AND am.amname='btree'
        AND a.attname='logical_booking_id') AS safe,
        pg_get_expr(i.indpred,i.indrelid) AS predicate
      FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid
      JOIN pg_am am ON am.oid=idx.relam
      JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
      WHERE i.indrelid='public.bookings'::regclass AND idx.relname='bookings_logical_live_unique'`);
    if (
      index.rows.length !== 1 ||
      !index.rows[0].safe ||
      typeof index.rows[0].predicate !== "string" ||
      compact(index.rows[0].predicate) !==
        compact(
          hasWorkflow
            ? "state = ANY (ARRAY['demo_reserved'::text, 'demo_confirmed'::text, 'provisional'::text, 'confirmed'::text])"
            : "state = ANY (ARRAY['demo_reserved'::text, 'demo_confirmed'::text])",
        )
    )
      throw new MigrationFault("protection_mismatch");
  }
  return {
    functions: expectedFunctions.length,
    triggers: triggers.length,
    bookingConstraints:
      applied >= 9 ? Object.keys(expectedBookingDefinitions).length : 0,
    bookingIndexes: hasLifecycle ? 1 : 0,
  };
}
