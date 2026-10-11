import type { Metadata } from "next";
import { SupportEntry } from "@/features/support/entry";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Contact support",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string | string[] }>;
}) {
  const { bookingId } = await searchParams;
  return (
    <SupportEntry
      bookingId={Array.isArray(bookingId) ? "invalid" : bookingId}
    />
  );
}
