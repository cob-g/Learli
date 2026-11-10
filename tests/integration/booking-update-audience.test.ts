import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { requireIdentity } from "@/lib/permissions/access";
import { readBookingUpdateAudience } from "@/features/bookings/update-audience";
import { listParticipantBookingOverview } from "@/features/bookings/read-service";
import {
  closeWorld,
  createAccount,
  openWorld,
  type World,
  type TestAccount,
} from "./support";

let world: World, actor: TestAccount, child: string, self: string;
beforeAll(async () => {
  world = openWorld();
  actor = await createAccount(world, ["parent", "student"]);
  child = (
    await world.owner.pool.query<{ id: string }>(
      "INSERT INTO learner_profiles(fixture_key,source,management,display_name,level,timezone) VALUES($1,'local_fixture','guardian','Synthetic audience child','elementary','UTC') RETURNING id",
      [randomUUID()],
    )
  ).rows[0].id;
  self = (
    await world.owner.pool.query<{ id: string }>(
      "INSERT INTO learner_profiles(fixture_key,source,management,user_id,display_name,level,timezone) VALUES($1,'local_fixture','self',$2,'Synthetic audience Student','college_support','UTC') RETURNING id",
      [randomUUID(), actor.id],
    )
  ).rows[0].id;
  await world.owner.pool.query(
    "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
    [actor.id, child],
  );
}, 60000);
afterAll(() => closeWorld(world));

it("matches the protected overview's learner set with one ID-only query and no provider refetch", async () => {
  const identity = await requireIdentity(world.runtime, actor.headers);
  for (const audience of ["parent", "student"] as const) {
    const overview = await listParticipantBookingOverview(
      world.runtime,
      actor.headers,
      { scope: audience === "parent" ? "guardian" : "student" },
    );
    const provider = vi.spyOn(world.runtime.auth.api, "getSession");
    const execute = vi.spyOn(world.runtime.db, "execute");
    try {
      expect(
        await readBookingUpdateAudience(
          world.runtime,
          identity,
          audience,
          null,
        ),
      ).toEqual(overview.history.learners.map((learner) => learner.id).sort());
      expect(execute).toHaveBeenCalledTimes(1);
      expect(provider).not.toHaveBeenCalled();
      const statement = execute.mock.calls[0][0];
      if (typeof statement === "string") throw new Error("Expected typed SQL");
      const { sql } = new PgDialect().sqlToQuery(statement.getSQL());
      expect(sql).not.toMatch(/\bbookings\b|jsonb_build_object|display_name/i);
    } finally {
      provider.mockRestore();
      execute.mockRestore();
    }
  }
});

it("removes revoked guardian authority without leaking the self learner into Parent scope", async () => {
  const identity = await requireIdentity(world.runtime, actor.headers);
  await world.owner.pool.query(
    "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1 AND learner_id=$2",
    [actor.id, child],
  );
  try {
    expect(
      await readBookingUpdateAudience(world.runtime, identity, "parent", null),
    ).toEqual([]);
    expect(
      await readBookingUpdateAudience(world.runtime, identity, "student", null),
    ).toEqual([self]);
  } finally {
    await world.owner.pool.query(
      "UPDATE guardian_learner_links SET status='authorized' WHERE guardian_user_id=$1 AND learner_id=$2",
      [actor.id, child],
    );
  }
});

it("rejects foreign sessions, suspension, removed roles and expired sessions using current SQL authority", async () => {
  const identity = await requireIdentity(world.runtime, actor.headers);
  await expect(
    readBookingUpdateAudience(
      world.runtime,
      { ...identity, sessionId: randomUUID() },
      "parent",
      null,
    ),
  ).rejects.toMatchObject({ status: 403 });
  await world.owner.pool.query(
    "UPDATE user_access SET status='suspended' WHERE user_id=$1",
    [actor.id],
  );
  try {
    await expect(
      readBookingUpdateAudience(world.runtime, identity, "parent", null),
    ).rejects.toMatchObject({ status: 403 });
  } finally {
    await world.owner.pool.query(
      "UPDATE user_access SET status='active' WHERE user_id=$1",
      [actor.id],
    );
  }
  await world.owner.pool.query(
    "DELETE FROM user_roles WHERE user_id=$1 AND role='parent'",
    [actor.id],
  );
  try {
    await expect(
      readBookingUpdateAudience(world.runtime, identity, "parent", null),
    ).rejects.toMatchObject({ status: 403 });
  } finally {
    await world.owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'parent')",
      [actor.id],
    );
  }
  await world.owner.pool.query(
    "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [identity.sessionId],
  );
  await expect(
    readBookingUpdateAudience(world.runtime, identity, "parent", null),
  ).rejects.toMatchObject({ status: 403 });
});
