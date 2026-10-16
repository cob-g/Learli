import { getDomainAuthRuntime } from "@/lib/auth";
import { handleSupportRequest } from "@/features/support/handler";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  return handleSupportRequest(
    await getDomainAuthRuntime(),
    request,
    "requester",
    (await context.params).caseId,
  );
}
