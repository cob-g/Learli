import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import {
  DraftPolicyPage,
  draftPolicyMetadata,
} from "@/features/policies/draft-policy-page";
import { getDomainAuthRuntime } from "@/lib/auth";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";

export const metadata = draftPolicyMetadata("terms");

export default async function TermsPage() {
  const runtime = await getDomainAuthRuntime();
  const localWorkflow = !!runtime && getLocalWorkflow(runtime) !== null;
  const privateWorkflow = !!runtime && hasPersistentWorkflow(runtime);
  return (
    <DraftPolicyPage
      policy="terms"
      privateWorkflow={privateWorkflow}
      localWorkflow={localWorkflow}
    />
  );
}
