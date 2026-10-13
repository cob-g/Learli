"use client";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export default function ErrorPage() {
  return (
    <UnavailablePage
      title="Admission unavailable"
      message="This request could not be opened. Reload its current status or return to your account."
    />
  );
}
