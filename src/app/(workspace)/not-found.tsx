import { UnavailablePage } from "@/components/shared/unavailable-page";
export default function NotFound() {
  return (
    <UnavailablePage
      title="We can't find that page"
      message="The page may have moved, or the link may be incorrect."
    />
  );
}
