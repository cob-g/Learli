import type { Metadata } from "next";
import Link from "next/link";
import { StartApplication } from "@/features/tutors/start-application";

export const metadata: Metadata = { title: "Become a tutor" };
export default function Page() {
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Become a tutor</h1>
      <p className="mt-4 max-w-prose text-prose">
        Tutors on Learli teach one-to-one lessons on their own Zoom or Google
        Meet account. You decide how you teach and what materials you use.
      </p>
      <h2 className="mt-8 text-item-title">How applying works</h2>
      <ol className="mt-2 max-w-prose list-decimal space-y-2 ps-6 text-prose">
        <li>Sign in and start a tutor application.</li>
        <li>
          Describe how you teach and choose your subjects and learner levels.
        </li>
        <li>Learli reviews your application before your profile is public.</li>
      </ol>
      <p className="mt-4 max-w-prose text-body text-muted-foreground">
        Tutor listings and booking are not available yet. You will need to{" "}
        <Link href="/sign-in?next=%2Fbecome-a-tutor">sign in</Link> first.
      </p>
      <StartApplication />
    </div>
  );
}
