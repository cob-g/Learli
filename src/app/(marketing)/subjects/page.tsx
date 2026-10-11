import type { Metadata } from "next";
import { UnavailablePage } from "@/components/shared/unavailable-page";

export const metadata: Metadata = { title: "Subjects" };
export default function Page() {
  return (
    <UnavailablePage
      title={"Subjects are coming"}
      message={
        "Subjects will appear here when tutors offering them are listed."
      }
    />
  );
}
