import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { GoogleMeetConfig } from "./config";
import { decryptSecret, tokenContext } from "./crypto";
import {
  GoogleFailure,
  type GoogleMeetProvider,
  type GoogleCreateDiagnostic,
} from "./provider";

type SqlConnection = Pick<Pool, "query">;
type Prepared = {
  connection_id: string;
  owner_id: string;
  google_subject: string;
  refresh_ciphertext: string;
  space_name: string | null;
  meeting_uri: string | null;
};
/** The caller supplies a dedicated least-privilege worker connection. Only
 * safe counts leave this module; no tokens, booking/space IDs or URLs. */
export async function drainGoogleMeet(
  db: SqlConnection,
  config: GoogleMeetConfig,
  provider: GoogleMeetProvider,
  limit = 10,
  reportDiagnostic?: (diagnostic: Readonly<GoogleCreateDiagnostic>) => void,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20)
    throw new Error("Invalid meeting batch size.");
  const counts = { claimed: 0, ready: 0, deferred: 0 };
  for (let i = 0; i < limit; i++) {
    const token = randomUUID();
    const claim = await db.query<{ id: string }>(
      "SELECT * FROM public.google_meet_claim($1,$2)",
      [config.fingerprint, token],
    );
    const id = claim.rows[0]?.id;
    if (!id) break;
    counts.claimed++;
    const params = [id, token, config.fingerprint];
    const prepare = await db.query<Prepared>(
      "SELECT * FROM public.google_meet_prepare($1,$2,$3,false)",
      params,
    );
    const job = prepare.rows[0];
    if (!job) {
      counts.deferred++;
      continue;
    }
    if (!job.space_name) {
      let access: string;
      try {
        const refresh = decryptSecret(
          config,
          job.refresh_ciphertext,
          tokenContext(
            job.connection_id,
            job.owner_id,
            job.google_subject,
            config.fingerprint,
          ),
        );
        access = await provider.accessToken(refresh);
      } catch (error) {
        await db.query("SELECT public.google_meet_fail($1,$2,$3)", [
          id,
          token,
          error instanceof GoogleFailure ? error.code : "credential",
        ]);
        counts.deferred++;
        continue;
      }
      // Reauthorize and durably mark dispatch after refresh, before create I/O.
      const dispatch = await db.query<Prepared>(
        "SELECT * FROM public.google_meet_prepare($1,$2,$3,true)",
        params,
      );
      if (!dispatch.rows.length) {
        counts.deferred++;
        continue;
      }
      let receipt;
      try {
        receipt = await provider.createSpace(access);
      } catch (error) {
        if (error instanceof GoogleFailure && error.diagnostic) {
          try {
            reportDiagnostic?.(error.diagnostic);
          } catch {
            /* Reporting cannot alter job state or retry behavior. */
          }
        }
        await db.query("SELECT public.google_meet_fail($1,$2,$3)", [
          id,
          token,
          error instanceof GoogleFailure ? error.code : "uncertain",
        ]);
        counts.deferred++;
        continue;
      }
      // A DB failure here must leave the dispatch marked; never retry create.
      await db.query("SELECT public.google_meet_receipt($1,$2,$3,$4)", [
        id,
        token,
        receipt.name,
        receipt.uri,
      ]);
    }
    const installed = await db.query<{ saved: boolean }>(
      "SELECT public.google_meet_install($1,$2,$3) AS saved",
      params,
    );
    if (installed.rows[0]?.saved) counts.ready++;
    else counts.deferred++;
  }
  return counts;
}
