/**
 * Route-level loading UI for [locale] segment.
 * Dark background to match welcome/ProBot shell and avoid white flash before (main) loads.
 */
export default function LocaleLoading() {
  return (
    <div
      className="fixed inset-0 z-40 bg-black md:bg-black/80"
      aria-hidden
      aria-label="Loading"
    />
  );
}
