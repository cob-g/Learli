import type { Review } from "@/features/home/review-carousel";

/**
 * SAMPLE CONTENT. Nobody said these things.
 *
 * Test-only examples for carousel interaction and hydration coverage.
 * Application pages must never import these fabricated testimonials.
 *
 * Kept deliberately modest: no names, no numbers, no prices, no results and no
 * claims about tutors being checked. Each one only describes something the
 * product already does. Speakers are roles, because Learli publishes no
 * reviewer names. The pictures are faceless crops (public/home/README.md).
 */
export const sampleReviews: Review[] = [
  {
    author: "Parent of a Middle School learner",
    context: "Math",
    quote:
      "I chose the subject and the level, and the times that came up were already in our time zone. I booked the lesson during my lunch break.",
    image: "/home/moment-problem.webp",
  },
  {
    author: "College Support learner",
    context: "Study skills",
    quote:
      "I manage my own lessons, so I never have to ask anyone to set things up for me. When it is time, the Google Meet link is right there on the booking.",
    image: "/home/moment-kitchen.webp",
  },
  {
    author: "Guardian of a High School learner",
    context: "English",
    quote:
      "Our tutor lives several time zones away, and we have never had to work out the difference. She teaches her own way, on her own Zoom, and it suits my daughter.",
    image: "/home/moment-desk.webp",
  },
];
