import { getAuthRuntime } from "@/lib/auth";
import { handleAdmissionRequest } from "@/features/learner-admission/handler";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handleAdmissionRequest(getAuthRuntime(), request, undefined);
}
export async function POST(request: Request) {
  return handleAdmissionRequest(getAuthRuntime(), request);
}
