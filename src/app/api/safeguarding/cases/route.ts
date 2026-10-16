import { getDomainAuthRuntime } from "@/lib/auth";
import { handleSafeguarding } from "@/features/safeguarding/handler";
export async function POST(request: Request) {
  return handleSafeguarding(await getDomainAuthRuntime(), request);
}
