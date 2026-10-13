// Node-only provider. No env loading, migration, fixture or native-pool export.
import { EventEmitter } from "node:events";
import {
  Pool,
  type PoolClient,
  type QueryArrayConfig,
  type QueryArrayResult,
  type QueryConfig,
  type QueryResult,
  type QueryResultRow,
} from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Database } from "./connection";
import * as schema from "./schema";
import {
  assertStagingTlsEnvironment,
  StagingDatabaseError,
} from "./staging-config";
import {
  verifiedPoolConfig,
  type VerifiedDatabaseConfig,
} from "./verified-config";
import { verifyRuntimeLease } from "./hosted-runtime-validation";

type QueryCallback<T> = (error: Error | undefined, result?: T) => void;
/** SQL/config overloads only. Submittable/COPY/cursor raw transport is excluded. */
export interface HostedRuntimeQuery {
  <R extends unknown[] = unknown[]>(
    query: QueryArrayConfig<unknown[]>,
    values?: unknown[],
  ): Promise<QueryArrayResult<R>>;
  <R extends QueryResultRow = Record<string, unknown>>(
    query: string | QueryConfig<unknown[]>,
    values?: unknown[],
  ): Promise<QueryResult<R>>;
  <R extends unknown[] = unknown[]>(
    query: QueryArrayConfig<unknown[]>,
    callback: QueryCallback<QueryArrayResult<R>>,
  ): void;
  <R extends QueryResultRow = Record<string, unknown>>(
    query: string | QueryConfig<unknown[]>,
    callback: QueryCallback<QueryResult<R>>,
  ): void;
  <R extends QueryResultRow = Record<string, unknown>>(
    query: string | QueryConfig<unknown[]>,
    values: unknown[],
    callback: QueryCallback<QueryResult<R>>,
  ): void;
}
export interface HostedRuntimeClient {
  readonly query: HostedRuntimeQuery;
  release(error?: Error | boolean): void;
  on(event: "error", listener: (error: Error) => void): this;
}
export interface HostedRuntimePool {
  readonly query: HostedRuntimeQuery;
  connect(): Promise<HostedRuntimeClient>;
  connect(
    callback: (
      error: Error | undefined,
      client: HostedRuntimeClient | undefined,
      release: (error?: Error | boolean) => void,
    ) => void,
  ): void;
  end(): Promise<void>;
  end(callback: (error?: Error) => void): void;
  readonly totalCount: number;
  readonly idleCount: number;
  readonly waitingCount: number;
  readonly ending: boolean;
  readonly ended: boolean;
  on(event: "error", listener: (error: Error) => void): this;
}

function safeFailure(error: unknown): Error {
  if (error instanceof StagingDatabaseError) return error;
  // Existing conflict helpers need SQLSTATE/constraint through Drizzle's cause.
  // Never copy driver message/detail/query/stack/cause or connection identity.
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[0-9A-Z]{5}$/.test(error.code)
  ) {
    const safe = Object.assign(new Error("Hosted database query failed."), {
      code: error.code,
    });
    if (
      "constraint" in error &&
      typeof error.constraint === "string" &&
      /^[a-z_][a-z0-9_]{0,62}$/.test(error.constraint)
    )
      Object.assign(safe, { constraint: error.constraint });
    return safe;
  }
  return new StagingDatabaseError("connection_failed");
}

type SqlConfig = QueryConfig<unknown[]> & { rowMode?: "array" };
function sqlConfig(args: unknown[]): SqlConfig {
  const input = args[0];
  const config: SqlConfig =
    typeof input === "string"
      ? { text: input }
      : input && typeof input === "object" && "text" in input
        ? {
            text: (input as SqlConfig).text,
            name: (input as SqlConfig).name,
            values: (input as SqlConfig).values,
            types: (input as SqlConfig).types,
            rowMode: (input as SqlConfig).rowMode,
          }
        : { text: "" };
  if (
    typeof config.text !== "string" ||
    !config.text ||
    (config.name !== undefined && typeof config.name !== "string") ||
    (config.rowMode !== undefined && config.rowMode !== "array") ||
    (config.values !== undefined && !Array.isArray(config.values)) ||
    (args[1] !== undefined && !Array.isArray(args[1])) ||
    args.length > 2
  )
    throw new StagingDatabaseError("config_invalid");
  if (args[1] !== undefined) config.values = args[1] as unknown[];
  return config;
}

