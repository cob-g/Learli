import { getDomainAuthRuntime } from "@/lib/auth";
import { handleIndependentLearnerRequest } from "@/features/independent-learner/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleIndependentLearnerRequest(await getDomainAuthRuntime(), request);
}
