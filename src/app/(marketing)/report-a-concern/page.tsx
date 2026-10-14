import { SupportEntry } from "@/features/support/entry";
import { publicPageMetadata } from "@/lib/seo/metadata";
export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata({
  title: "Report a concern",
  path: "/report-a-concern",
  index: false,
});
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string | string[] }>;
}) {
  const { bookingId } = await searchParams;
  return (
    <SupportEntry
      concern
      bookingId={Array.isArray(bookingId) ? "invalid" : bookingId}
    />
  );
}
