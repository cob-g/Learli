import { getDomainAuthRuntime } from "@/lib/auth";
import { handleAdmissionRequest } from "@/features/learner-admission/handler";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handleAdmissionRequest(
    await getDomainAuthRuntime(),
    request,
    undefined,
    "read",
  );
}
