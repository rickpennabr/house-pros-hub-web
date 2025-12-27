'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { businessStorage } from '@/lib/storage/businessStorage';
import { savedBusinessStorage } from '@/lib/storage/savedBusinessStorage';
import { ProCardData } from '@/components/proscard/ProCard';
import ProCard from '@/components/proscard/ProCard';
import { Minus, Bookmark, Settings } from 'lucide-react';
import { Breadcrumb } from '@/components/ui/Breadcrumb';

export default function SavedBusinessesPage() {
  const locale = useLocale();
  const t = useTranslations('savedBusinesses');
  const tAccount = useTranslations('accountManagement');
  const { user } = useAuth();
  const [, setRefresh] = useState(0);

  const savedBusinesses: ProCardData[] = (() => {
    if (!user?.id) return [];

    const savedBusinessIds = savedBusinessStorage.getSavedBusinessIds(user.id);
    const allBusinesses = businessStorage.getAllBusinesses();

    // Filter businesses that are saved by this user
    return allBusinesses.filter((business) => savedBusinessIds.includes(business.id));
  })();

  const handleRemove = (businessId: string) => {
    if (user?.id && confirm(t('removeConfirm'))) {
      savedBusinessStorage.removeSavedBusiness(user.id, businessId);
      setRefresh((v) => v + 1);
    }
  };

  const handleShare = () => {
    // Share functionality can be handled by ProCard's built-in share
  };

  const handleReaction = (businessId: string, type: 'love' | 'feedback' | 'link' | 'save') => {
    if (type === 'save' && user?.id) {
      // Toggle save status
      const isSaved = savedBusinessStorage.isBusinessSaved(user.id, businessId);
      if (isSaved) {
        savedBusinessStorage.removeSavedBusiness(user.id, businessId);
      } else {
        savedBusinessStorage.saveBusiness(user.id, businessId);
      }

      setRefresh((v) => v + 1);
    }
  };

  return (
    <div className="bg-white">
      {/* Main Content */}
      <div className="w-full max-w-[960px] mx-auto p-2 md:p-2 py-2 md:py-4">
        {/* Breadcrumbs */}
        <Breadcrumb 
          items={[
            { label: tAccount('title'), href: '/account-management', icon: Settings },
            { label: t('title'), icon: Bookmark }
          ]}
        />
        {/* Page Title & Summary */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-black mb-2">
            {t('pageTitle')}
          </h1>
          <p className="text-base md:text-lg text-gray-600">
            {t('businessesSaved', { count: savedBusinesses.length })}
          </p>
        </div>

        {/* Business Cards Grid */}
        {savedBusinesses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {savedBusinesses.map((business) => (
              <div key={business.id} className="relative group">
                {/* Remove Button - Top Right */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleRemove(business.id);
                  }}
                  className="absolute -top-2 -right-2 z-20 w-8 h-8 rounded-full bg-red-500 border-2 border-white flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors shadow-lg"
                  aria-label={t('removeFromSaved')}
                >
                  <Minus className="w-5 h-5 text-white" />
                </button>

                {/* ProCard with custom handlers */}
                <ProCard
                  data={business}
                  onShare={() => handleShare()}
                  onReaction={(id, type) => handleReaction(id, type)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg text-gray-600 mb-4">{t('noSavedBusinesses')}</p>
            <Link
              href={`/${locale}`}
              className="inline-block px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              {t('browseBusinesses')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
