import type { ReactNode } from "react";
import { LearnerLink } from "@/features/learners/learner-link";
export function AdmissionEntry({
  privateWorkflow = false,
  localWorkflow = false,
  className = "me-6 mt-8 inline-flex min-h-11 items-center",
  leading,
  trailing,
}: {
  privateWorkflow?: boolean;
  localWorkflow?: boolean;
  className?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <LearnerLink
      href="/learner-admission"
      className={className}
      leading={leading}
      trailing={trailing}
      label={
        localWorkflow
          ? "Earlier learner review records"
          : privateWorkflow
            ? "Learner requests and review status"
            : "Learner admission requests"
      }
    />
  );
}
export function AdmissionReviewEntry({
  localWorkflow = false,
  className = "inline-flex min-h-11 items-center",
}: {
  localWorkflow?: boolean;
  className?: string;
}) {
  return (
    <LearnerLink
      href="/admin/learner-admission"
      className={className}
      label={
        localWorkflow
          ? "Assigned learner review records"
          : "Assigned learner admission reviews"
      }
    />
  );
}
