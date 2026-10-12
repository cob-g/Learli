import {
  DraftPolicyPage,
  draftPolicyMetadata,
} from "@/features/policies/draft-policy-page";

export const metadata = draftPolicyMetadata("terms");

export default function TermsPage() {
  return <DraftPolicyPage policy="terms" />;
}
