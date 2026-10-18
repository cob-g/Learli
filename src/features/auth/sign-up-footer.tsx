import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import "./sign-up-footer.css";

export function SignUpFooter() {
  return (
    <footer className="sign-up-footer">
      <div className="sign-up-footer-brand">
        <Link href="/" aria-label="Learli home">
          <BrandLogo className="w-12 sm:w-12" />
        </Link>
        <span>© {new Date().getFullYear()}</span>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/privacy">Privacy draft</Link>
        <Link href="/terms">Terms draft</Link>
        <Link href="/contact">Help</Link>
      </nav>
    </footer>
  );
}
