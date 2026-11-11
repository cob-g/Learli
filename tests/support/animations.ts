import type { Page } from "@playwright/test";

/**
 * Waits for finite CSS animations (such as cards fading in) to finish, so an
 * accessibility scan measures the settled page, not a mid-fade frame.
 */
export async function animationsSettled(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}
