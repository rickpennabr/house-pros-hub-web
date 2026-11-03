'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { ProDriveBrowser } from '@/components/drive/ProDriveBrowser';
import { ProDriveWorkspace } from '@/components/drive/ProDriveWorkspace';
import { createSignInUrl } from '@/lib/redirect';
import type { Locale } from '@/i18n';
import type { DriveOwnerType, DriveUsage } from '@/lib/drive/types';

interface BusinessOption {
  id: string;
  name: string;
}

export default function ProDrivePage() {
  const t = useTranslations('prodrive');
  const locale = useLocale() as Locale;
  const { user, isAuthenticated, isLoading } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [ownerType, setOwnerType] = useState<DriveOwnerType>('user');
  const [businessOwnerId, setBusinessOwnerId] = useState('');
  const [usage, setUsage] = useState<DriveUsage | null>(null);
  const [query, setQuery] = useState('');
  const ownerId = ownerType === 'user' ? user?.id ?? '' : businessOwnerId;
  const onUsageChange = useCallback((next: DriveUsage | null) => setUsage(next), []);

  useEffect(() => {
    if (!user) return;
    void fetch('/api/prodrive/businesses', { credentials: 'include' })
      .then((response) => response.json())
      .then((body: { businesses?: BusinessOption[] }) => setBusinesses(body.businesses ?? []))
      .catch(() => setBusinesses([]));
  }, [user]);

  const signedIn = !isLoading && isAuthenticated && !!user;

  return (
    <ProDriveWorkspace
      locale={locale}
      businesses={businesses}
      ownerType={ownerType}
      ownerId={ownerId}
      usage={usage}
      query={query}
      onQueryChange={setQuery}
      showNavigation={signedIn}
      onOwnerChange={(nextType, nextId) => {
        setQuery('');
        setUsage(null);
        if (nextType === 'user') {
          setOwnerType('user');
          setBusinessOwnerId('');
        } else {
          setOwnerType('business');
          setBusinessOwnerId(nextId);
        }
      }}
    >
      {isLoading ? (
        <p className="px-4 py-6 text-sm md:px-6">{t('loading')}</p>
      ) : !signedIn ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <a className="text-lg font-medium underline" href={createSignInUrl(locale, `/${locale}/prodrive`)}>
            {t('signIn')}
          </a>
        </div>
      ) : ownerId ? (
        <ProDriveBrowser
          key={`${ownerType}:${ownerId}`}
          variant="workspace"
          ownerType={ownerType}
          ownerId={ownerId}
          filterQuery={query}
          onUsageChange={onUsageChange}
        />
      ) : null}
    </ProDriveWorkspace>
  );
}
