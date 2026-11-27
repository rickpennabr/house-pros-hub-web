'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountSwitch } from '@/contexts/AccountSwitchContext';
import LoadingFallback from '@/components/ui/LoadingFallback';
import { ProBillboardManager } from '@/components/billboard/ProBillboardManager';

function ProBillboardPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('proBillboard');
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const { businesses, businessesLoading, activeAccountId, setActiveAccountId } = useAccountSwitch();
  const requestedId = searchParams.get('businessId') || activeAccountId;
  const business = businesses.find((item) => item.id === requestedId);

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/${locale}`);
  }, [isLoading, user, router, locale]);

  useEffect(() => {
    if (business && activeAccountId !== business.id) setActiveAccountId(business.id);
  }, [business, activeAccountId, setActiveAccountId]);

  if (isLoading || !user || businessesLoading) return <LoadingFallback />;

  if (!business) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-sm text-gray-700">{t('pickBusiness')}</p>
        <Link href={`/${locale}/account-management`} className="inline-flex cursor-pointer rounded-lg border-2 border-black px-3 py-2 text-sm font-medium text-black hover:bg-gray-50">
          {t('pickBusinessAction')}
        </Link>
      </div>
    );
  }

  return (
    <ProBillboardManager
      businessId={business.id}
      businessName={business.businessName}
      publicHref={`/${locale}/business/${business.slug || business.id}`}
      tradeHints={[
        business.proTrade,
        ...(business.trades ?? []),
        business.category,
        ...(business.licenses ?? []).flatMap((license) => [license.tradeName, license.license]),
        ...(business.services ?? []),
      ]}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProBillboardPage />
    </Suspense>
  );
}
