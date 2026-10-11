import Link from "next/link";

export function UnavailablePage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">{title}</h1>
      <p className="mt-4 max-w-prose text-body text-muted-foreground">
        {message}
      </p>
      <Link href="/" className="action action-outline mt-8">
        Go to home
      </Link>
    </div>
  );
}
