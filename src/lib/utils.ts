import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const mergeClasses = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "hero",
        "display",
        "headline",
        "lead",
        "page-title",
        "section-title",
        "item-title",
        "body",
        "prose",
        "reading",
        "action",
        "time",
        "label",
        "label-strong",
        "small",
        "caption",
      ],
      radius: ["check", "tag", "control", "surface", "overlay", "frame"],
      shadow: ["float", "modal"],
      ease: ["enter", "exit"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return mergeClasses(clsx(inputs));
}