function queryMethod(
  execute: (config: SqlConfig) => Promise<QueryResult>,
): HostedRuntimeQuery {
  // One implementation handles every declared promise/callback overload.
  return ((...input: unknown[]) => {
    const args = [...input];
    const callback =
      typeof args.at(-1) === "function"
        ? (args.pop() as QueryCallback<QueryResult>)
        : undefined;
    const result = Promise.resolve()
      .then(() => execute(sqlConfig(args)))
      .catch((error: unknown) => {
        throw safeFailure(error);
      });
    if (!callback) return result;
    // Caller callback exceptions are not connection failures and are not retried.
    void result.then(
      (value) => callback(undefined, value),
      (error: Error) => callback(error),
    );
  }) as HostedRuntimeQuery;
}

class RuntimeLease extends EventEmitter implements HostedRuntimeClient {
  readonly query: HostedRuntimeQuery;
  #active = true;
  #client: PoolClient;
  #release: PoolClient["release"];
  #onError: (error: Error) => void;

  constructor(client: PoolClient) {
    super();
    this.#client = client;
    this.#release = client.release.bind(client);
    // Consume errors safely even if callers do not subscribe. No raw client event.
    this.on("error", () => undefined);
    this.#onError = (error) => {
      if (this.#active) this.release(true);
      this.emit("error", safeFailure(error));
    };
    client.on("error", this.#onError);
    this.query = queryMethod(async (config) => {
      assertStagingTlsEnvironment();
      if (!this.#active) throw new StagingDatabaseError("connection_failed");
      try {
        return await this.#client.query(config);
      } catch (error) {
        // Drizzle's pinned transaction BEGIN sits outside its finally block.
        // Reclaim that otherwise leaked lease if BEGIN itself fails.
        if (/^\s*begin\b/i.test(config.text) && this.#active)
          this.release(true);
        throw error;
      }
    });
  }

  release(error?: Error | boolean): void {
    if (!this.#active) throw new StagingDatabaseError("cleanup_failed");
    this.#active = false;
    if (error) {
      this.#client.removeListener("error", this.#onError);
      this.#release(true);
      return;
    }
    // Keep the native client borrowed until cleanup completes. ROLLBACK is safe
    // for idle and failed transactions. Keep named prepared statements: DISCARD
    // ALL would invalidate pg's still-cached prepared statement names.
    void this.#client
      .query(
        "ROLLBACK; RESET ROLE; RESET SESSION AUTHORIZATION; RESET ALL; " +
          "CLOSE ALL; UNLISTEN *; SELECT pg_catalog.pg_advisory_unlock_all(); " +
          "DISCARD TEMP; DISCARD SEQUENCES",
      )
      .then(
        () => {
          this.#client.removeListener("error", this.#onError);
          this.#release();
        },
        () => {
          this.#client.removeListener("error", this.#onError);
          this.#release(true);
          this.emit("error", new StagingDatabaseError("cleanup_failed"));
        },
      );
  }
  /** Internal cleanup may follow an asynchronous socket failure. */
  finish(error?: Error | boolean): void {
    if (this.#active) this.release(error);
  }
}

/** Named adapter: pinned Drizzle recognizes prototype constructor names with
 * Pool. It never receives the private native pool or an unchecked client. */
class GuardedRuntimePool extends EventEmitter implements HostedRuntimePool {
  readonly query: HostedRuntimeQuery;
  #native: Pool;
  #config: VerifiedDatabaseConfig;
  #closing: Promise<void> | undefined;

  constructor(native: Pool, config: VerifiedDatabaseConfig) {
    super();
    this.#native = native;
    this.#config = config;
    this.on("error", () => undefined);
    native.on("error", (error: Error) =>
      this.emit("error", safeFailure(error)),
    );
    this.query = queryMethod(async (query) => {
      const client = await this.#checkout();
      let failed = false;
      try {
        return await client.query(query);
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        client.finish(failed);
      }
    });
  }

  get totalCount() {
    return this.#native.totalCount;
  }
  get idleCount() {
    return this.#native.idleCount;
  }
  get waitingCount() {
    return this.#native.waitingCount;
  }
  get ending() {
    return this.#native.ending;
  }
  get ended() {
    return this.#native.ended;
  }

  async #checkout(): Promise<RuntimeLease> {
    assertStagingTlsEnvironment();
    if (this.#closing) throw new StagingDatabaseError("connection_failed");
    let client: PoolClient | undefined;
    // A borrowed native client can fail during verification as well as app SQL.
    const onError = () => undefined;
    try {
      client = await this.#native.connect();
      client.on("error", onError);
      await verifyRuntimeLease(client, this.#config);
      if (this.#closing) throw new StagingDatabaseError("connection_failed");
      const lease = new RuntimeLease(client);
      lease.on("error", (error: Error) => this.emit("error", error));
      client.removeListener("error", onError);
      return lease;
    } catch (error) {
      if (client) {
        client.removeListener("error", onError);
        client.release(true);
      }
      throw safeFailure(error);
    }
  }

  connect(): Promise<HostedRuntimeClient>;
  connect(callback: Parameters<HostedRuntimePool["connect"]>[0]): void;
  connect(
    callback?: Parameters<HostedRuntimePool["connect"]>[0],
  ): Promise<HostedRuntimeClient> | void {
    const result = this.#checkout();
    if (!callback) return result;
    void result.then(
      (client) => {
        try {
          callback(undefined, client, client.release.bind(client));
        } catch (error) {
          client.finish(true);
          throw error;
        }
      },
      (error: Error) => callback(error, undefined, () => undefined),
    );
  }

  end(): Promise<void>;
  end(callback: (error?: Error) => void): void;
  end(callback?: (error?: Error) => void) {
    this.#closing ??= this.#native.end().catch(() => {
      throw new StagingDatabaseError("cleanup_failed");
    });
    if (!callback) return this.#closing;
    void this.#closing.then(
      () => callback(),
      (error: Error) => callback(error),
    );
  }
}

// Keep the pinned driver's name-based pool detection stable in server bundles.
// This remains a normal adapter class, without native/prototype impersonation.
Object.defineProperty(GuardedRuntimePool, "name", {
  value: "GuardedRuntimePool",
});

function allocateRuntimeDatabase(config: VerifiedDatabaseConfig) {
  const options = verifiedPoolConfig(config);
  if (
    config.purpose !== "runtime" ||
    config.role !== "learli_app" ||
    config.target.environment === "production"
  )
    throw new StagingDatabaseError("config_invalid");
  const pool = new GuardedRuntimePool(
    new Pool({ ...options, application_name: "learli-hosted-runtime" }),
    config,
  );
  const close = () => pool.end();
  const db: Database = drizzle(pool as unknown as Pool, { schema });
  return Object.freeze({ db, pool, close });
}
/** Development auth composition can allocate synchronously without an unchecked
 * query: every SQL operation and transaction still requires a verified lease. */
export function createNeonDevelopmentDatabase(config: VerifiedDatabaseConfig) {
  verifiedPoolConfig(config);
  if (config.target.environment !== "development")
    throw new StagingDatabaseError("config_invalid");
  return allocateRuntimeDatabase(config);
}
export async function createHostedRuntimeDatabase(
  config: VerifiedDatabaseConfig,
) {
  verifiedPoolConfig(config);
  if (config.target.environment !== "staging")
    throw new StagingDatabaseError("config_invalid");
  const runtime = allocateRuntimeDatabase(config);
  try {
    const probe = await runtime.pool.connect();
    probe.release();
    return runtime;
  } catch (error) {
    await runtime.close();
    throw safeFailure(error);
  }
}
