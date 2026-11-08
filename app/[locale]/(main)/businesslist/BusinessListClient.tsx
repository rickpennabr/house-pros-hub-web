'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ProCardGrid from '@/components/proscard/ProCardGrid';
import ViewToggle, { ViewType } from '@/components/pageslayout/ViewToggle';
import BusinessListMobileBottomBar from '@/components/pageslayout/BusinessListMobileBottomBar';
import { isHubPro, ProAddModal } from '@/components/pageslayout/ProAddChooser';
import { useAuth } from '@/contexts/AuthContext';
import { useCategory } from '@/contexts/CategoryContext';
import BotFloatingButton from '@/components/pageslayout/BotFloatingButton';
import Pagination from '@/components/ui/Pagination';
import { useBusinesses } from '@/hooks/useBusinesses';
import { DIRECTORY_CARD_PAGE_SIZE, DIRECTORY_LIST_PAGE_SIZE } from '@/lib/constants/businessDirectory';
import { sanitizeDirectoryCategory, sanitizeDirectoryCity } from '@/lib/data/directoryParams';
import { runWhileVisible } from '@/lib/utils/runWhileVisible';
import { useScrollPosition } from '@/hooks/useScrollPosition';
import { useWindowDimensions } from '@/hooks/useWindowDimensions';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { ProCardData } from '@/components/proscard/ProCard';

const PRESENCE_POLL_MS = 60_000;

interface BusinessListClientProps {
  initialBusinesses: ProCardData[];
  initialTotal: number;
  initialCategory?: string;
  initialCity?: string;
}

export default function BusinessListClient({
  initialBusinesses,
  initialTotal,
  initialCategory = 'All',
  initialCity = '',
}: BusinessListClientProps) {
  const t = useTranslations('businessList');
  const tCommon = useTranslations('common');
  const { isAuthenticated, roles } = useAuth();
  const isPro = isAuthenticated && isHubPro(roles as readonly string[]);
  const [addOpen, setAddOpen] = useState(false);
  const searchParams = useSearchParams();
  const category = sanitizeDirectoryCategory(searchParams.get('category')) || initialCategory || 'All';
  const city = sanitizeDirectoryCity(searchParams.get('city')) || initialCity;
  const { searchQuery, setActiveCategory } = useCategory();
  const [savedView, setSavedView] = useLocalStorage<string>('businessListView', 'card');
  const view = (savedView === 'card' || savedView === 'list') ? (savedView as ViewType) : 'card';
  const setView = (newView: ViewType) => setSavedView(newView);
  const filterKey = `${category}|${city}|${searchQuery ?? ''}|${view}`;
  const [pagination, setPagination] = useState<{ key: string; page: number }>(() => ({
    key: filterKey,
    page: 1,
  }));
  const currentPage = pagination.key === filterKey ? pagination.page : 1;
  const itemsPerPage = view === 'list' ? DIRECTORY_LIST_PAGE_SIZE : DIRECTORY_CARD_PAGE_SIZE;
  const { businesses, total, isLoading } = useBusinesses({
    initialBusinesses,
    initialTotal,
    category,
    city,
    search: searchQuery,
    page: currentPage,
    pageSize: itemsPerPage,
    initialCategory,
    initialCity,
  });
  const [onlineByBusiness, setOnlineByBusiness] = useState<Record<string, boolean>>({});
  const businessesRef = useRef<ProCardData[]>([]);
  businessesRef.current = businesses;
  const { isAtBottom } = useScrollPosition({ threshold: 50 });
  const { isMobile } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Use isMobile only after mount to avoid hydration mismatch (server has no window, client may be mobile).
  const isMobileSafe = mounted && isMobile;

  useEffect(() => {
    setActiveCategory(category || 'All');
  }, [category, setActiveCategory]);

  const visibleIds = businesses.map((business) => business.id).join(',');

  // Presence for the businesses on this page. Hidden tabs stop polling.
  useEffect(() => {
    const run = () => {
      const ids = businessesRef.current.map((business) => business.id);
      if (ids.length === 0) return;
      fetch(`/api/chat/presence?businessIds=${ids.join(',')}`)
        .then((res) => (res.ok ? res.json() : { onlineByBusiness: {} }))
        .then((data) => setOnlineByBusiness((data.onlineByBusiness ?? {}) as Record<string, boolean>))
        .catch(() => {});
    };
    return runWhileVisible(run, PRESENCE_POLL_MS);
  }, [visibleIds]);

  const pageCards = useMemo(() => {
    return businesses.map((business) => ({ ...business, online: onlineByBusiness[business.id] === true }));
  }, [businesses, onlineByBusiness]);

  const totalPages = Math.ceil(total / itemsPerPage);
  const shouldShowPagination = totalPages >= 2;

  return (
    <>
      <div className={`w-full min-h-full flex flex-col ${mounted && isAtBottom && !isMobileSafe && pageCards.length > 0 ? 'pb-[140px]' : ''} ${isMobileSafe && pageCards.length > 0 ? 'pb-28' : ''}`}>
        {isLoading && pageCards.length === 0 ? (
          <div className="w-full flex-1 flex items-center justify-center py-12" />
        ) : pageCards.length === 0 ? (
          <div className="w-full flex-1 flex items-center justify-center py-12 text-center">
            <p className="text-gray-600 text-lg">
              {searchQuery
                ? t('noBusinessesFoundMatching', { query: searchQuery })
                : category && category !== 'All'
                  ? t('noBusinessesInCategory')
                  : t('noBusinessesYet')}
            </p>
          </div>
        ) : (
          <>
            <ProCardGrid cards={pageCards} view={view} />
            {shouldShowPagination && (
              <div
                className={`w-full flex justify-center mt-6 ${
                  mounted && isAtBottom && !isMobileSafe
                    ? 'fixed left-1/2 -translate-x-1/2 bottom-[70px] z-30'
                    : 'mb-[60px]'
                }`}
              >
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => setPagination({ key: filterKey, page })}
                  totalItems={total}
                  itemsPerPage={itemsPerPage}
                />
              </div>
            )}
          </>
        )}
      </div>
      {pageCards.length > 0 && isMobileSafe && (
        <BusinessListMobileBottomBar
          currentView={view}
          onViewChange={setView}
          showProAdd={isPro}
          addOpen={addOpen}
          onAdd={() => setAddOpen(true)}
          addLabel={tCommon('view.add')}
        />
      )}
      {pageCards.length > 0 && !isMobileSafe && (
        <ViewToggle
          currentView={view}
          onViewChange={setView}
          onAdd={isPro ? () => setAddOpen(true) : undefined}
          addLabel={tCommon('view.add')}
          addOpen={addOpen}
          showAddOnDesktop
        />
      )}
      {isPro && <ProAddModal isOpen={addOpen} onClose={() => setAddOpen(false)} />}
      {pageCards.length > 0 && <BotFloatingButton />}
    </>
  );
}
