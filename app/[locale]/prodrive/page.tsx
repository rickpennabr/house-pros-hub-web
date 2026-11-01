'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { ToolPage } from '@/components/pageslayout/ToolPage';
import { ProDriveBrowser } from '@/components/drive/ProDriveBrowser';
import { createSignInUrl } from '@/lib/redirect';
import type { Locale } from '@/i18n';
import type { DriveOwnerType } from '@/lib/drive/types';

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
  const ownerId = ownerType === 'user' ? user?.id ?? '' : businessOwnerId;

  useEffect(() => {
    if (!user) return;
    void fetch('/api/prodrive/businesses', { credentials: 'include' })
      .then((response) => response.json())
      .then((body: { businesses?: BusinessOption[] }) => setBusinesses(body.businesses ?? []))
      .catch(() => setBusinesses([]));
  }, [user]);

  return (
    <ToolPage title={t('title')}>
      {isLoading ? (
        <p>{t('loading')}</p>
      ) : !isAuthenticated || !user ? (
        <a className="underline" href={createSignInUrl(locale, `/${locale}/prodrive`)}>{t('signIn')}</a>
      ) : (
        <div className="space-y-4">
          {businesses.length > 0 && (
            <select
              className="border-2 border-black rounded-lg px-3 py-2 text-sm"
              value={ownerType === 'user' ? 'user' : ownerId}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'user') {
                  setOwnerType('user');
                } else {
                  setOwnerType('business');
                  setBusinessOwnerId(value);
                }
              }}
            >
              <option value="user">{t('myDrive')}</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>{business.name}</option>
              ))}
            </select>
          )}
          {ownerId && <ProDriveBrowser key={`${ownerType}:${ownerId}`} ownerType={ownerType} ownerId={ownerId} />}
        </div>
      )}
    </ToolPage>
  );
}
