import { LearnerLink } from "@/features/learners/learner-link";
export function AdmissionEntry() {
  return (
    <LearnerLink
      href="/learner-admission"
      className="me-6 mt-8 inline-flex min-h-11 items-center"
      label="Learner admission requests"
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
