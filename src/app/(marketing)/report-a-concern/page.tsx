import type { Metadata } from "next";
import { SupportEntry } from "@/features/support/entry";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Report a concern",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <SupportEntry concern />;
}
