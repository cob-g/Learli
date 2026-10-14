/** Intersect raw windows from already-fetched batches; callers own empty guards
 * and all candidate-start, duration and preference rules.
 */
export function commonCandidateBatchWindow(
  batches: readonly { readonly from: string; readonly to: string }[],
) {
  return {
    from: Math.max(...batches.map((batch) => Date.parse(batch.from))),
    to: Math.min(...batches.map((batch) => Date.parse(batch.to))),
  };
}
