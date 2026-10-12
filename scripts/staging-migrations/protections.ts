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
  const expectedFunctions = statements
    .filter((statement) => /CREATE FUNCTION /.test(statement))
    .map((statement) => {
      const name = statement.match(
        /CREATE FUNCTION (?:public\.)?"?([a-z_]+)"?\s*\(/,
      )?.[1];
      const body = statement.match(/AS\s+\$\$([\s\S]*?)\$\$/)?.[1].trim();
      const language = statement.match(/LANGUAGE\s+(\w+)/)?.[1].toLowerCase();
      const returns = statement.match(/RETURNS\s+([\s\S]+?)\s+LANGUAGE/)?.[1];
      const searchPath = statement
        .match(/SET search_path\s*=\s*([^\n]+?)\s+AS/)?.[1]
        .trim();
      if (!name || !body || !language || !returns)
        throw new MigrationFault("candidate_invalid");
      return {
        name,
        body,
        language,
        returns,
        definer: /SECURITY DEFINER/.test(statement),
        searchPath,
      };
    });
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
  const triggers = statements
    .filter((statement) => /CREATE TRIGGER /.test(statement))
    .map((statement) => {
      const match = statement.match(
        /CREATE TRIGGER (\w+) (BEFORE|AFTER) ([\s\S]+?)\s+ON (?:public\.)?(\w+)\s+FOR EACH ROW EXECUTE FUNCTION (?:public\.)?(\w+)\(\)/,
      );
      if (!match) throw new MigrationFault("candidate_invalid");
      const events = match[3];
      return {
        name: match[1],
        table: match[4],
        function: match[5],
        type:
          1 +
          (match[2] === "BEFORE" ? 2 : 0) +
          (/INSERT/.test(events) ? 4 : 0) +
          (/DELETE/.test(events) ? 8 : 0) +
          (/UPDATE/.test(events) ? 16 : 0),
      };
    });
  const stored = await client.query<{
    name: string;
    table: string;
    function: string;
    type: number;
    enabled: string;
    plain: boolean;
  }>(`
    SELECT t.tgname AS name,c.relname AS "table",p.proname AS function,t.tgtype AS type,t.tgenabled AS enabled,
      (t.tgqual IS NULL AND t.tgattr::text='' AND t.tgnargs=0 AND NOT t.tgdeferrable
        AND t.tgconstraint=0 AND p.pronamespace='public'::regnamespace AND p.pronargs=0) AS plain
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
            row.type === expected.type,
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
      [Object.keys(bookingDefinitions)],
    );
    if (
      constraints.rows.length !== Object.keys(bookingDefinitions).length ||
      constraints.rows.some(
        (row) =>
          !row.valid ||
          compact(row.definition) !== compact(bookingDefinitions[row.name]),
      )
    )
      throw new MigrationFault("protection_mismatch");
  }
  return {
    functions: expectedFunctions.length,
    triggers: triggers.length,
    bookingConstraints: applied >= 9 ? 5 : 0,
  };
}
