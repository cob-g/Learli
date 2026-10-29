import { assertPrivateWorkflowUnchanged } from "@/features/private-workflow/runtime";
// Node-only service. Identity comes from Better Auth, never submitted user IDs.
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { bookingMeetingLinks, bookingMeetingLinkEvents } from "@/lib/db/schema";
import { AccessError } from "@/lib/permissions/access";
import { resolveCoordinationSession } from "@/lib/permissions/coordination-session";
import { RuleError } from "@/lib/rule-error";
import { validateMeetingLink } from "@/lib/validation/meeting-link";
import { googleMeetConfig } from "@/features/google-meet/config";
import { meetingEditInput } from "./input";
import { queryPrivateMeeting } from "./query";
import type { PrivateMeetingState } from "./model";

async function meetingActor(
  runtime: AuthRuntime,
  headers: Headers,
  bookingId: string,
) {
  const actor = await resolveCoordinationSession(runtime, headers);
  if (!z.uuid().safeParse(bookingId).success) throw new AccessError(404);
  return actor;
}

export async function readPrivateMeetingLink(
  runtime: AuthRuntime,
  headers: Headers,
  bookingId: string,
): Promise<PrivateMeetingState> {
  const actor = await meetingActor(runtime, headers, bookingId);
  const row = await queryPrivateMeeting(runtime.db, actor, bookingId);
  assertPrivateWorkflowUnchanged(
    runtime,
    "privatePacket" in actor ? actor.privatePacket : null,
  );
  if (!row) throw new AccessError(404);
  if (row.awaitingConfirmation) return { state: "awaiting_confirmation" };
  if (!row.live) return { state: "expired" };
  if (!row.url || !row.provider || !row.revision) {
    let provisioning: "preparing" | "action_required" | undefined;
    if (row.source === "local_operation") {
      let fingerprint: string | null = null;
      try {
        fingerprint = googleMeetConfig()?.fingerprint ?? null;
      } catch {
        // Optional provider setup must not hide the authorized manual form.
        // Database and fresh authorization failures still propagate below.
        provisioning = "action_required";
      }
      const result = await runtime.db.execute<{
        status: "preparing" | "action_required" | null;
      }>(
        sql`SELECT public.google_meet_job_status(${actor.userId},${actor.sessionId},${bookingId}::uuid,${fingerprint}) AS status`,
      );
      provisioning = result.rows[0]?.status ?? provisioning;
      // A second private read prevents a revocation during the status query from
      // returning a stale authorized projection, without any provider I/O.
      const fresh = await queryPrivateMeeting(runtime.db, actor, bookingId);
      if (!fresh?.live) throw new AccessError(404);
      if (fresh.url && fresh.provider && fresh.revision)
        return {
          state: "present",
          canEdit: fresh.canEdit,
          revision: fresh.revision,
          provider: fresh.provider,
          url: fresh.url,
        };
      return {
        state: "missing",
        canEdit: fresh.canEdit,
        revision: 0,
        ...(provisioning ? { provisioning } : {}),
      };
    }
    return {
      state: "missing",
      canEdit: row.canEdit,
      revision: 0,
      ...(provisioning ? { provisioning } : {}),
    };
  }
  return {
    state: "present",
    canEdit: row.canEdit,
    revision: row.revision,
    provider: row.provider,
    url: row.url,
  };
}

const conflict = () =>
  new RuleError(
    409,
    "The meeting link changed. Reload it before saving again.",
  );

export async function savePrivateMeetingLink(
  runtime: AuthRuntime,
  headers: Headers,
  bookingId: string,
  input: unknown,
) {
  const actor = await meetingActor(runtime, headers, bookingId);
  const values = meetingEditInput.parse(input);
  const link = validateMeetingLink(values.url);
  if (!link.ok)
    throw new RuleError(
      400,
      "localWorkflow" in actor && actor.localWorkflow
        ? "Enter a supported HTTPS Zoom or Google Meet link."
        : "Enter a supported HTTPS Zoom or Google Meet test link.",
    );
  return runtime.db.transaction(
    async (tx) => {
      // Same tutor-first protocol as reservation expiry/time-off. No booking writes.
      await tx.execute(
        sql`SELECT tp.id FROM tutor_profiles tp JOIN bookings b ON b.tutor_id=tp.id WHERE b.id=${bookingId}::uuid FOR UPDATE OF tp`,
      );
      await tx.execute(
        sql`SELECT id FROM bookings WHERE id=${bookingId}::uuid FOR NO KEY UPDATE`,
      );
      assertPrivateWorkflowUnchanged(
        runtime,
        "privatePacket" in actor ? actor.privatePacket : null,
      );
      const row = await queryPrivateMeeting(tx, actor, bookingId, true);
      if (!row?.live || !row.canEdit) throw new AccessError(404);
      const [current] = await tx
        .select()
        .from(bookingMeetingLinks)
        .where(eq(bookingMeetingLinks.bookingId, bookingId));
      if (current?.requestId === values.requestId) {
        if (
          current.url !== link.url ||
          current.revision !== values.expectedRevision + 1 ||
          current.updatedByUserId !== actor.userId
        )
          throw conflict();
        assertPrivateWorkflowUnchanged(
          runtime,
          "privatePacket" in actor ? actor.privatePacket : null,
        );
        return { revision: current.revision };
      }
      if ((current?.revision ?? 0) !== values.expectedRevision)
        throw conflict();
      const [replayed] = await tx
        .select({ id: bookingMeetingLinkEvents.id })
        .from(bookingMeetingLinkEvents)
        .where(
          and(
            eq(bookingMeetingLinkEvents.bookingId, bookingId),
            eq(bookingMeetingLinkEvents.requestId, values.requestId),
          ),
        );
      if (replayed) throw conflict();
      const revision = values.expectedRevision + 1;
      const updatedAt = new Date(row.now);
      const stored = {
        provider: link.provider,
        url: link.url,
        revision,
        requestId: values.requestId,
        updatedByUserId: actor.userId,
        updatedAt,
      };
      if (current)
        await tx
          .update(bookingMeetingLinks)
          .set(stored)
          .where(eq(bookingMeetingLinks.bookingId, bookingId));
      else
        await tx.insert(bookingMeetingLinks).values({ bookingId, ...stored });
      await tx.insert(bookingMeetingLinkEvents).values({
        bookingId,
        revision,
        requestId: values.requestId,
        actorUserId: actor.userId,
        createdAt: updatedAt,
      });
      if (row.source !== "local_simulation") {
        const fresh = await queryPrivateMeeting(tx, actor, bookingId, true);
        if (!fresh?.live || !fresh.canEdit) throw new AccessError(404);
      }
      assertPrivateWorkflowUnchanged(
        runtime,
        "privatePacket" in actor ? actor.privatePacket : null,
      );
      return { revision };
    },
    { isolationLevel: "read committed" },
  );
}
