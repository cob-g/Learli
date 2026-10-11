import { getAuthRuntime } from "@/lib/auth";
import { handleDemoCandidateRead } from "@/features/bookings/handler";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return handleDemoCandidateRead(getAuthRuntime(), request);
}
