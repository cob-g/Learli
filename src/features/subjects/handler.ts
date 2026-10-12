import type { AuthRuntime } from "@/lib/auth-factory";
import { handleJsonMutation } from "@/lib/mutation-handler";
import {
  createSpecializedSubject,
  renameSpecializedSubject,
  setSubjectActive,
} from "./service";
import { subjectNameHelp } from "./input";

export function handleSubjectRenameRequest(
  runtime: AuthRuntime | null,
  request: Request,
  subjectId: string,
) {
  return handleJsonMutation(
    runtime,
    request,
    {
      method: "PATCH",
      bodyLimit: 1024,
      invalid: () => ({ message: subjectNameHelp }),
    },
    (active, input) =>
      renameSpecializedSubject(active, request.headers, subjectId, input),
  );
}

export function handleSubjectCreateRequest(
  runtime: AuthRuntime | null,
  request: Request,
) {
  return handleJsonMutation(
    runtime,
    request,
    {
      method: "POST",
      invalid: () => ({
        message:
          "Enter a subject name of 2 to 60 characters that starts with a letter or number.",
      }),
    },
    (active, input) => createSpecializedSubject(active, request.headers, input),
  );
}

export function handleSubjectStateRequest(
  runtime: AuthRuntime | null,
  request: Request,
  subjectId: string,
) {
  return handleJsonMutation(
    runtime,
    request,
    {
      method: "PATCH",
      invalid: () => ({ message: "Check your request and try again." }),
    },
    (active, input) =>
      setSubjectActive(active, request.headers, subjectId, input),
  );
}
