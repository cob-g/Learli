import type { Metadata } from "next";
import { UnavailablePage } from "@/components/shared/unavailable-page";

export const metadata: Metadata = { title: "Become a tutor" };
export default function Page() {
  return (
    <UnavailablePage
      title={"Tutor applications are not open yet"}
      message={
        "Learli is preparing its tutor application process. There is no application form to complete yet."
      }
    />
  );
}
