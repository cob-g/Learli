import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { z } from "zod";
import type { Database } from "@/lib/db/connection";
import * as schema from "@/lib/db/schema";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const createdIdentity = z.object({ id: z.string().min(1) });

/** Keep required provisioning inside the provider's user/credential transaction. */
export function accountAdapter(
  db: Database,
): ReturnType<typeof drizzleAdapter> {
  return (options) => {
    const configuration = {
      provider: "pg" as const,
      schema,
      transaction: true,
    };
    const adapter = drizzleAdapter(db, configuration)(options);
    const create = adapter.create;

    function transactionalAdapter(tx: Transaction) {
      const transactional = drizzleAdapter(tx, {
        ...configuration,
        transaction: false,
      })(options);
      const create = transactional.create;
      transactional.create = async <T extends Record<string, unknown>, R = T>(
        input: Parameters<typeof create<T, R>>[0],
      ): Promise<R> => {
        // The public adapter supports selected output without id. Request id
        // internally for provisioning, then restore the caller's projection.
        const select = input.select;
        const hideId =
          input.model === "user" && !!select?.length && !select.includes("id");
        const created = await create<T, R>(
          hideId && select ? { ...input, select: [...select, "id"] } : input,
        );
        if (input.model === "user") {
          const { id } = createdIdentity.parse(created);
          await tx.insert(schema.userAccess).values({ userId: id });
          await tx.insert(schema.auditEvents).values({
            actorUserId: id,
            targetUserId: id,
            action: "account.created",
          });
          if (hideId && created && typeof created === "object")
            Reflect.deleteProperty(created, "id");
        }
        return created;
      };
      return transactional;
    }

    // Retain the native adapter object: Better Auth registers its schema check
    // by object identity. All untouched provider operations stay native.
    adapter.transaction = (callback) =>
      db.transaction((tx) => callback(transactionalAdapter(tx)));
    // Provider creation outside runWithTransaction still gets atomic base state.
    adapter.create = (input) =>
      input.model === "user"
        ? adapter.transaction((tx) => tx.create(input))
        : create(input);
    return adapter;
  };
}
