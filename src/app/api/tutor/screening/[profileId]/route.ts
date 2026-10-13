import { getAuthRuntime } from "@/lib/auth";
import { handleScreeningMutation } from "@/features/tutor-screening/handler";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  return handleScreeningMutation(
    getAuthRuntime(),
    request,
    (await params).profileId,
    "request",
  );
}
