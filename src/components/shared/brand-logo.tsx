import Image from "next/image";
import { cn } from "@/lib/utils";

/** Original vector artwork from the owner's Learli brand kit 2.0. */
export function BrandLogo({
  reverse = false,
  className,
}: {
  reverse?: boolean;
  /** A different width; the artwork keeps its own proportions. */
  className?: string;
}) {
  return (
    <Image
      src={
        reverse
          ? "/brand/learli-wordmark-reverse.svg"
          : "/brand/learli-wordmark.svg"
      }
      alt="Learli"
      width={408}
      height={145}
      className={cn("h-auto w-24 shrink-0 sm:w-28", className)}
      priority
    />
  );
}
