import {
  DraftPolicyPage,
  draftPolicyMetadata,
} from "@/features/policies/draft-policy-page";

export const metadata = draftPolicyMetadata("privacy");

export default function PrivacyPage() {
  return <DraftPolicyPage policy="privacy" />;
}
