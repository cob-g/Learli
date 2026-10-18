import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listParticipantBookings } from "@/features/bookings/read-service";
import {
  BookingHistoryView,
  BookingUnavailable,
} from "@/features/bookings/read-presentation";
import { bookingReadScope } from "@/features/bookings/read-input";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your bookings",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const scope = bookingReadScope.safeParse(params.scope ?? "student");
  const input = Object.fromEntries(
    Object.entries(params).filter(
      ([key, value]) =>
        value !== undefined &&
        !(
          scope.success &&
          scope.data === "guardian" &&
          key === "learnerId" &&
          value === ""
        ),
    ),
  );
  const path = `/bookings?${new URLSearchParams(Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === "string"))}`;
  const loaded = await loadPrivatePage(path, async (runtime, headers) => ({
    result: await listParticipantBookings(runtime, headers, {
      scope: "student",
      ...input,
    }),
    privateWorkflow: hasPersistentWorkflow(runtime),
  }));
  const result = loaded?.result;
  if (!result)
    return (
      <BookingUnavailable scope={scope.success ? scope.data : undefined} />
    );
  return (
    <BookingHistoryView
      result={result}
      privateWorkflow={loaded?.privateWorkflow}
      learnerId={
        typeof params.learnerId === "string" ? params.learnerId : undefined
      }
    />
  );
}
