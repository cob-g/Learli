# Learli home hero

**Self-authored under explicit creative delegation.** The owner asked on
2026-10-13 to install scroll-craft and "use it specially in the hero section",
with the image looking "HD and in 3D", having earlier given full creative
latitude ("I just want you to be completely fully creative on this"). Nothing
below is a quotation unless it is in quotation marks.

**Scope.** The hero of an existing Next.js page, not a new build. The page's
structure, copy and design system were already set (see `DESIGN.md` and
`context/ui-context.md`), so the grammar gate and whole-page score were not run.
What was used is the hero-depth method and the layer contract. The engine is not
loaded: the skill's own guidance is to preserve the framework and write the
choreography in page-local code, which lives in `src/features/home/`.

## The eight topics

1. **Vibe.** Calm, bright, at-home, mid-task. Evidence: the brand kit's imagery
   board ("Daylight from a window. Eyes on the work, not on the camera.").
2. **Scroll sequence.** The hero only: the scene opens composed, parts as the
   visitor leaves, and passes under the floating header into the subject index.
3. **Energy.** Quiet. The page's loud moment is the navy three-step stage, and
   the hero must not compete with it.
4. **Feeling and the one moment.** See the curve and the peak below.
5. **The one thing no other site does.** The learner leans out of her own
   photograph, and the room behind her moves on its own. Authored decision.
6. **Distance from premium-minimal.** Close to it. The kit is paper, navy and one
   mint highlight; depth is added, loudness is not.
7. **One world or distinct scenes.** Distinct scenes. The hero is one room; the
   rest of the page is not a flight through it.
8. **Assets.** None supplied. The owner asked earlier for student images, and
   they are AI-generated with the owner's Higgsfield account (not kie.ai).
   Provenance is in `public/home/README.md`.

## Layer contract

| Plane             | Asset and depth                                                                        | Independent movement                                                       | Contact and occlusion rule                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Far               | A second learner on a card, behind the scene                                           | Follows the pointer most; sinks 60px across the hero's passage             | Half hidden by the scene; never covers a face                                                                                                           |
| Room              | Clean plate of the bedroom, nobody in it                                               | Follows the pointer a little; sinks 44px; overscanned 10% so no edge shows | No duplicate learner behind the cutout                                                                                                                  |
| Atmosphere        | Window light from the left, drawn in CSS                                               | Brightens slowly with scroll                                               | Lifts the room off the learner; never washes her out                                                                                                    |
| Subject           | The learner with her desk and everything on it, one cutout                             | Moves against the pointer; rises 26px                                      | Her hands, notebook, mug and laptop share one plane, so nothing she touches slides. Clipped to the frame at the sides and foot; her head breaks the top |
| Near              | A worked problem on a card, in front                                                   | Moves against the pointer most; rises 70px                                 | Covers a corner of the desk, never her face or hands                                                                                                    |
| Stroke            | One mint bar on a five-degree rise, hung behind every plane and again inside the frame | Drawn left to right on load; a teal stop on it travels with scroll         | Behind the far card, in front of the room, behind the learner; never under text                                                                         |
| Type and controls | Semantic HTML: headline, lead, cue, finder                                             | Rides at 1x                                                                | The whole headline is readable at every position                                                                                                        |

Opening: the scene sits composed and her head is already above the frame.
Midpoint: the planes have parted and the header's glass is bending the scene as
it passes. Exit: the finder bar is the last thing left, lying across the desk.

## Feeling curve (hero only)

- Opening: recognition. A learner at her own desk, mid-lesson, not posing.
- Pointer or first scroll: curiosity. The picture has a back to it.
- Exit: readiness. The finder is what remains.

**The peak** is not in the hero. It is the navy stage where a lens becomes a
clock becomes two people. In the hero the one moment is small on purpose: "she
is leaning out of the photo".

**Tell-someone sentence.** It's the site where the student in the picture is
sitting slightly in front of her own photograph.

**Authored silence.** None in the hero.

## Not done, on purpose

No pinning and no extra scroll length: the hero is in natural flow. No headline
behind the subject: the kit requires the headline fully readable. No engine, no
scrub video, no pointer lock or capture.
