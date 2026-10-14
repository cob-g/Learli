import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { HomeMotion } from "@/features/home/home-motion";
import { HeroScene } from "@/features/home/hero-scene";
import { LayeredScene } from "@/features/home/layered-scene";
import { LessonTile } from "@/features/home/lesson-tile";
import { previewContentAllowed } from "@/features/home/preview-content";
import { ReviewCarousel } from "@/features/home/review-carousel";
import { sampleReviews } from "@/features/home/sample-reviews";
import {
  groupSubjects,
  learnerLevelOptions,
} from "@/features/subjects/catalog";
import { readPublicCatalog, tutorsHref } from "@/features/tutors/public";
import { TutorList } from "@/features/tutors/tutor-card";
import { TutorFilterForm } from "@/features/tutors/tutor-filter-form";
import { JsonLd } from "@/components/shared/json-ld";
import { websiteStructuredData } from "@/lib/seo/crawling";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { siteOrigin } from "@/lib/seo/site";
import "./home.css";

export const dynamic = "force-dynamic";
// The home page keeps the site's own title and description.
export const metadata = publicPageMetadata({ path: "/" });

export default async function Home() {
  const catalog = await readPublicCatalog();
  const tutors = catalog?.tutors ?? [];
  // Learli has no published reviews yet. The preview shows labelled samples;
  // production shows nothing until real ones exist.
  const reviews = previewContentAllowed() ? sampleReviews : [];
  return (
    <HomeMotion>
      <section className="home-hero">
        {/* Source order is the phone order: headline, words, finder, scene. */}
        <div className="page-shell home-hero-grid">
          <h1 className="home-hero-title text-hero text-balance">
            <span className="brand-highlight home-mark home-mark-load">
              Find a tutor
            </span>{" "}
            for <span className="inline-block">one-to-one</span> online lessons
          </h1>
          <div className="home-hero-words">
            <p className="text-body text-muted-foreground md:text-lead xl:text-body">
              For Elementary, Middle School, High School, and College Support
              learners. Lessons take place with your tutor on Zoom or Google
              Meet.
            </p>
            <p className="mt-3">
              <a
                className="home-cue home-cue-down"
                href="#how-it-works"
                data-glide=""
              >
                See how it works
                <ArrowDown size={20} aria-hidden="true" />
              </a>
            </p>
          </div>
          <div className="home-finder">
            <div
              className="glass glass-liquid rounded-surface p-6"
              data-glint=""
            >
              {!catalog ? (
                <>
                  <h2 className="text-section-title">
                    Tutor search is unavailable
                  </h2>
                  <p role="alert" className="mt-4 text-body">
                    We couldn&apos;t load tutors. Try again, or contact support
                    if this keeps happening.
                  </p>
                  <p className="mt-4 flex flex-wrap gap-x-6">
                    <Link
                      className="inline-flex min-h-12 items-center"
                      href="/"
                    >
                      Try again
                    </Link>
                    <Link
                      className="inline-flex min-h-12 items-center"
                      href="/contact"
                    >
                      Contact support
                    </Link>
                  </p>
                </>
              ) : tutors.length > 0 ? (
                <>
                  <h2 className="text-section-title">
                    What do you need help with?
                  </h2>
                  <div className="mt-6">
                    <TutorFilterForm
                      variant="finder"
                      subjects={catalog.subjects}
                    />
                  </div>
                  <p className="mt-4 text-small text-muted-foreground">
                    Prefer a little guidance?{" "}
                    <Link href="/get-matched">Get matched</Link> by subject,
                    level and available time.
                  </p>
                </>
              ) : (
                <EmptyState
                  title="No tutors are listed right now"
                  links={[
                    { href: "/become-a-tutor", label: "Become a tutor" },
                    { href: "/contact", label: "Contact support" },
                  ]}
                >
                  <p>
                    Learli is preparing to welcome tutors. Booking is not
                    available yet.
                  </p>
                </EmptyState>
              )}
            </div>
          </div>
          <HeroScene className="home-hero-stage" />
        </div>
      </section>
      {tutors.length > 0 && (
        <section className="page-shell pb-16 md:pb-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-headline">Tutors on Learli</h2>
            <Link className="home-cue" href="/tutors">
              Browse all tutors
              <ArrowRight size={20} aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-6">
            <TutorList tutors={tutors.slice(0, 3)} heading="h3" />
          </div>
        </section>
      )}
      {catalog && catalog.subjects.length > 0 && (
        <section className="border-y border-border bg-surface">
          <div className="page-shell py-16 md:py-24">
            <h2 className="text-display">
              Find{" "}
              <span className="brand-highlight home-mark" data-reveal="">
                your subject
              </span>
            </h2>
            <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-x-12 gap-y-10">
              {groupSubjects(catalog.subjects).map((group) => (
                <div key={group.category}>
                  <h3 className="text-label-strong text-muted-foreground">
                    {group.label}
                  </h3>
                  <ul
                    className="home-ruled home-ruled-closed mt-3"
                    data-reveal=""
                  >
                    {group.subjects.map((subject) => (
                      <li key={subject.slug}>
                        <Link
                          className="home-index-link text-section-title"
                          href={tutorsHref({ subject: subject.slug })}
                        >
                          <span>{subject.name}</span>
                          <ArrowRight size={20} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <h3 className="mt-14 text-label-strong text-muted-foreground">
              Learner levels
            </h3>
            <ul
              className="home-ruled mt-3 grid gap-x-12 sm:grid-cols-2 lg:grid-cols-4"
              data-reveal=""
            >
              {learnerLevelOptions.map(([level, label]) => (
                <li key={level}>
                  <Link
                    className="home-index-link text-item-title"
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
      )}
      <section
        id="how-it-works"
        tabIndex={-1}
        data-surface="inverse"
        className="home-lesson-section"
      >
        <div className="page-shell home-lesson-top">
          <div className="home-lesson-head">
            <h2 className="text-display text-balance">
              <span className="lg:block">How a lesson</span>{" "}
              <span className="brand-highlight">comes together</span>
            </h2>
            <div>
              <p className="max-w-prose text-lead">
                Learli brings tutor discovery and lesson coordination into one
                place. Your tutor does the teaching.
              </p>
              <Link className="home-cue mt-2" href="/how-it-works">
                More on how it works
                <ArrowRight size={20} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
        <div className="page-shell home-lesson-body">
          {/* On wide screens the three steps arrive as one: the stroke is drawn
              through them and each glyph assembles as it passes. */}
          <div
            className="home-lesson"
            data-reveal=""
            data-reveal-group="(min-width: 64rem)"
            data-scrub=""
          >
            <span className="home-line" aria-hidden="true">
              <span className="home-line-bead" />
            </span>
            <ol role="list" className="home-steps min-w-0 wrap-anywhere">
              <li>
                <LessonTile step={1} />
                <h3 className="text-section-title">
                  Find a tutor for your subject
                </h3>
                <p className="mt-3 max-w-prose text-body">
                  Compare the subjects and learner levels each tutor offers. Or{" "}
                  <Link href="/get-matched">get matched</Link> by subject, level
                  and available time.
                </p>
              </li>
              <li>
                <LessonTile step={2} />
                <h3 className="text-section-title">Choose an available time</h3>
                <p className="mt-3 max-w-prose text-body">
                  View dated times in your time zone. Availability is checked
                  again when booking.
                </p>
              </li>
              <li>
                <LessonTile step={3} />
                <h3 className="text-section-title">
                  Meet on Zoom or Google Meet
                </h3>
                <p className="mt-3 max-w-prose text-body">
                  Your tutor teaches independently and provides the learning
                  materials. Meeting details belong to the private booking,
                  rather than the public profile.
                </p>
              </li>
            </ol>
          </div>
        </div>
      </section>
      <section className="page-shell py-16 md:py-24">
        <h2 className="max-w-4xl text-display text-balance">
          Learli arranges the lesson.{" "}
          <span className="brand-highlight home-mark" data-reveal="">
            Your tutor teaches it.
          </span>
        </h2>
        <p className="mt-6 max-w-prose text-lead">
          Learli is where you find a tutor and book a time. It is not a
          classroom: the lesson itself happens between the learner and the
          tutor, on Zoom or Google Meet.
        </p>
        {/* The lesson in the middle, and who looks after what on either side.
            The picture is square with both people in its upper half; on wide
            screens it is nudged left so both faces sit clear of the navy card. */}
        <LayeredScene
          image={{
            src: "/home/family-table.webp",
            alt: "A parent and a young learner sitting together at a table, the learner writing in a notebook beside a laptop.",
            width: 1600,
            height: 1600,
          }}
          focus={{ stacked: "50% 30%", row: "50% 20%", wide: "62% 40%" }}
          glass={{
            title: "What Learli looks after",
            items: [
              "Tutor profiles with the subjects and learner levels each tutor teaches",
              "Dated lesson times, in your time zone",
              "A second availability check at the moment you book",
              "Meeting details kept with the private booking",
            ],
          }}
          navy={{
            title: "What your tutor looks after",
            items: [
              "The teaching, one learner at a time",
              "The learning materials and the method",
              "The Zoom or Google Meet room",
            ],
          }}
        />
        <div className="mt-12 grid gap-x-16 gap-y-4 md:mt-16 md:grid-cols-2">
          <p className="max-w-prose text-body text-muted-foreground">
            Parents and guardians arrange lessons for a learner they are
            authorized to manage. Eligible college learners can manage their
            own.
          </p>
          <p className="max-w-prose text-body">
            Worried about a lesson or a tutor?{" "}
            <Link href="/report-a-concern">Report a concern</Link>.
          </p>
        </div>
      </section>
      {reviews.length > 0 && (
        <section className="home-reviews-section border-t border-border bg-subtle">
          <div className="page-shell py-16 md:py-24">
            <h2 className="text-display text-balance">
              Lessons, in{" "}
              <span className="brand-highlight home-mark" data-reveal="">
                their own words
              </span>
            </h2>
            <p className="mt-5 flex max-w-prose flex-wrap items-center gap-x-3 gap-y-2 text-small text-muted-foreground">
              <span className="inline-flex min-h-7 items-center rounded-tag border border-control bg-surface px-2 text-label text-foreground">
                Sample reviews
              </span>
              Written for this preview. They are not from Learli customers.
            </p>
            <div className="mt-10 md:mt-14">
              <ReviewCarousel reviews={reviews} />
            </div>
          </div>
        </section>
      )}
      <section className="border-t border-border bg-surface">
        <div className="page-shell grid md:grid-cols-2">
          <div className="py-12 md:py-20 md:pe-16">
            <h2 className="text-headline">Looking for a tutor?</h2>
            <p className="mt-4 max-w-prose text-body text-muted-foreground">
              Start with a subject and a level, or answer the short matching
              questions.
            </p>
            <p className="mt-8 flex flex-wrap gap-4">
              <Link className="action action-primary" href="/tutors">
                Find a tutor
                <ArrowRight
                  className="home-arrow"
                  size={20}
                  aria-hidden="true"
                />
              </Link>
              <Link className="action action-outline" href="/get-matched">
                Get matched
              </Link>
            </p>
          </div>
          <div className="border-t border-border py-12 md:border-s md:border-t-0 md:py-20 md:ps-16">
            <h2 className="text-headline">Are you a tutor?</h2>
            <p className="mt-4 max-w-prose text-body text-muted-foreground">
              On Learli you teach one-to-one lessons on your own Zoom or Google
              Meet account. You decide how you teach and what materials you use.
            </p>
            <p className="mt-6">
              <Link className="home-cue" href="/become-a-tutor">
                Become a tutor
                <ArrowRight size={20} aria-hidden="true" />
              </Link>
            </p>
          </div>
        </div>
      </section>
      <JsonLd data={websiteStructuredData(siteOrigin())} />
    </HomeMotion>
  );
}
