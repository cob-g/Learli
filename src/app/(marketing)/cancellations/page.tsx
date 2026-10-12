import {
  DraftPolicyPage,
  draftPolicyMetadata,
} from "@/features/policies/draft-policy-page";

export const metadata = draftPolicyMetadata("cancellations");

export default function CancellationsPage() {
  return <DraftPolicyPage policy="cancellations" />;
}
