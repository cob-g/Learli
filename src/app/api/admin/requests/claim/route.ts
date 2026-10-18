import { getDomainAuthRuntime } from "@/lib/auth";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { claimLocalReview } from "@/features/local-workflow/review-service";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleJsonMutation(
    await getDomainAuthRuntime(),
    request,
    {
      method: "POST",
      invalid: () => ({ message: "Choose a current request and try again." }),
    },
    (runtime, input) => claimLocalReview(runtime, request.headers, input),
  );
}
