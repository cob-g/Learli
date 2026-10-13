import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { learnerLevelOptions } from "@/features/subjects/catalog";
import { tutorsHref } from "@/features/tutors/search";
import { HomeMotion } from "./home-motion";
import { LayeredScene } from "./layered-scene";
import { Facts, TwoDoors } from "./page-sections";
import { StepsLine } from "./steps-line";

/*
 * Content for the four public pages in the navigation, built from the landing
 * page's blocks. Each guide sits under its page's working area (the directory,
 * the matching questions, the catalog, the application) and never replaces it.
 *
 * Everything said here describes what the product does today. No prices,
 * counts, results, reviews or verification claims; no forms and no headings
 * above level two, so each page keeps its one page heading.
 */

/** Below the directory: what the page is for, in the order people use it. */
export function FindATutorGuide() {
  return (
    <HomeMotion>
      <StepsLine
        heading={
          <>
            From the directory to{" "}
            <span className="brand-highlight">a lesson</span>
          </>
        }
        intro="Browsing needs no account. Here is what this page is for, in the order most people use it."
        steps={[
          {
            glyph: 1,
            title: "Narrow the list",
            body: "Filter by subject and learner level, and by teaching language where tutors have listed one.",
          },
          {
            glyph: 2,
            title: "Add a lesson time",
            body: "It is optional. Choose your time zone, the weekdays and a time of day, and each tutor shows the next open time that fits.",
          },
          {
            glyph: 3,
            title: "Open a profile",
            body: "Read how the tutor teaches, then choose a time on their profile. Availability is checked again when booking.",
          },
        ]}
      />
      <Facts
        heading={
          <>
            What a{" "}
            <span className="brand-highlight home-mark" data-reveal="">
              listing shows
            </span>
          </>
        }
        intro="Tutors write their own profiles. Learli lists a tutor after reviewing their application."
        facts={[
          "The subjects a tutor teaches, and the learner levels for each",
          "The languages they teach in, as declared by the tutor",
          "An introduction in the tutor's own words",
          "The next open time that fits, when you add a lesson time",
        ]}
      />
      <TwoDoors
        first={{
          title: "Rather be guided?",
          body: "Answer three questions about level, subject and time, and see the tutors who fit.",
          href: "/get-matched",
          label: "Get matched",
        }}
        second={{
          title: "Not sure what to study?",
          body: "See every subject on Learli, grouped by kind.",
          href: "/subjects",
          label: "Browse subjects",
        }}
      />
    </HomeMotion>
  );
}

/** Below the matching questions or their results: how matching works. */
export function GetMatchedGuide() {
  return (
    <HomeMotion>
      <StepsLine
        heading={
          <>
            Three questions, <span className="brand-highlight">one list</span>
          </>
        }
        intro="Matching on Learli follows your three answers and nothing else."
        steps={[
          {
            title: "The learner's level",
            body: "Elementary, Middle School, High School or College Support.",
          },
          {
            title: "The subject",
            body: "Math, Science, English, test preparation, homework help or study skills, plus any specialized subject a tutor teaches at that level.",
          },
          {
            title: "When a lesson suits you",
            body: "Any time, or your preferred weekdays and time of day, in your own time zone.",
          },
        ]}
      />
      <Facts
        heading={
          <>
            What{" "}
            <span
              className="brand-highlight home-mark inline-block"
              data-reveal=""
            >
              a match
            </span>{" "}
            means
          </>
        }
        intro="The same rules apply to everyone, and the list is never padded with tutors who do not fit."
        facts={[
          "Every tutor shown teaches that subject at that level",
          "Each one has an open time that fits your answer",
          "The list runs from the earliest matching time, then by tutor name",
          "If nobody fits, the page says so and you can change an answer",
        ]}
      />
      <TwoDoors
        first={{
          title: "Prefer to look around?",
          body: "Browse every tutor and filter by subject, level and lesson time.",
          href: "/tutors",
          label: "Find a tutor",
        }}
        second={{
          title: "New to Learli?",
          body: "See how a lesson comes together, from finding a tutor to meeting on Zoom or Google Meet.",
          href: "/how-it-works",
          label: "How it works",
        }}
      />
    </HomeMotion>
  );
}

