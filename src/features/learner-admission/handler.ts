import { ZodError } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson, sameDomainOrigin } from "@/lib/auth-handler";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { AccessError } from "@/lib/permissions/access";
import { describeLearnerIssues } from "@/features/learners/input";
import { admissionContext } from "./context";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { RuleError } from "@/lib/rule-error";
import { admissionInput } from "./input";
import {
  createAdmission,
  listMyAdmissions,
  readMyAdmission,
  listAssignedAdmissions,
  readAssignedAdmission,
  mutateAdmissionReview,
  readAdmissionIntake,
  type AdmissionContext,
} from "./service";
export async function handleAdmissionRequest(
  runtime: AuthRuntime | null,
  request: Request,
  id?: string,
  review?: "evidence" | "decision" | "revoke-evidence" | "read",
  context?: AdmissionContext,
) {
  if (!runtime)
    return privateJson({ message: "Admission is unavailable." }, 503);
  const active = context ?? admissionContext(runtime);
  if (!sameDomainOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method === "POST") {
    // This runs BEFORE readSmallJson. Disabled intake never deserializes child data.
    if (!review) {
      try {
        if (!(await readAdmissionIntake(active, request.headers)).enabled)
          return privateJson(
            { message: "Admission intake is unavailable." },
            503,
          );
      } catch (error) {
        return privateJson(
          { message: "Admission intake is unavailable." },
          error instanceof AccessError ? error.status : 503,
        );
      }
    }
    return handleJsonMutation(
      runtime,
      request,
      { method: "POST", invalid: describeLearnerIssues },
      (_runtime, input) => {
        if (review && id && review !== "read")
          return mutateAdmissionReview(
            active,
            request.headers,
            id,
            review,
            input,
          );
        const value = admissionInput.parse(input);
        if (getLocalWorkflow(runtime))
          throw new RuleError(
            409,
            value.management === "guardian"
              ? "Use Add Child to create a new private child profile with your guardian confirmation and consent."
              : "Set up your Student profile at /student/onboarding to confirm your independent eligibility and continue.",
          );
        return createAdmission(active, request.headers, value);
      },
    );
  }
  if (request.method !== "GET")
    return privateJson({ message: "Method not allowed." }, 405);
  try {
    return privateJson(
      review
        ? id
          ? await readAssignedAdmission(active, request.headers, id)
          : await listAssignedAdmissions(
              active,
              request.headers,
              new URL(request.url).searchParams.getAll("after").length > 1
                ? []
                : new URL(request.url).searchParams.get("after"),
            )
        : id
          ? await readMyAdmission(active, request.headers, id)
          : await listMyAdmissions(
              active,
              request.headers,
              new URL(request.url).searchParams.getAll("after").length > 1
                ? []
                : new URL(request.url).searchParams.get("after"),
            ),
    );
  } catch (error) {
    if (error instanceof ZodError)
      return privateJson(
        { message: "This admission list request could not be used." },
        400,
      );
    return privateJson(
      { message: "Admission is unavailable." },
      error instanceof AccessError ? error.status : 503,
    );
  }
}
