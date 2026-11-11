import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { workflowStates } from "@/features/booking-workflows/model";
import { demoStateLabels } from "@/features/bookings/lifecycle-model";
import { transitions, statusLabels } from "@/features/support/input";
import {
  DELIVERY_CLAIM_MS,
  DELIVERY_MAX_ATTEMPTS,
} from "@/features/transactional-delivery/state";
import { deliveryStates } from "@/lib/db/schema/transactional-delivery";
import {
  publicationStates,
  nextPublicationStates,
} from "@/features/review-publication/input";
import {
  states as privateReviewStates,
  nextStates as nextPrivateReviewStates,
} from "@/features/private-reviews/input";

// The database is the authority. These tests read the live, migrated CHECK
// constraints and trigger functions and fail when a hand-copied TypeScript
// state list or transition map stops matching them.

let pool: Pool;
beforeAll(() => {
  if (process.env.APP_ENV !== "test")
    throw new Error("Integration tests require the isolated test environment.");
  pool = new Pool({ connectionString: process.env.DATABASE_URL_DIRECT });
});
afterAll(async () => {
  await pool?.end();
});

async function constraint(name: string) {
  const { rows } = await pool.query<{ def: string }>(
    "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname=$1 AND connamespace='public'::regnamespace",
    [name],
  );
  expect(rows, `constraint ${name} must exist exactly once`).toHaveLength(1);
  return rows[0]!.def;
}

const literals = (text: string) =>
  [...text.matchAll(/'([^']*)'/g)].map((m) => m[1]!);
/** Literals of one rendered `col = ANY (ARRAY[...])` or `col = 'x'` term. */
const columnValues = (def: string, column: string) => {
  const out: string[][] = [];
  const any = new RegExp(
    `\\(${column} = ANY \\(ARRAY\\[([^\\]]*)\\]\\)\\)`,
    "g",
  );
  for (const m of def.matchAll(any)) out.push(literals(m[1]!));
  return out;
};
const sorted = (v: Iterable<string>) => [...new Set(v)].sort();
function expectSameSet(
  label: string,
  ts: Iterable<string>,
  db: Iterable<string>,
) {
  const t = sorted(ts),
    d = sorted(db);
  const onlyTs = t.filter((v) => !d.includes(v)),
    onlyDb = d.filter((v) => !t.includes(v));
  expect(
    { onlyInTypeScript: onlyTs, onlyInDatabase: onlyDb },
    `${label}: TypeScript and database value sets drifted`,
  ).toEqual({ onlyInTypeScript: [], onlyInDatabase: [] });
}

const VALUE = String.raw`(?:'(\w+)'::text|ANY \(ARRAY\[([^\]]*)\]\))`;
/** Every (previous -> next) pair a CHECK allows, expanding ARRAY forms. */
function transitionPairs(def: string, kind: "status" | "state") {
  const re = new RegExp(
    String.raw`\(previous_${kind} = ${VALUE}\) AND \(next_${kind} = ${VALUE}\)`,
    "g",
  );
  const pairs = new Set<string>();
  for (const m of def.matchAll(re)) {
    const from = m[1] ? [m[1]] : literals(m[2]!);
    const to = m[3] ? [m[3]] : literals(m[4]!);
    for (const a of from) for (const b of to) pairs.add(`${a} -> ${b}`);
  }
  return pairs;
}
const tsPairs = <S extends string>(states: readonly S[], next: (s: S) => S[]) =>
  states.flatMap((s) => next(s).map((n) => `${s} -> ${n}`));

