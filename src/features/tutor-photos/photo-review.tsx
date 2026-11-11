"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { tutorPhotoUrl } from "./photo-url";

/** Admin review of the photo a tutor is waiting on, beside the public one. */
export function PhotoReview({
  profileId,
  tutorName,
  pendingId,
  approvedId,
  ownedByReviewer,
}: {
  profileId: string;
  tutorName: string;
  pendingId: string | null;
  approvedId: string | null;
  ownedByReviewer: boolean;
}) {
  const router = useRouter();
  const result = useRef<HTMLParagraphElement>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; failed: boolean }>();

  async function review(action: "approve" | "reject") {
    if (!pendingId) return;
    setPending(true);
    setNotice(undefined);
    try {
      const response = await fetch(
        `/api/admin/tutor-applications/${encodeURIComponent(profileId)}/photo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId: pendingId, action }),
        },
      );
      const body: { message?: string } = await response
        .json()
        .catch(() => ({}));
      setNotice(
        response.ok
          ? {
              text:
                action === "approve"
                  ? "Photo approved. It now shows on the tutor's public profile."
                  : "Photo rejected. The tutor can upload a different one.",
              failed: false,
            }
          : {
              text: body.message ?? "The photo wasn't changed. Try again.",
              failed: true,
            },
      );
      // Also after a refusal: the photo may have changed underneath us.
      router.refresh();
    } catch {
      setNotice({
        text: "We couldn't reach Learli. Check your connection, then try again.",
        failed: true,
      });
    } finally {
      setPending(false);
      requestAnimationFrame(() => result.current?.focus());
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap gap-6">
        {pendingId && (
          <figure className="flex flex-col items-start gap-2">
            <Image
              src={tutorPhotoUrl(pendingId)}
              alt={`Photo ${tutorName} submitted for review`}
              width={160}
              height={160}
              unoptimized
              className="size-40 rounded-full border border-border object-cover"
            />
            <figcaption className="text-small text-muted-foreground">
              Waiting for review
            </figcaption>
          </figure>
        )}
        {approvedId && (
          <figure className="flex flex-col items-start gap-2">
            <Image
              src={tutorPhotoUrl(approvedId)}
              alt={`${tutorName}'s current public photo`}
              width={160}
              height={160}
              unoptimized
              className="size-40 rounded-full border border-border object-cover"
            />
            <figcaption className="text-small text-muted-foreground">
              Public now
            </figcaption>
          </figure>
        )}
      </div>
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
      {pendingId &&
        (ownedByReviewer ? (
          <p className="max-w-prose text-body">
            You can&apos;t review your own photo. Another admin must review it.
          </p>
        ) : (
          <>
            <p className="max-w-prose text-small text-muted-foreground">
              Approve only a clear, appropriate photo of the tutor. Rejecting
              deletes it; the tutor sees that it wasn&apos;t approved.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                className="action action-primary"
                disabled={pending}
                onClick={() => void review("approve")}
              >
                Approve photo
              </button>
              <button
                type="button"
                className="action action-outline"
                disabled={pending}
                onClick={() => void review("reject")}
              >
                Reject photo
              </button>
            </div>
          </>
        ))}
    </div>
  );
}
