import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { isLoopbackOrigin } from "@/lib/local-mode";
import { AccessError, requireIdentity } from "@/lib/permissions/access";
import { queryBookingForReport } from "./query";

export async function readBookingForReport(
  runtime: AuthRuntime,
  headers: Headers,
  bookingId: string,
) {
  if (
    !["development", "test"].includes(runtime.environment) ||
    !isLoopbackOrigin(runtime.origin)
  )
    throw new AccessError(503);
  const identity = await requireIdentity(runtime, headers);
  if (!z.uuid().safeParse(bookingId).success) throw new AccessError(404);
  return queryBookingForReport(
    runtime.db,
    identity,
    bookingId,
    getLocalWorkflow(runtime) ? "local_operation" : "local_synthetic",
  );
}
