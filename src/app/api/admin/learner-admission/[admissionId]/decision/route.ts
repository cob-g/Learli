import { getDomainAuthRuntime } from "@/lib/auth";
import { handleAdmissionRequest } from "@/features/learner-admission/handler";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ admissionId: string }> },
) {
  return handleAdmissionRequest(
    await getDomainAuthRuntime(),
    request,
    (await params).admissionId,
    "decision",
  );
}
