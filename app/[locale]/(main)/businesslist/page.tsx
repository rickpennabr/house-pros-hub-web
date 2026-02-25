import { getCachedBusinessesList } from '@/lib/data/businesses';
import BusinessListClient from './BusinessListClient';

/**
 * Business list page: server-fetches initial data (cached) and passes to client for fast first paint.
 */
export default async function BusinessListPage() {
  const initialBusinesses = await getCachedBusinessesList();
  return <BusinessListClient initialBusinesses={initialBusinesses} />;
}
