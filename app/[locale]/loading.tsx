import LoadingOverlay from '@/components/ui/LoadingOverlay';

/**
 * Route-level loading UI for [locale] segment.
 * Dark background to match welcome/ProBot shell and avoid white flash before (main) loads.
 */
export default function LocaleLoading() {
  return <LoadingOverlay />;
}
