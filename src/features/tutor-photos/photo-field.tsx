"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { nameInitials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import { tutorPhotoUrl } from "./photo-url";

const maxBytes = 5 * 1024 * 1024;
const accepted = ["image/jpeg", "image/png", "image/webp"];

/**
 * The tutor's own photo control on Account settings. Uploads wait for an
 * admin's approval before families see them; until then the current photo or
 * the initials stay public.
 */
export function TutorPhotoField({
  name,
  approvedId,
  pendingId,
  rejected,
  available,
}: {
  name: string;
  approvedId: string | null;
  pendingId: string | null;
  rejected: boolean;
  /** False where photo storage is not set up; uploads are then refused. */
  available: boolean;
}) {
  const ready = useHydrated();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [message, setMessage] = useState<{ text: string; failed: boolean }>();
  const shown = pendingId ?? approvedId;
  const note = !available
    ? "Photo uploads aren't available here yet. Families see your initials."
    : pendingId
      ? `Waiting for an admin to approve it. Until then, families see ${approvedId ? "your current photo" : "your initials"}.`
      : rejected
        ? "Your last photo wasn't approved. Choose a different, clear photo of your face."
        : approvedId
          ? "Families see this photo on your public profile."
          : "Add a clear photo of your face. Families see it on your public profile after an admin approves it.";

  async function send(method: "PUT" | "DELETE", body?: FormData) {
    setBusy(method === "PUT" ? "upload" : "remove");
    setMessage(undefined);
    try {
      const response = await fetch("/api/tutor/photo", { method, body });
      const result = (await response.json().catch(() => ({}))) as {
        message?: unknown;
      };
      if (!response.ok)
        return setMessage({
          failed: true,
          text:
            typeof result.message === "string"
              ? result.message
              : "Your photo could not be saved. Try again.",
        });
      setMessage({
        failed: false,
        text:
          method === "PUT"
            ? "Photo uploaded. It shows on your profile after an admin approves it."
            : "Photo removed. Families see your initials.",
      });
      router.refresh();
    } catch {
      setMessage({
        failed: true,
        text: "The photo service could not be reached. Try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!accepted.includes(file.type))
      return setMessage({
        failed: true,
        text: "Choose a JPG, PNG or WebP photo.",
      });
    if (file.size > maxBytes)
      return setMessage({ failed: true, text: "Choose a photo under 5 MB." });
    const body = new FormData();
    body.append("photo", file);
    void send("PUT", body);
  }

  return (
    <div className="account-photo">
      <span className="account-photo-preview" aria-hidden="true">
        {shown ? (
          <Image
            src={tutorPhotoUrl(shown)}
            alt=""
            width={72}
            height={72}
            unoptimized
          />
        ) : (
          nameInitials(name) || "?"
        )}
      </span>
      <div className="account-photo-body">
        <p className="account-photo-title" id="profile-photo-title">
          Profile photo
          {pendingId && (
            <span className="account-photo-pending">Pending review</span>
          )}
        </p>
        <p className="account-photo-note" id="profile-photo-note">
          {note}
          {available && " JPG, PNG or WebP, up to 5 MB."}
        </p>
        {available && (
          <div className="account-photo-actions">
            <input
              ref={input}
              type="file"
              accept={accepted.join(",")}
              hidden
              aria-labelledby="profile-photo-title"
              onChange={choose}
            />
            <button
              type="button"
              className="action action-outline"
              aria-describedby="profile-photo-note"
              disabled={!ready || busy !== null}
              onClick={() => input.current?.click()}
            >
              {busy === "upload"
                ? "Uploading…"
                : shown
                  ? "Change photo"
                  : "Upload photo"}
            </button>
            {shown && (
              <button
                type="button"
                className="action action-outline"
                disabled={!ready || busy !== null}
                onClick={() => void send("DELETE")}
              >
                {busy === "remove" ? "Removing…" : "Remove photo"}
              </button>
            )}
          </div>
        )}
        <p
          aria-live="polite"
          className={cn(
            "account-photo-message",
            message?.failed && "text-error",
          )}
        >
          {message?.text}
        </p>
      </div>
    </div>
  );
}
