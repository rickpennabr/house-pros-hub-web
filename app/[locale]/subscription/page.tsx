'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { ToolPage } from '@/components/pageslayout/ToolPage';
import { ProDriveMeter } from '@/components/drive/ProDriveMeter';
import { Button } from '@/components/ui/Button';
import { createSignInUrl } from '@/lib/redirect';
import { formatDriveBytes } from '@/lib/drive/quota';
import type { DriveUsage } from '@/lib/drive/types';
import type { Locale } from '@/i18n';

function SubscriptionBody() {
  const t = useTranslations('subscription');
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const [usage, setUsage] = useState<DriveUsage | null>(null);
  const [busy, setBusy] = useState<'pro' | 'overage' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = searchParams.get('status');

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetch('/api/prodrive/usage', { credentials: 'include' })
      .then((response) => response.json())
      .then((body: { usage?: DriveUsage }) => setUsage(body.usage ?? null))
      .catch(() => setUsage(null));
  }, [isAuthenticated]);

  const start = async (path: string, kind: 'pro' | 'overage') => {
    setBusy(kind);
    setError(null);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ locale }),
      });
      const body = (await response.json()) as { url?: string; error?: string; alreadyEnabled?: boolean };
      if (!response.ok) throw new Error(body.error || t('billingFailed'));
      if (body.url) window.location.href = body.url;
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : t('billingFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ToolPage title={t('title')}>
      {isLoading ? null : !isAuthenticated ? (
        <a className="underline" href={createSignInUrl(locale, `/${locale}/subscription`)}>{t('signIn')}</a>
      ) : (
        <div className="space-y-4 max-w-lg">
          {status === 'success' && <p className="text-sm">{t('success')}</p>}
          {status === 'cancel' && <p className="text-sm">{t('cancel')}</p>}
          {status === 'overage' && <p className="text-sm">{t('overageSuccess')}</p>}
          <p className="font-medium">
            {t('currentPlan')}: {usage?.plan === 'pro' ? t('pro') : t('free')}
          </p>
          <ProDriveMeter usage={usage} />
          {usage && (
            <p className="text-sm text-gray-700">
              {formatDriveBytes(usage.usedBytes)} / {formatDriveBytes(usage.freeBytes)}. {usage.overageEnabled ? t('overageOn') : t('overageOff')}
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-col gap-2">
            {usage?.plan !== 'pro' && (
              <Button type="button" disabled={busy !== null} onClick={() => start('/api/billing/create-subscription', 'pro')}>
                {busy === 'pro' ? t('openingCheckout') : t('upgrade')}
              </Button>
            )}
            {usage && !usage.overageEnabled && (
              <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => start('/api/billing/create-drive-overage', 'overage')}>
                {busy === 'overage' ? t('openingCheckout') : t('enableOverage')}
              </Button>
            )}
          </div>
        </div>
      )}
    </ToolPage>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense>
      <SubscriptionBody />
    </Suspense>
  );
}
