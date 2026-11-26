import { FeedSkeleton } from '@/components/feed/FeedClient';

/** Feed-shaped placeholders on soft navigation, instead of the generic "Loading" text. */
export default function FeedLoading() {
  return (
    <div className="flex min-h-full w-full flex-1 flex-col" role="status" aria-label="Loading">
      <div className="h-12 w-full animate-pulse border-b-2 border-gray-100 bg-gray-50" />
      <div className="flex-1 px-1.5 pb-2 pt-3 md:px-3">
        <FeedSkeleton count={4} />
      </div>
    </div>
  );
}
