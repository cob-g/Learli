import { describe, it, expect } from "vitest";
import { openWorld, closeWorld, createAccount } from "./support";

describe("owned synthetic fixture verification throttle isolation", () => {
  it("performs real successful verification before role grant despite prior saturated fixture callback counter", async () => {
    const world = openWorld();
    try {
      await createAccount(world);
      const keys = (
        await world.owner.pool.query(
          "SELECT id,key FROM rate_limit WHERE key LIKE '%verify-email%'",
        )
      ).rows;
      expect(keys).toHaveLength(1);
      const key = String(keys[0].key);
      const saturated = await world.owner.pool.query(
        "UPDATE rate_limit SET count=100,last_request=$1 WHERE id=$2 AND key=$3",
        [Date.now(), keys[0].id, key],
      );
      expect(saturated.rowCount).toBe(1);
      const actor = await createAccount(world, ["parent"]);
      const actual = (
        await world.owner.pool.query(
          "SELECT u.email_verified,EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='parent') granted FROM \"user\" u WHERE u.id=$1",
          [actor.id],
        )
      ).rows[0];
      expect(actual).toEqual({ email_verified: true, granted: true });
      expect(
        (await world.runtime.auth.api.getSession({ headers: actor.headers }))
          ?.user.emailVerified,
      ).toBe(true);
    } finally {
      await world.owner.pool.query(
        "UPDATE rate_limit SET count=0 WHERE key LIKE '%verify-email%'",
      );
      await closeWorld(world);
    }
  }, 15000);
});
