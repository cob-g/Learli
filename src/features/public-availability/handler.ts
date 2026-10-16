import { ZodError } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson, sameDomainOrigin } from "@/lib/auth-handler";
import { RuleError } from "@/lib/rule-error";
import { PUBLIC_CANDIDATE_LIMITS } from "./input";
import { readPublicCandidates, PublicAvailabilityUnavailable } from "./service";

export async function handlePublicCandidateRead(
  runtime: AuthRuntime | null,
  request: Request,
  tutorSlug: string,
) {
  if (!runtime)
    return privateJson(
      { message: "Local simulated open times are unavailable." },
      503,
    );
  if (!sameDomainOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "GET")
    return privateJson({ message: "Method not allowed." }, 405);
  try {
    const params = new URL(request.url).searchParams;
    if (
      params.toString().length > PUBLIC_CANDIDATE_LIMITS.queryCharacters ||
      [...params.keys()].some(
        (key) =>
          params.getAll(key).length !== 1 ||
          !["subjectSlug", "level", "displayTimezone", "from", "to"].includes(
            key,
          ),
      )
    )
      throw new RuleError(400, "Choose the subject, level and time zone once.");
    return privateJson(
      await readPublicCandidates(runtime, {
        ...Object.fromEntries(params),
        tutorSlugs: [tutorSlug],
      }),
    );
  } catch (error) {
    if (
      error instanceof RuleError ||
      error instanceof PublicAvailabilityUnavailable
    )
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError)
      return privateJson(
        {
          message:
            "Choose a subject, level and valid time zone to load open times.",
        },
        400,
      );
    return privateJson(
      { message: "Open times could not be loaded. Try again later." },
      503,
    );
  }
}
