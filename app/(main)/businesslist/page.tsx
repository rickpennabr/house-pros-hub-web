'use client';

import { useMemo } from 'react';
import ProCardGrid from '@/components/proscard/ProCardGrid';
import { useCategory } from '@/contexts/CategoryContext';
import { filterBusinesses } from '@/lib/utils/businessSearch';

import { sampleProCards } from '@/lib/mockData/mockProCards';

export default function BusinessList() {
  const { activeCategory, searchQuery } = useCategory();

  // Filter businesses based on active category and search query
  const filteredCards = useMemo(() => {
    return filterBusinesses(sampleProCards, activeCategory, searchQuery);
  }, [activeCategory, searchQuery]);

  return (
    <div className="w-full">
      {filteredCards.length === 0 ? (
        <div className="w-full py-12 text-center">
          <p className="text-gray-600 text-lg">
            {searchQuery 
              ? `No businesses found matching "${searchQuery}"`
              : 'No businesses found in this category'}
          </p>
        </div>
      ) : (
        <ProCardGrid cards={filteredCards} />
      )}
    </div>
  );
}
