import { getDomainAuthRuntime } from "@/lib/auth";
import { handleLearnerRequest } from "@/features/learners/handler";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ learnerId: string }> };
export async function GET(request: Request, context: Context) {
  return handleLearnerRequest(
    await getDomainAuthRuntime(),
    request,
    (await context.params).learnerId,
  );
}
export async function PATCH(request: Request, context: Context) {
  return handleLearnerRequest(
    await getDomainAuthRuntime(),
    request,
    (await context.params).learnerId,
  );
}
