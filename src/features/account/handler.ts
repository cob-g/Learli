import { ZodError } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import {
  privateJson,
  readSmallJson,
  sameLocalOrigin,
} from "@/lib/auth-handler";
import { AccessError } from "@/lib/permissions/access";
import { readAccount, updateAccount } from "./service";

export async function handleAccountRequest(
  runtime: AuthRuntime | null,
  request: Request,
  userId: string,
) {
  if (!runtime)
    return privateJson({ message: "Account service is unavailable." }, 503);
  if (!sameLocalOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  try {
    if (request.method === "GET")
      return privateJson(await readAccount(runtime, request.headers, userId));
    if (request.method !== "PATCH")
      return privateJson({ message: "Method not allowed." }, 405);
    let input: unknown;
    try {
      input = (await readSmallJson(request)).body;
    } catch {
      return privateJson({ message: "Check the account fields." }, 400);
    }
    return privateJson(
      await updateAccount(runtime, request.headers, userId, input),
    );
  } catch (error) {
    if (error instanceof AccessError)
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError)
      return privateJson(
        {
          message:
            "Enter a display name and a valid IANA time zone. Other fields cannot be changed here.",
        },
        400,
      );
    return privateJson(
      { message: "Account service is unavailable. Try again later." },
      503,
    );
  }
}
