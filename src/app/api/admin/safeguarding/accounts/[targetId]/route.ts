import { getAuthRuntime } from "@/lib/auth";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { privateJson } from "@/lib/auth-handler";
import { getSafeguardingContext } from "@/features/safeguarding/composition";
import { changeSafetyRestriction } from "@/features/safeguarding/service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ targetId: string }> },
) {
  const runtime = getAuthRuntime();
  if (
    runtime &&
    getSafeguardingContext(runtime).safeguarding.mode === "disabled"
  )
    return privateJson(
      { message: "Account safety actions are disabled." },
      503,
    );
  const { targetId } = await params;
  return handleJsonMutation(
    runtime,
    request,
    {
      method: "POST",
      invalid: () => ({ message: "Check the account action fields." }),
    },
    (active, input) =>
      changeSafetyRestriction(
        getSafeguardingContext(active),
        request.headers,
        targetId,
        input,
      ),
  );
}
