import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "Find a tutor" };

export default function TutorsPage() {
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Find a tutor</h1>
      <div className="mt-8">
        <EmptyState
          title="No tutors are listed right now"
          href="/become-a-tutor"
          action="Become a tutor"
        >
          <p>
            Learli is preparing to welcome tutors. Booking is not available yet.
          </p>
        </EmptyState>
      </div>
    </div>
  );
}
