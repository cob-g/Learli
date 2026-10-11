"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { ReviewStatus } from "@/lib/db/schema/app";
import { cn } from "@/lib/utils";
import { reviewActionsFrom, type ReviewAction } from "./review-rules";

const copy: Record<
  ReviewAction,
  {
    button: string;
    title: string;
    body: (name: string) => string;
    dismiss: string;
    done: string;
    destructive: boolean;
  }
> = {
  approve: {
    button: "Approve application",
    title: "Approve this application?",
    body: (name) =>
      `${name} will be marked as approved. Tutor listings are not available yet, so nothing becomes public.`,
    dismiss: "Keep pending",
    done: "Application approved.",
    destructive: false,
  },
  reject: {
    button: "Reject application",
    title: "Reject this application?",
    body: (name) =>
      `${name} will be marked as not approved. They can edit the profile and submit it again.`,
    dismiss: "Keep pending",
    done: "Application rejected.",
    destructive: true,
  },
  suspend: {
    button: "Suspend tutor",
    title: "Suspend this tutor?",
    body: (name) =>
      `${name} will be marked as suspended and will no longer be able to edit this profile.`,
    dismiss: "Keep approved",
    done: "Tutor suspended.",
    destructive: true,
  },
  reinstate: {
    button: "Reinstate tutor",
    title: "Reinstate this tutor?",
    body: (name) => `${name} will be marked as approved again.`,
    dismiss: "Keep suspended",
    done: "Tutor reinstated.",
    destructive: false,
  },
  reopen: {
    button: "Reopen application",
    title: "Reopen this application?",
    body: (name) => `${name}'s application will return to pending review.`,
    dismiss: "Keep rejected",
    done: "Application reopened.",
    destructive: false,
  },
};

export function ReviewActions({
  profileId,
  tutorName,
  status,
}: {
  profileId: string;
  tutorName: string;
  status: ReviewStatus;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const result = useRef<HTMLParagraphElement>(null);
  const [action, setAction] = useState<ReviewAction>();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; failed: boolean }>();
  const selected = action && copy[action];

  async function confirm() {
    if (!action) return;
    setPending(true);
    try {
      const response = await fetch(
        `/api/admin/tutor-applications/${encodeURIComponent(profileId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (response.ok) setNotice({ text: copy[action].done, failed: false });
      else {
        const body: { message?: string } = await response
          .json()
          .catch(() => ({}));
        setNotice({
          text: body.message ?? "The application wasn't changed. Try again.",
          failed: true,
        });
      }
      // Also after a refusal: the stored status may have moved underneath us.
      router.refresh();
    } catch {
      setNotice({
        text: "We couldn't reach Learli. Check your connection, then try again.",
        failed: true,
      });
    } finally {
      setPending(false);
      dialog.current?.close();
      // The trigger may no longer exist once the status changes.
      requestAnimationFrame(() => result.current?.focus());
    }
  }

  return (
    <>
      {notice && (
        <p
          ref={result}
          tabIndex={-1}
          role={notice.failed ? "alert" : "status"}
          className={notice.failed ? "text-body text-error" : "text-body"}
        >
          {notice.text}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-4">
        {reviewActionsFrom(status).map((name, index) => (
          <button
            key={name}
            type="button"
            className={cn(
              "action",
              index === 0 ? "action-primary" : "action-outline",
            )}
            onClick={() => {
              setAction(name);
              setNotice(undefined);
              dialog.current?.showModal();
            }}
          >
            {copy[name].button}
          </button>
        ))}
      </div>
      <ConfirmDialog
        ref={dialog}
        title={selected?.title ?? ""}
        confirmLabel={selected?.button ?? ""}
        dismissLabel={selected?.dismiss ?? ""}
        destructive={selected?.destructive}
        pending={pending}
        onConfirm={confirm}
      >
        <p>{selected?.body(tutorName)}</p>
      </ConfirmDialog>
    </>
  );
}
