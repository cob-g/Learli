import { navigationStartEvent } from "@/components/shared/navigation-progress";

/**
 * Called by the router as a link, form or Back/Forward navigation begins, from
 * inside the navigation's own transition. `NavigationProgress` listens.
 */
export function onRouterTransitionStart() {
  window.dispatchEvent(new Event(navigationStartEvent));
}