/** Below the catalog: the learner levels and how subjects are grouped. */
export function SubjectsGuide() {
  return (
    <HomeMotion>
      <section className="border-y border-border bg-surface">
        <div className="page-shell py-16 md:py-24">
          <h2 className="text-display text-balance">
            Four{" "}
            <span className="brand-highlight home-mark" data-reveal="">
              learner levels
            </span>
          </h2>
          <p className="mt-6 max-w-prose text-lead text-muted-foreground">
            A tutor lists the levels they teach for each subject. Choose a level
            to see who teaches at it.
          </p>
          <ul
            className="home-ruled mt-8 grid gap-x-12 sm:grid-cols-2 lg:grid-cols-4"
            data-reveal=""
          >
            {learnerLevelOptions.map(([level, label]) => (
              <li key={level}>
                <Link
                  className="home-index-link text-section-title"
                  href={tutorsHref({ level })}
                >
                  <span>{label}</span>
                  <ArrowRight size={20} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="page-shell py-16 md:py-24">
        <h2 className="max-w-4xl text-display text-balance">
          How subjects are{" "}
          <span className="brand-highlight home-mark" data-reveal="">
            grouped
          </span>
        </h2>
        <p className="mt-6 max-w-prose text-lead">
          Four groups, so a subject is easy to find whether you want regular
          lessons or help before one exam.
        </p>
        <LayeredScene
          image={{
            src: "/home/study-desk.webp",
            alt: "A notebook of worked algebra on a desk, with a ruler, a compass, pencils, a highlighter, three books and a mug.",
            width: 1600,
            height: 1600,
          }}
          focus={{ stacked: "50% 45%", row: "50% 42%", wide: "44% 50%" }}
          glass={{
            title: "Core and test preparation",
            items: [
              "Academic core: Math, Science and English",
              "Test preparation: SAT, ACT and entrance exams",
            ],
          }}
          navy={{
            title: "Support and specialized",
            items: [
              "Academic support: homework help and study skills",
              "Specialized subjects: listed only while a tutor on Learli teaches them",
            ],
          }}
        />
      </section>
      <div className="border-t border-border">
        <TwoDoors
          first={{
            title: "Know what you need?",
            body: "Browse every tutor and filter by subject, level and lesson time.",
            href: "/tutors",
            label: "Find a tutor",
          }}
          second={{
            title: "Rather be guided?",
            body: "Answer three questions about level, subject and time, and see the tutors who fit.",
            href: "/get-matched",
            label: "Get matched",
          }}
        />
      </div>
    </HomeMotion>
  );
}

/** Below the application: who does what, and what a tutor sets up. */
export function BecomeATutorGuide() {
  return (
    <HomeMotion>
      <section className="page-shell py-16 md:py-24">
        <h2 className="max-w-4xl text-display text-balance">
          You teach.{" "}
          <span className="brand-highlight home-mark" data-reveal="">
            Learli coordinates.
          </span>
        </h2>
        <p className="mt-6 max-w-prose text-lead">
          Learli handles discovery and booking coordination. The lesson is
          yours: your room, your materials, your method.
        </p>
        <LayeredScene
          image={{
            src: "/home/tutor-desk.webp",
            alt: "A tutor in a headset at a desk, explaining something to a laptop with a notebook open beside him.",
            width: 1600,
            height: 1600,
          }}
          focus={{ stacked: "46% 28%", row: "46% 22%", wide: "44% 35%" }}
          glass={{
            title: "What Learli handles",
            items: [
              "Your profile in the directory and in matching",
              "Your open times, shown to each family in their own time zone",
              "A second availability check at the moment someone books",
              "Meeting details kept with the private booking",
            ],
          }}
          navy={{
            title: "What stays yours",
            items: [
              "How you teach, and the materials you use",
              "The subjects and learner levels you take",
              "Your hours, set in your own time zone",
              "Your own Zoom or Google Meet room",
            ],
          }}
        />
      </section>
      <Facts
        heading={
          <>
            What you{" "}
            <span className="brand-highlight home-mark" data-reveal="">
              set up
            </span>
          </>
        }
        intro="Your application is your profile. Learli reviews it before it becomes public."
        facts={[
          "A headline, an introduction and your teaching background",
          "Each subject you teach, with its learner levels and an optional specialty",
          "The languages you teach in",
          "Weekly availability, and time off when you need it",
        ]}
      />
      <TwoDoors
        first={{
          title: "See it from a family's side",
          body: "How families find a tutor, choose a time and meet on Zoom or Google Meet.",
          href: "/how-it-works",
          label: "How it works",
        }}
        second={{
          title: "Have a question first?",
          body: "Ask before you start an application.",
          href: "/contact",
          label: "Contact support",
        }}
      />
    </HomeMotion>
  );
}
