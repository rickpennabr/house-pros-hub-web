/**
 * Inline loading fallback for Suspense (e.g. inside a page container).
 * Use when the loading state is not full-page (e.g. account-management, probot page content).
 */
export default function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8" role="status" aria-label="Loading">
      <span className="text-sm text-gray-500">Loading</span>
    </div>
  );
}
