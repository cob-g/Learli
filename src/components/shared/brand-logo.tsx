import Image from "next/image";

/** Original vector artwork from the owner's Learli brand kit 2.0. */
export function BrandLogo({ reverse = false }: { reverse?: boolean }) {
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
      className="h-auto w-24 shrink-0 sm:w-28"
      priority
    />
  );
}
