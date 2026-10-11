import type { Metadata } from "next";
import { FamilyDashboardPage } from "@/features/family-dashboard/page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your bookings",
  robots: { index: false, follow: false },
};
export default async function StudentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return await FamilyDashboardPage({ workspace: "student", searchParams });
}
