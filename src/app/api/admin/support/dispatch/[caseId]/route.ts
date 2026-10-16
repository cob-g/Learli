import { getDomainAuthRuntime } from "@/lib/auth";
import { handleDispatchRequest } from "@/features/support/dispatch-handler";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ caseId: string }> };
export async function GET(request: Request, context: Context) {
  return handleDispatchRequest(
    await getDomainAuthRuntime(),
    request,
    (await context.params).caseId,
  );
}
export async function PATCH(request: Request, context: Context) {
  return handleDispatchRequest(
    await getDomainAuthRuntime(),
    request,
    (await context.params).caseId,
  );
}
