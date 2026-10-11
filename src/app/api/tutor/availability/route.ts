import { getAuthRuntime } from "@/lib/auth";
import { privateJson } from "@/lib/auth-handler";
import {
  handleAvailabilityRead,
  handleAvailabilitySave,
} from "@/features/availability/handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return await handleAvailabilityRead(getAuthRuntime(), request);
  } catch {
    return privateJson(
      { message: "This service is unavailable. Try again later." },
      503,
    );
  }
}
export async function PUT(request: Request) {
  try {
    return await handleAvailabilitySave(getAuthRuntime(), request);
  } catch {
    return privateJson(
      { message: "This service is unavailable. Try again later." },
      503,
    );
  }
}
