'use client';

import { useMemo, useState, useEffect } from 'react';
import ProCardGrid from '@/components/proscard/ProCardGrid';
import { useCategory } from '@/contexts/CategoryContext';
import { filterBusinesses } from '@/lib/utils/businessSearch';
import { businessStorage } from '@/lib/storage/businessStorage';
import { ProCardData } from '@/components/proscard/ProCard';

export default function BusinessList() {
  const { activeCategory, searchQuery } = useCategory();
  const [businesses, setBusinesses] = useState<ProCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load businesses from localStorage on mount and when window gains focus
  useEffect(() => {
    const loadBusinesses = () => {
      const loadedBusinesses = businessStorage.getAllBusinesses();
      // Remove userId from businesses before displaying (it's for internal use only)
      const businessesForDisplay = loadedBusinesses.map((business: ProCardData & { userId?: string }) => {
        const { userId, ...businessData } = business;
        return businessData;
      });
      setBusinesses(businessesForDisplay);
      setIsLoading(false);
    };

    loadBusinesses();

    // Reload when window gains focus (useful if business was created in another tab/window)
    const handleFocus = () => {
      loadBusinesses();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Filter businesses based on active category and search query
  const filteredCards = useMemo(() => {
    return filterBusinesses(businesses, activeCategory, searchQuery);
  }, [businesses, activeCategory, searchQuery]);

  return (
    <div className="w-full min-h-full flex flex-col">
      {isLoading ? (
        <div className="w-full flex-1 flex items-center justify-center py-12">
          {/* Loading state - don't show any message while loading */}
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="w-full flex-1 flex items-center justify-center py-12 text-center">
          <p className="text-gray-600 text-lg">
            {searchQuery 
              ? `No businesses found matching "${searchQuery}"`
              : businesses.length === 0
                ? 'No businesses yet. Sign up and add your first business!'
                : 'No businesses found in this category'}
          </p>
        </div>
      ) : (
        <ProCardGrid cards={filteredCards} />
      )}
    </div>
  );
}
