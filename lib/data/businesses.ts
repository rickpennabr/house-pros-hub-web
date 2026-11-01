/**
 * First page of the public directory, cached for server components.
 */

import { DIRECTORY_CARD_PAGE_SIZE } from '@/lib/constants/businessDirectory';
import { getBusinessDirectoryPage } from '@/lib/data/businessDirectory';
import type { ProCardData } from '@/components/proscard/ProCard';

export {
  BUSINESS_DIRECTORY_CACHE_TAG,
  getBusinessDirectoryPage,
  getCachedDirectoryCategories,
  invalidateBusinessDirectoryCache,
} from '@/lib/data/businessDirectory';

/** First page of active businesses for the directory's server render. */
export async function getCachedBusinessesList(): Promise<ProCardData[]> {
  const page = await getBusinessDirectoryPage({ limit: DIRECTORY_CARD_PAGE_SIZE, offset: 0 });
  return page.businesses;
}
