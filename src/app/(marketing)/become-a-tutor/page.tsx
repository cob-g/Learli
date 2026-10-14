import Link from "next/link";
import { StartApplication } from "@/features/tutors/start-application";
import { BecomeATutorGuide } from "@/features/home/page-guides";
import { publicPageMetadata } from "@/lib/seo/metadata";
import "../home.css";

export const metadata = publicPageMetadata({
  title: "Become a tutor",
  description:
    "Teach one-to-one lessons on your own Zoom or Google Meet account. You decide how you teach, and Learli reviews each application before a profile is public.",
  path: "/become-a-tutor",
});
export default function Page() {
  return (
    <>
      <Application />
      <BecomeATutorGuide />
    </>
  );
}

function Application() {
  return (
    <div className="page-shell page-space">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div>
          <h1 className="text-headline">Become a tutor</h1>
          <p className="mt-6 max-w-prose font-reading text-reading">
            Tutors on Learli teach one-to-one lessons on their own Zoom or
            Google Meet account. You decide how you teach and what materials you
            use.
          </p>
          <p className="mt-6 max-w-prose text-body text-muted-foreground">
            This development preview lets you prepare a tutor application. Live
            lesson terms are not set. You will need to{" "}
            <Link href="/sign-in?next=%2Fbecome-a-tutor">sign in</Link> first.
          </p>
          <StartApplication />
        </div>
        <section className="rounded-surface border border-border bg-surface p-6 wrap-anywhere md:p-8">
          <h2 className="text-section-title">How applying works</h2>
          <ol className="mt-6 list-decimal space-y-6 ps-6 text-body">
            <li>Sign in and start a tutor application.</li>
            <li>
              Describe how you teach and choose your subjects and learner
              levels.
            </li>
            <li>
              Learli reviews your application before your profile is public.
            </li>
          </ol>
          <p className="mt-8 border-t border-border pt-6 font-reading text-reading">
            Set available times in your own time zone. Learli handles discovery
            and booking coordination; you deliver the lesson.
          </p>
        </section>
      </div>
    </div>
  );
}
