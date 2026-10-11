import { getAuthRuntime } from "@/lib/auth";
import { handleSupportRequest } from "@/features/support/handler";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  return handleSupportRequest(
    getAuthRuntime(),
    request,
    "requester",
    (await context.params).caseId,
  );
}
