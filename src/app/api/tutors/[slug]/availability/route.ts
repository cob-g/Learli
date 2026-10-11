import { getAuthRuntime } from "@/lib/auth";
import { handlePublicCandidateRead } from "@/features/public-availability/handler";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return handlePublicCandidateRead(
    getAuthRuntime(),
    request,
    (await params).slug,
  );
}
