import { getDomainAuthRuntime } from "@/lib/auth";
import { handleScreeningMutation } from "@/features/tutor-screening/handler";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  return handleScreeningMutation(
    await getDomainAuthRuntime(),
    request,
    (await params).profileId,
    "checks",
  );
}
