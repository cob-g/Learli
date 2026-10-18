import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import {
  DraftPolicyPage,
  draftPolicyMetadata,
} from "@/features/policies/draft-policy-page";
import { getDomainAuthRuntime } from "@/lib/auth";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";

export const metadata = draftPolicyMetadata("cancellations");

export default async function CancellationsPage() {
  const runtime = await getDomainAuthRuntime();
  const localWorkflow = !!runtime && getLocalWorkflow(runtime) !== null;
  const privateWorkflow = !!runtime && hasPersistentWorkflow(runtime);
  return (
    <DraftPolicyPage
      policy="cancellations"
      privateWorkflow={privateWorkflow}
      localWorkflow={localWorkflow}
    />
  );
}
