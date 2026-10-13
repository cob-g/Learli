import { sql, type SQL } from "drizzle-orm";
export type WorkflowState =
  | "provisional"
  | "confirmed"
  | "completed"
  | "no_show"
  | "expired"
  | "cancelled"
  | "replaced";
export type WorkflowEvent =
  | "workflow_provisional"
  | "workflow_confirmed"
  | "workflow_completed"
  | "workflow_no_show"
  | "workflow_expired"
  | "workflow_cancelled"
  | "workflow_rescheduled";
export const workflowLabels: Record<WorkflowState, string> = {
  provisional: "Synthetic provisional booking",
  confirmed: "Synthetic booking confirmed",
  completed: "Synthetic administrative completion",
  no_show: "Synthetic administrative no-show",
  expired: "Synthetic booking expired",
  cancelled: "Synthetic booking cancelled",
  replaced: "Synthetic booking replaced",
};
export const workflowEventLabels: Record<WorkflowEvent, string> = {
  workflow_provisional: "Synthetic request saved",
  workflow_confirmed: "Synthetic confirmation saved",
  workflow_completed: "Administrative completion saved",
  workflow_no_show: "Administrative no-show saved",
  workflow_expired: "Provisional expiry saved",
  workflow_cancelled: "Synthetic cancellation saved",
  workflow_rescheduled: "Synthetic time replacement saved",
};
/** All consumers must use the same source-aware blocking predicate. */
export function blockingBookingPredicate(alias: SQL, now: SQL | Date): SQL {
  return sql`((${alias}.source='local_simulation' AND ${alias}.state IN ('demo_reserved','demo_confirmed') AND ${alias}.expires_at>${now}) OR (${alias}.source='synthetic_readiness' AND (${alias}.state='confirmed' OR (${alias}.state='provisional' AND ${alias}.expires_at>${now}))))`;
}
export type WorkflowReceipt = {
  id: string;
  logicalBookingId: string;
  revision: number;
  workflowRevision: number;
  eventId: string;
  state: WorkflowState;
  policyVersion: string;
};
