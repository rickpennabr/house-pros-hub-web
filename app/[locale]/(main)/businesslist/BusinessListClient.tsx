'use client';

import { useMemo, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import ProCardGrid from '@/components/proscard/ProCardGrid';
import ViewToggle, { ViewType } from '@/components/pageslayout/ViewToggle';
import { useCategory } from '@/contexts/CategoryContext';
import { filterBusinesses } from '@/lib/utils/businessSearch';
import Pagination from '@/components/ui/Pagination';
import { useBusinesses } from '@/hooks/useBusinesses';
import { useScrollPosition } from '@/hooks/useScrollPosition';
import { useWindowDimensions } from '@/hooks/useWindowDimensions';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { ProCardData } from '@/components/proscard/ProCard';

interface BusinessListClientProps {
  initialBusinesses: ProCardData[];
}

export default function BusinessListClient({ initialBusinesses }: BusinessListClientProps) {
  const t = useTranslations('businessList');
  const { activeCategory, searchQuery } = useCategory();
  const { businesses, isLoading } = useBusinesses(initialBusinesses);
  const [savedView, setSavedView] = useLocalStorage<string>('businessListView', 'card');
  const view = (savedView === 'card' || savedView === 'list') ? (savedView as ViewType) : 'card';
  const setView = (newView: ViewType) => setSavedView(newView);
  const filterKey = `${activeCategory ?? ''}|${searchQuery ?? ''}|${view}`;
  const [pagination, setPagination] = useState<{ key: string; page: number }>(() => ({
    key: filterKey,
    page: 1,
  }));
  const currentPage = pagination.key === filterKey ? pagination.page : 1;
  const { isAtBottom } = useScrollPosition({ threshold: 50 });
  const { isMobile } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const filteredCards = useMemo(() => {
    return filterBusinesses(businesses, activeCategory, searchQuery);
  }, [businesses, activeCategory, searchQuery]);

  const itemsPerPage = view === 'list' ? 21 : 12;
  const totalPages = Math.ceil(filteredCards.length / itemsPerPage);
  const safePage = totalPages > 0 ? Math.min(Math.max(currentPage, 1), totalPages) : 1;
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCards = useMemo(() => {
    return filteredCards.slice(startIndex, endIndex);
  }, [filteredCards, startIndex, endIndex]);

  const shouldShowPagination = totalPages >= 2;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://houseproshub.com';

  useEffect(() => {
    const scriptId = 'business-list-structured-data';
    const existingScript = document.getElementById(scriptId);
    if (existingScript) existingScript.remove();

    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Business Directory | House Pros Hub',
      description: 'Browse our network of trusted local contractors and service providers',
      url: `${baseUrl}/businesslist`,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: businesses.length,
        itemListElement: businesses.slice(0, 10).map((business, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'LocalBusiness',
            name: business.businessName,
            description: business.companyDescription || business.contractorType,
            url: `${baseUrl}/business/${business.slug || business.id}`,
          },
        })),
      },
    });
    document.head.appendChild(script);
    return () => {
      const scriptToRemove = document.getElementById(scriptId);
      if (scriptToRemove) scriptToRemove.remove();
    };
  }, [businesses, baseUrl]);

  return (
    <>
      <div className={`w-full min-h-full flex flex-col ${mounted && isAtBottom && !isMobile && !isLoading && filteredCards.length > 0 ? 'pb-[140px]' : ''}`}>
        {isLoading ? (
          <div className="w-full flex-1 flex items-center justify-center py-12" />
        ) : filteredCards.length === 0 ? (
          <div className="w-full flex-1 flex items-center justify-center py-12 text-center">
            <p className="text-gray-600 text-lg">
              {searchQuery
                ? t('noBusinessesFoundMatching', { query: searchQuery })
                : businesses.length === 0
                  ? t('noBusinessesYet')
                  : t('noBusinessesInCategory')}
            </p>
          </div>
        ) : (
          <>
            <ProCardGrid cards={paginatedCards} view={view} />
            {!isLoading && filteredCards.length > 0 && shouldShowPagination && (
              <div
                className={`w-full flex justify-center mt-6 ${
                  mounted && isAtBottom && !isMobile
                    ? 'fixed left-1/2 -translate-x-1/2 bottom-[70px] z-30'
                    : 'mb-[60px]'
                }`}
              >
                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  onPageChange={(page) => setPagination({ key: filterKey, page })}
                  totalItems={filteredCards.length}
                  itemsPerPage={itemsPerPage}
                />
              </div>
            )}
          </>
        )}
      </div>
      {!isLoading && filteredCards.length > 0 && (
        <ViewToggle currentView={view} onViewChange={setView} />
      )}
    </>
  );
}
