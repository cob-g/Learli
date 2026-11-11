import { getDomainAuthRuntime } from "@/lib/auth";
import { privateJson } from "@/lib/auth-handler";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { reviewTutorPhoto } from "@/features/tutors/review";
import { photoStorage } from "@/features/tutor-photos/configured";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  try {
    const { profileId } = await context.params;
    return await handleJsonMutation(
      await getDomainAuthRuntime(),
      request,
      {
        method: "POST",
        invalid: () => ({ message: "Check your request and try again." }),
      },
      (active, input) =>
        reviewTutorPhoto(
          active,
          request.headers,
          profileId,
          input,
          photoStorage(),
        ),
    );
  } catch {
    return privateJson(
      { message: "This service is unavailable. Try again later." },
      503,
    );
  }
}
