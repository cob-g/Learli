import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { drill, readSource } from "../../scripts/local-backup-restore";

const startupFault = vi.hoisted(() => ({
  mode: "" as "" | "log-write" | "nonzero" | "timeout",
  livePid: 0,
  directory: "",
}));
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  const fs = await import("node:fs");
  return {
    ...actual,
    spawnSync: (...args: Parameters<typeof actual.spawnSync>) => {
      const result = actual.spawnSync(...args);
      const toolArgs = args[1];
      if (
        startupFault.mode &&
        path.basename(String(args[0])) === "pg_ctl" &&
        Array.isArray(toolArgs) &&
        toolArgs.includes("start") &&
        result.status === 0
      ) {
        const data = toolArgs[toolArgs.indexOf("-D") + 1];
        startupFault.directory = path.dirname(data);
        startupFault.livePid = Number(
          fs
            .readFileSync(path.join(data, "postmaster.pid"), "utf8")
            .split("\n")[0],
        );
        // This proves a real server exists before the failure is injected.
        process.kill(startupFault.livePid, 0);
        if (startupFault.mode === "nonzero") return { ...result, status: 1 };
        if (startupFault.mode === "timeout")
          return {
            ...result,
            status: null,
            error: Object.assign(new Error("Synthetic pg_ctl timeout"), {
              code: "ETIMEDOUT",
            }),
          };
      }
      return result;
    },
  };
});
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) => {
      if (
        startupFault.mode === "log-write" &&
        startupFault.livePid &&
        path.dirname(String(args[0])) === startupFault.directory &&
        path.basename(String(args[0])).startsWith("pg_ctl-")
      )
        throw Object.assign(new Error("Synthetic evidence disk full"), {
          code: "ENOSPC",
        });
      return actual.writeFileSync(...args);
    },
  };
});

