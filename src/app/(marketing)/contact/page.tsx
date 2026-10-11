import type { Metadata } from "next";
import { UnavailablePage } from "@/components/shared/unavailable-page";

export const metadata: Metadata = { title: "Contact support" };
export default function Page() {
  return (
    <UnavailablePage
      title={"Support is not open yet"}
      message={
        "Learli is not accepting bookings or support requests through this site yet."
      }
    />
  );
}
