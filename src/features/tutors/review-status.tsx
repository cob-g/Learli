import { Ban, CircleCheck, Hourglass } from "lucide-react";
import type { ReviewStatus } from "@/lib/db/schema/app";
import { cn } from "@/lib/utils";
import { reviewStatusLabels } from "./review-rules";

const tones = {
  pending: {
    Icon: Hourglass,
    box: "border-foreground bg-subtle text-foreground",
    icon: "text-primary",
  },
  approved: {
    Icon: CircleCheck,
    box: "border-success bg-success-soft text-success",
    icon: "",
  },
  rejected: {
    Icon: Ban,
    box: "border-muted-foreground bg-subtle text-muted-foreground",
    icon: "",
  },
  suspended: {
    Icon: Ban,
    box: "border-muted-foreground bg-subtle text-muted-foreground",
    icon: "",
  },
} as const;

/** A tutor's review state as text, icon and tone. The text alone is sufficient. */
export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const { Icon, box, icon } = tones[status];
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1 rounded-tag border px-2 text-label",
        box,
      )}
    >
      <Icon size={16} aria-hidden="true" className={icon} />
      {reviewStatusLabels[status]}
    </span>
  );
}
