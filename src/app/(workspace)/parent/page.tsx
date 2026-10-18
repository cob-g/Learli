import type { Metadata } from "next";
import { FamilyDashboardPage } from "@/features/family-dashboard/page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Parent Dashboard",
  robots: { index: false, follow: false },
};
export default async function ParentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return await FamilyDashboardPage({ workspace: "parent", searchParams });
}