describe("state machine drift: TypeScript copies vs the live database", () => {
  it("booking states per source family match bookings_demo_state", async () => {
    const def = await constraint("bookings_demo_state");
    const groups = columnValues(def, "state");
    expect(
      groups,
      "expected one demo and one workflow state list",
    ).toHaveLength(2);
    const demoDb = groups.find((g) => g.every((v) => v.startsWith("demo_")));
    const workflowDb = groups.find((g) =>
      g.every((v) => !v.startsWith("demo_")),
    );
    expect(demoDb, "demo family list not found").toBeDefined();
    expect(workflowDb, "workflow family list not found").toBeDefined();
    // The families are coupled to the source: demo with local_simulation only.
    expect(def).toMatch(
      /^CHECK \(\(\(\(source = 'local_simulation'::text\) AND \(state = ANY \(ARRAY\['demo_/,
    );
    const all = Object.keys(demoStateLabels);
    expectSameSet("bookings workflow states", workflowStates, workflowDb ?? []);
    expectSameSet(
      "bookings demo states",
      all.filter((s) => !(workflowStates as readonly string[]).includes(s)),
      demoDb ?? [],
    );
    expectSameSet("bookings all states (label map)", all, [
      ...(demoDb ?? []),
      ...(workflowDb ?? []),
    ]);
  });

  it("support case statuses and transitions match the database", async () => {
    const status = columnValues(
      await constraint("support_cases_status"),
      "status",
    );
    expect(status).toHaveLength(1);
    expectSameSet(
      "support_cases.status",
      Object.keys(statusLabels),
      status[0]!,
    );
    const dbPairs = transitionPairs(
      await constraint("support_case_events_shape"),
      "status",
    );
    expect(
      dbPairs.size,
      "no transitions parsed from the event CHECK",
    ).toBeGreaterThan(0);
    expectSameSet(
      "support status transitions",
      tsPairs(
        Object.keys(transitions) as (keyof typeof transitions)[],
        (s) => transitions[s],
      ),
      dbPairs,
    );
  });

  it("transactional delivery states, attempt cap, and claim window match", async () => {
    const groups = columnValues(
      await constraint("transactional_delivery_state_check"),
      "state",
    );
    expect(groups).toHaveLength(1);
    expectSameSet("transactional_deliveries.state", deliveryStates, groups[0]!);
    const attempts = (
      await constraint("transactional_delivery_prepared_shape")
    ).match(/attempts >= 1\) AND \(attempts <= (\d+)\)/);
    expect(
      attempts,
      "attempts bound not found in prepared_shape",
    ).not.toBeNull();
    expect(Number(attempts![1]), "DELIVERY_MAX_ATTEMPTS drifted").toBe(
      DELIVERY_MAX_ATTEMPTS,
    );
    const { rows } = await pool.query<{ src: string }>(
      "SELECT pg_get_functiondef(p.oid) AS src FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prosrc LIKE '%invalid delivery claim%'",
    );
    expect(rows, "claim trigger function not found").toHaveLength(1);
    const seconds = [
      ...rows[0]!.src.matchAll(
        /claim_until>clock_timestamp\(\)\s*\+\s*interval\s*'(\d+) seconds?'/g,
      ),
    ].map((m) => Number(m[1]) * 1000);
    expect(seconds, "claim interval not found in trigger source").toHaveLength(
      1,
    );
    expect(seconds[0], "DELIVERY_CLAIM_MS drifted from the claim trigger").toBe(
      DELIVERY_CLAIM_MS,
    );
  });

  it("review publication states and transitions match the database", async () => {
    const states = columnValues(
      await constraint("publication_reviews_state"),
      "state",
    );
    expect(states).toHaveLength(1);
    expectSameSet("publication_reviews.state", publicationStates, states[0]!);
    const pairs = transitionPairs(
      await constraint("publication_events_shape"),
      "state",
    );
    expect(pairs.size).toBeGreaterThan(0);
    expectSameSet(
      "publication transitions",
      tsPairs(publicationStates, nextPublicationStates),
      pairs,
    );
  });

  it("private review states and transitions match the database", async () => {
    const states = columnValues(
      await constraint("private_booking_reviews_state"),
      "state",
    );
    expect(states).toHaveLength(1);
    expectSameSet(
      "private_booking_reviews.state",
      privateReviewStates,
      states[0]!,
    );
    const pairs = transitionPairs(
      await constraint("private_review_events_shape"),
      "state",
    );
    expect(pairs.size).toBeGreaterThan(0);
    expectSameSet(
      "private review transitions",
      tsPairs(privateReviewStates, nextPrivateReviewStates),
      pairs,
    );
  });
});
