import { getAccountAuthRuntime } from "@/lib/auth";
import { privateJson } from "@/lib/auth-handler";
import { handleParentOnboarding } from "@/features/parent-onboarding/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return await handleParentOnboarding(await getAccountAuthRuntime(), request);
  } catch {
    return privateJson({ message: "Account service is unavailable." }, 503);
  }
}
