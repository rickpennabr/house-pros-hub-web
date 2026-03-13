/**
 * Full-page loading overlay for Suspense fallbacks and route loading.
 * Use in root/locale layouts so users see a consistent loading state instead of a blank screen.
 */
export default function LoadingOverlay() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black md:bg-black/90"
      role="status"
      aria-label="Loading"
    >
      <span className="text-sm text-white/90">Loading</span>
    </div>
  );
}
