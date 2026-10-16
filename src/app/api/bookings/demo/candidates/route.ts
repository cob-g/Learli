import { getDomainAuthRuntime } from "@/lib/auth";
import { handleDemoCandidateRead } from "@/features/bookings/handler";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handleDemoCandidateRead(await getDomainAuthRuntime(), request);
}
