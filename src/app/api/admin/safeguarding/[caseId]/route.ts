import { getAuthRuntime } from "@/lib/auth";
import { handleSafeguarding } from "@/features/safeguarding/handler";
async function handle(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  return handleSafeguarding(getAuthRuntime(), request, (await params).caseId);
}
export { handle as POST, handle as GET };
