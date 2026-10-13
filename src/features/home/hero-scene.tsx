import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The hero as a layered scene, following scroll-craft's hero-depth method: one
 * photograph cut into planes that move at their own rates under scroll and a
 * fine pointer (home.css, HomeMotion).
 *
 *   far      a second learner, on a card behind the scene
 *   room     the clean plate: the bedroom with nobody in it
 *   subject  the learner with her desk and everything on it, as one cutout,
 *            so nothing she touches can slide away from her
 *   near     a worked problem, on a card in front
 *
 * One mint stroke, the headline's highlight carried on, crosses all of it. It
 * is drawn twice on the same line: once behind every plane, and once inside
 * the frame between the room and the learner, so it passes behind the small
 * photograph, through the big one behind her, and out the other side. A teal
 * bead rides it toward the finder.
 *
 * Her head breaks the top of the frame, so the depth is there before anything
 * moves. All four pictures are illustrative and AI-generated (provenance in
 * public/home/README.md); alt text describes the scene and never calls anyone a
 * Learli learner. The plate is decorative: the subject's alt covers the scene.
 */
export function HeroScene({ className }: { className?: string }) {
  return (
    <div className={cn("home-depth", className)} data-scrub="" data-tilt="">
      <div className="home-depth-space">
        <div className="home-depth-plane home-depth-far rounded-frame">
          <Image
            src="/home/learner-kitchen.webp"
            alt="A college-age learner in headphones taking notes at a kitchen table, facing a laptop."
            width={1400}
            height={1120}
            quality={90}
            sizes="(min-width: 64rem) 19rem, 44vw"
          />
        </div>
        <div className="home-depth-scene" data-scene="">
          <span
            className="home-depth-rail home-depth-rail-back"
            aria-hidden="true"
          >
            <span className="home-depth-stroke" />
            <span className="home-depth-bead" />
          </span>
          <div className="home-depth-room rounded-surface">
            <Image
              className="home-depth-plate"
              src="/home/desk-room.webp"
              alt=""
              width={1400}
              height={1876}
              quality={90}
              sizes="(min-width: 64rem) 28rem, 90vw"
              preload
              data-plane=""
            />
            <span className="home-depth-light" aria-hidden="true" />
          </div>
          <span
            className="home-depth-through rounded-surface"
            aria-hidden="true"
          >
            <span className="home-depth-rail">
              <span className="home-depth-stroke" />
            </span>
          </span>
          <div className="home-depth-plane home-depth-subject">
            <Image
              src="/home/desk-learner.webp"
              alt="A learner at a desk by a window, writing in a notebook beside an open laptop."
              width={1400}
              height={1876}
              quality={90}
              sizes="(min-width: 64rem) 28rem, 90vw"
              preload
              data-plane=""
            />
          </div>
        </div>
        <div className="home-depth-plane home-depth-near rounded-frame">
          <Image
            src="/home/worked-problem.webp"
            alt="Hands working through an algebra problem in a notebook, next to a laptop."
            width={1400}
            height={985}
            quality={90}
            sizes="(min-width: 64rem) 18rem, 44vw"
          />
        </div>
      </div>
    </div>
  );
}
