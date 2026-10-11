import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "Get matched" };

export default function MatchingPage() {
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Get matched</h1>
      <div className="mt-8">
        <EmptyState
          title="No tutors are listed right now"
          href="/tutors"
          action="Browse tutors"
        >
          <p>
            Matching will be available when tutors are listed. You do not need
            to share any learner details yet.
          </p>
        </EmptyState>
      </div>
    </div>
  );
}
