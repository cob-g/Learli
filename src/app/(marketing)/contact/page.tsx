import { SupportEntry } from "@/features/support/entry";
import { publicPageMetadata } from "@/lib/seo/metadata";
export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata({
  title: "Contact support",
  path: "/contact",
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
      bookingId={Array.isArray(bookingId) ? "invalid" : bookingId}
    />
  );
}
