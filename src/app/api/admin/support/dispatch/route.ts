import { getDomainAuthRuntime } from "@/lib/auth";
import { handleDispatchRequest } from "@/features/support/dispatch-handler";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handleDispatchRequest(await getDomainAuthRuntime(), request);
}
