import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import type { Role } from "@/lib/db/schema/app";

/** Who each workspace is for, as the label reads it: "for tutors". */
const audience: Record<Role, string> = {
  admin: "admins",
  parent: "parents",
  student: "students",
  tutor: "tutors",
};

/**
 * The sidebar's wordmark, followed on its baseline by the workspace it opens.
 * The label is ordinary text so assistive technology reads it with the logo.
 */
export function WorkspaceBrand({ role }: { role: Role | null }) {
  return (
    <div className="workspace-brand-row">
      <Link
        href="/account"
        className="workspace-brand"
        aria-label="Learli account"
      >
        <BrandLogo />
      </Link>
      {role && (
        <span className="workspace-brand-for">for {audience[role]}</span>
      )}
    </div>
  );
}
