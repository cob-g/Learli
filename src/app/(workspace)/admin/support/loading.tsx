export default function Loading() {
  return (
    <div className="page-shell page-space" aria-busy="true">
      <p role="status" className="text-body">
        Loading support cases…
      </p>
      <div
        className="mt-8 h-24 max-w-xl rounded-surface bg-border motion-safe:animate-pulse"
        aria-hidden="true"
      />
    </div>
  );
}
