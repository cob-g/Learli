// Opt-in process-only instrumentation. It records timings/categories, never SQL,
// parameters, URLs, identities, cookies or meeting details.
import pg from "pg";
import { writeFileSync, realpathSync } from "node:fs";
import { performance } from "node:perf_hooks";

export const samples = [];
const enabled =
  process.env.LEARLI_PERFORMANCE_ROOT &&
  realpathSync(process.env.LEARLI_PERFORMANCE_ROOT) ===
    realpathSync(process.cwd()) &&
  realpathSync(process.cwd()).startsWith(
    `${realpathSync("/tmp")}/learli-booking-perf-`,
  );
if (!enabled)
  throw new Error("Explicit isolated performance process required.");
const transactions = new WeakMap();
const category = (text) =>
  text.includes("AS learners")
    ? "booking-overview"
    : text.includes("booking_update_audience")
      ? "stream-authority"
      : text.includes("FROM public.bookings b WHERE b.tutor_id=")
        ? "blocking-bookings"
        : text.includes('"session"') || text.includes("public.session")
          ? "session-or-authority"
          : "other";
const query = pg.Client.prototype.query;
pg.Client.prototype.query = function (...args) {
  const text = typeof args[0] === "string" ? args[0] : (args[0]?.text ?? "");
  const start = performance.now();
  const finish = (error, result) => {
    const end = performance.now();
    if (samples.length < 200000)
      samples.push({
        kind: "query",
        category: category(text),
        ms: end - start,
        rows: result?.rowCount ?? 0,
        error: !!error,
        at: Date.now(),
      });
    if (/^begin\b/i.test(text)) transactions.set(this, { start });
    const tx = transactions.get(this);
    if (tx && /tutor_profiles/i.test(text) && /for update/i.test(text))
      tx.lock = end;
    if (tx && /^(commit|rollback)\b/i.test(text)) {
      samples.push({
        kind: "transaction",
        ms: end - tx.start,
        tutorLockMs: tx.lock === undefined ? null : end - tx.lock,
        at: Date.now(),
      });
      transactions.delete(this);
    }
  };
  const callback = args.at(-1);
  if (typeof callback === "function") {
    args[args.length - 1] = (error, result) => {
      finish(error, result);
      callback(error, result);
    };
    return query.apply(this, args);
  }
  const result = query.apply(this, args);
  if (result?.then)
    return result.then(
      (value) => {
        finish(null, value);
        return value;
      },
      (error) => {
        finish(error);
        throw error;
      },
    );
  return result;
};
const connect = pg.Pool.prototype.connect;
pg.Pool.prototype.connect = function (callback) {
  const start = performance.now();
  const waiting = this.waitingCount;
  const finish = () =>
    samples.push({
      kind: "checkout",
      ms: performance.now() - start,
      waiting,
      at: Date.now(),
    });
  if (typeof callback === "function")
    return connect.call(this, (error, client, release) => {
      finish();
      callback(error, client, release);
    });
  return connect.call(this).then((client) => {
    finish();
    return client;
  });
};
const file = process.env.LEARLI_PERFORMANCE_METRICS;
if (file) {
  const write = () =>
    writeFileSync(file, JSON.stringify(samples), { mode: 0o600 });
  setInterval(write, 500).unref();
  process.on("exit", write);
}
