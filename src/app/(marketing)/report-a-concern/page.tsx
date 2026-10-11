import type { Metadata } from "next";
import { UnavailablePage } from "@/components/shared/unavailable-page";

export const metadata: Metadata = { title: "Report a concern" };
export default function Page() {
  return (
    <UnavailablePage
      title={"Reporting is not open yet"}
      message={
        "Learli is not accepting accounts or bookings. A reporting channel must be available before people can use the service."
      }
    />
  );
}
