import { getDomainAuthRuntime } from "@/lib/auth";
import { handleLearnerRequest } from "@/features/learners/handler";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handleLearnerRequest(await getDomainAuthRuntime(), request);
}
export async function POST(request: Request) {
  return handleLearnerRequest(await getDomainAuthRuntime(), request);
}