describe("owned synthetic backup and real restoration", () => {
  it("restores exact migrated records, ACLs, constraints and refuses reuse/occupied targets", async () => {
    const source = readSource(process.cwd());
    const owner = new Client(source.config);
    await owner.connect();
    const user = `restore-${randomUUID()}`,
      tutorUser = `restore-${randomUUID()}`;
    const tutor = randomUUID(),
      learner = randomUUID(),
      booking = randomUUID();
    const runId = `proof-${randomUUID()}`;
    const port = Number(process.env.LEARLI_RESTORE_PORT ?? 55512);
    try {
      await owner.query(
        "INSERT INTO \"user\" (id,name,email,email_verified,created_at,updated_at) VALUES ($1,'Synthetic restore learner',$2,true,now(),now()),($3,'Synthetic restore tutor',$4,true,now(),now())",
        [user, `${user}@learli.test`, tutorUser, `${tutorUser}@learli.test`],
      );
      await owner.query(
        "INSERT INTO user_roles (user_id,role) VALUES ($1,'student'),($2,'tutor')",
        [user, tutorUser],
      );
      await owner.query(
        "INSERT INTO tutor_profiles (id,user_id,headline,bio,teaching_background,timezone,slug,review_status) VALUES ($1,$2,'Synthetic restore tutor','Synthetic restoration fixture','Synthetic background','UTC',$3,'approved')",
        [tutor, tutorUser, `restore-${tutor}`],
      );
      await owner.query(
        "INSERT INTO learner_profiles (id,fixture_key,source,management,user_id,display_name,level,timezone) VALUES ($1,$2,'local_fixture','self',$3,'Synthetic restore learner','college_support','UTC')",
        [learner, `restore-${learner}`, user],
      );
      const subject = (
        await owner.query<{ id: string }>(
          "SELECT id FROM subjects WHERE slug='math'",
        )
      ).rows[0].id;
      await owner.query(
        "INSERT INTO tutor_subjects (tutor_id,subject_id,levels) VALUES ($1,$2,ARRAY['college_support'])",
        [tutor, subject],
      );
      await owner.query(
        "INSERT INTO bookings (id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,expires_at) VALUES ($1,'local_simulation',$2,$3,$4,$5,now()+interval '2 days',now()+interval '2 days 1 hour','UTC',$6,repeat('a',64),'demo_reserved',now()+interval '1 hour')",
        [booking, tutor, learner, user, subject, randomUUID()],
      );
      await owner.query(
        "INSERT INTO booking_events (id,booking_id,event) VALUES ($1,$2,'demo_reserved')",
        [randomUUID(), booking],
      );
      const foreignId = `foreign-${randomUUID()}`;
      const foreignDirectory = path.join(
        source.local,
        "backup-restore",
        foreignId,
      );
      mkdirSync(foreignDirectory, { recursive: true, mode: 0o700 });
      const sentinel = path.join(foreignDirectory, "unrecognized.txt");
      writeFileSync(sentinel, "Foreign target must stay intact", {
        mode: 0o600,
      });
      await expect(
        drill({ runId: foreignId, restorePort: port }),
      ).rejects.toThrow("existing-target");
      expect(readFileSync(sentinel, "utf8")).toBe(
        "Foreign target must stay intact",
      );
      expect(existsSync(path.join(foreignDirectory, "backup.dump"))).toBe(
        false,
      );
      const failedId = `failure-${randomUUID()}`;
      const savedTools = process.env.PG_BIN;
      process.env.PG_BIN = path.join(source.local, "missing-drill-tools");
      try {
        await expect(
          drill({ runId: failedId, restorePort: port }),
        ).rejects.toThrow("failed");
      } finally {
        if (savedTools === undefined) delete process.env.PG_BIN;
        else process.env.PG_BIN = savedTools;
      }
      const failedDirectory = path.join(
        source.local,
        "backup-restore",
        failedId,
      );
      expect(
        JSON.parse(
          readFileSync(path.join(failedDirectory, "failure.json"), "utf8"),
        ).status,
      ).toBe("FAIL");
      expect(existsSync(path.join(failedDirectory, "result.json"))).toBe(false);
      expect(existsSync(path.join(failedDirectory, "data"))).toBe(false);
      for (const mode of ["log-write", "nonzero", "timeout"] as const) {
        const faultId = `startup-${mode}-${randomUUID()}`;
        startupFault.mode = mode;
        startupFault.livePid = 0;
        startupFault.directory = "";
        try {
          await expect(
            drill({ runId: faultId, restorePort: port }),
          ).rejects.toThrow("failed");
          expect(startupFault.livePid).toBeGreaterThan(0);
          expect(() => process.kill(startupFault.livePid, 0)).toThrow();
          const faultDirectory = path.join(
            source.local,
            "backup-restore",
            faultId,
          );
          expect(
            existsSync(path.join(faultDirectory, "data/postmaster.pid")),
          ).toBe(false);
          expect(existsSync(path.join(faultDirectory, "backup.dump"))).toBe(
            true,
          );
          expect(existsSync(path.join(faultDirectory, "server.log"))).toBe(
            true,
          );
          expect(existsSync(path.join(faultDirectory, "result.json"))).toBe(
            false,
          );
          expect(
            JSON.parse(
              readFileSync(path.join(faultDirectory, "failure.json"), "utf8"),
            ).status,
          ).toBe("FAIL");
          // Binding the port proves actual cleanup, beyond internal bookkeeping.
          const available = net.createServer();
          await new Promise<void>((resolve, reject) => {
            available.once("error", reject);
            available.listen(port, "127.0.0.1", resolve);
          });
          await new Promise<void>((resolve, reject) =>
            available.close((error) => (error ? reject(error) : resolve())),
          );
          expect(
            (await owner.query("SELECT 1 FROM bookings WHERE id=$1", [booking]))
              .rowCount,
          ).toBe(1);
          expect(readFileSync(sentinel, "utf8")).toBe(
            "Foreign target must stay intact",
          );
        } finally {
          startupFault.mode = "";
        }
      }
      const result = await drill({ runId, restorePort: port });
      expect(result.status).toBe("PASS");
      expect(result.tables).toBe(33);
      expect(result.migrations).toBe(17);
      expect(result.exactRowsSchemaGrantsSequencesRoles).toBe(true);
      expect(result.proof.overlapConstraint).toBe(true);
      expect(result.proof.runtimeDenials).toBe(5);
      expect(result.proof.schemaRuleDriftRejected).toBe(true);
      const record = JSON.parse(
        readFileSync(
          path.join(source.local, "backup-restore", runId, "result.json"),
          "utf8",
        ),
      );
      expect(record.status).toBe("PASS");
      await expect(drill({ runId, restorePort: port })).rejects.toThrow(
        "existing-target",
      );
      const listener = net.createServer();
      await new Promise<void>((resolve, reject) => {
        listener.once("error", reject);
        listener.listen(port, "127.0.0.1", resolve);
      });
      try {
        await expect(
          drill({ runId: `occupied-${randomUUID()}`, restorePort: port }),
        ).rejects.toThrow("occupied-port");
      } finally {
        await new Promise<void>((resolve, reject) =>
          listener.close((error) => (error ? reject(error) : resolve())),
        );
      }
      // The source still contains its exact fixture; only the new target was stopped.
      expect(
        (await owner.query("SELECT 1 FROM bookings WHERE id=$1", [booking]))
          .rowCount,
      ).toBe(1);
    } finally {
      // Cleanup owns only these exact fixture identifiers; preserved dump remains private.
      await owner.query(
        "DELETE FROM booking_notification_deliveries WHERE event_id IN (SELECT id FROM booking_events WHERE booking_id=$1)",
        [booking],
      );
      await owner.query("DELETE FROM booking_events WHERE booking_id=$1", [
        booking,
      ]);
      await owner.query("DELETE FROM bookings WHERE id=$1", [booking]);
      await owner.query("DELETE FROM learner_profiles WHERE id=$1", [learner]);
      await owner.query("DELETE FROM tutor_profiles WHERE id=$1", [tutor]);
      await owner.query("DELETE FROM user_roles WHERE user_id IN ($1,$2)", [
        user,
        tutorUser,
      ]);
      await owner.query('DELETE FROM "user" WHERE id IN ($1,$2)', [
        user,
        tutorUser,
      ]);
      await owner.end();
    }
  }, 180_000);
});
