import { LearnerLink } from "@/features/learners/learner-link";
export function AdmissionEntry({
  privateWorkflow = false,
}: {
  privateWorkflow?: boolean;
}) {
  return (
    <LearnerLink
      href="/learner-admission"
      className="me-6 mt-8 inline-flex min-h-11 items-center"
      label={
        privateWorkflow
          ? "Learner requests and review status"
          : "Learner admission requests"
      }
    />
  );
}
export function AdmissionReviewEntry() {
  return (
    <LearnerLink
      href="/admin/learner-admission"
      className="inline-flex min-h-11 items-center"
      label="Assigned learner admission reviews"
    />
  );
}
