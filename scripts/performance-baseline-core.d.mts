export class BaselineError extends Error {}
export function fixtureEmail(
  run: string,
  kind: "learner" | "tutor",
  index: number,
): string;
export function disposeContexts(
  contexts: { dispose: () => Promise<void> }[],
): Promise<boolean>;
export const workload: Readonly<{
  tutors: number;
  repetitions: number;
  pageWarmups: number;
  pageSamples: number;
  bookingWarmups: number;
  bookingPairsPerRepetition: number;
}>;
export function distribution(samples: number[]): {
  n: number;
  min: number;
  mean: number;
  p50: number;
  p95: number;
  max: number;
};
export function validateEnvironment(
  env: Record<string, string | undefined>,
  state: {
    ports: { database: number; test: number };
    appPassword: string;
    ownerPassword: string;
  },
): string;
export function ownedEnvironment(
  env: Record<string, string | undefined>,
  root?: string,
): string;
export function sourceIdentity(root?: string): {
  head: string;
  manifest: { file: string; sha256: string }[];
  aggregate: string;
};
