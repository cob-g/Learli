import { PublicShell } from "@/components/shared/public-shell";
import { UnavailablePage } from "@/components/shared/unavailable-page";

export default function NotFound() {
  return (
    <PublicShell>
      <UnavailablePage
        title="We can't find that page"
        message="The page may have moved, or the link may be incorrect."
      />
    </PublicShell>
  );
}
