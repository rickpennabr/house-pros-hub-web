'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Check, CreditCard, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ToolPage } from '@/components/pageslayout/ToolPage';
import { ProDriveMeter } from '@/components/drive/ProDriveMeter';
import { Button } from '@/components/ui/Button';
import { createSignInUrl } from '@/lib/redirect';
import { formatDriveBytes } from '@/lib/drive/quota';
import type { DriveUsage } from '@/lib/drive/types';
import type { Locale } from '@/i18n';

interface PublicPlan {
  slug: string;
  name: string;
  tagline: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  includedUsers: number | null;
  extraUserPriceCents: number;
  storageGb: number;
  protradesLimit: number | null;
  trialDays: number;
  features: string[];
  highlight: boolean;
  purchasable: boolean;
  hasMonthly: boolean;
  hasYearly: boolean;
}

interface CurrentPlan {
  plan: string;
  status: string;
  interval: 'month' | 'year' | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  comped: boolean;
  hasStripe: boolean;
}

const money = (cents: number, locale: string) =>
  (cents / 100).toLocaleString(locale, { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0 });

function SubscriptionBody() {
  const t = useTranslations('subscription');
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [current, setCurrent] = useState<CurrentPlan | null>(null);
  const [usage, setUsage] = useState<DriveUsage | null>(null);
  const [interval, setBillingInterval] = useState<'month' | 'year'>('year');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const status = searchParams.get('status');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/plans', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlans(data.plans ?? []);
      setCurrent(data.current ?? null);
      if (data.current?.interval) setBillingInterval(data.current.interval);
    } catch {
      setError(t('loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetch('/api/prodrive/usage', { credentials: 'include' })
      .then((response) => response.json())
      .then((body: { usage?: DriveUsage }) => setUsage(body.usage ?? null))
      .catch(() => setUsage(null));
  }, [isAuthenticated]);

  const post = async (path: string, body: Record<string, unknown>, key: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ locale, ...body }),
      });
      const data = (await response.json()) as { url?: string; error?: string; switched?: boolean };
      if (!response.ok) throw new Error(data.error || t('billingFailed'));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.switched) {
        setNotice(t('switched'));
        void load();
      }
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : t('billingFailed'));
    } finally {
      setBusy(null);
    }
  };

  const currentPlan = plans.find((plan) => plan.slug === current?.plan);
  const anyYearly = plans.some((plan) => plan.hasYearly);

  return (
    <ToolPage title={t('title')}>
      <div className="space-y-6 pb-10">
        {status === 'success' && <p className="rounded-lg border-2 border-green-700 bg-green-50 p-3 text-sm">{t('success')}</p>}
        {status === 'cancel' && <p className="rounded-lg border-2 border-black p-3 text-sm">{t('cancel')}</p>}
        {status === 'overage' && <p className="rounded-lg border-2 border-black p-3 text-sm">{t('overageSuccess')}</p>}
        {notice && <p className="rounded-lg border-2 border-green-700 bg-green-50 p-3 text-sm">{notice}</p>}
        {error && <p className="rounded-lg border-2 border-red-600 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {current && isAuthenticated ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-black p-4">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">{t('currentPlan')}</p>
              <p className="text-xl font-bold">{currentPlan?.name ?? t('free')}</p>
              <p className="text-sm text-gray-600">
                {current.comped
                  ? current.periodEnd
                    ? t('compedUntil', { date: new Date(current.periodEnd).toLocaleDateString(locale) })
                    : t('comped')
                  : current.status === 'past_due'
                    ? t('pastDue')
                    : current.cancelAtPeriodEnd && current.periodEnd
                      ? t('endsOn', { date: new Date(current.periodEnd).toLocaleDateString(locale) })
                      : current.periodEnd && current.plan !== 'free'
                        ? t('renewsOn', { date: new Date(current.periodEnd).toLocaleDateString(locale) })
                        : null}
              </p>
            </div>
            {current.hasStripe ? (
              <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void post('/api/billing/portal', {}, 'portal')}>
                {busy === 'portal' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                {t('manageBilling')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {anyYearly ? (
          <div className="flex justify-center">
            <div className="inline-flex rounded-lg border-2 border-black p-1">
              {(['month', 'year'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBillingInterval(key)}
                  className={`cursor-pointer rounded-md px-4 py-1.5 text-sm font-semibold ${interval === key ? 'bg-black text-white' : 'text-black'}`}
                >
                  {key === 'month' ? t('monthly') : t('yearly')}
                  {key === 'year' ? <span className={`ml-1 text-xs ${interval === key ? 'text-green-300' : 'text-green-700'}`}>{t('twoMonthsFree')}</span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const isCurrent = current?.plan === plan.slug && (plan.slug === 'free' || current.interval === interval || current.comped);
            const free = plan.monthlyPriceCents === 0 && plan.yearlyPriceCents === 0;
            const canBuy = interval === 'year' ? plan.hasYearly : plan.hasMonthly;
            const price = interval === 'year' ? Math.round(plan.yearlyPriceCents / 12) : plan.monthlyPriceCents;
            return (
              <div key={plan.slug} className={`relative flex flex-col rounded-lg border-2 p-5 ${plan.highlight ? 'border-red-600' : 'border-black'}`}>
                {plan.highlight ? (
                  <span className="absolute -top-3 left-4 rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">{t('mostPopular')}</span>
                ) : null}
                <p className="text-lg font-bold">{plan.name}</p>
                <p className="min-h-[40px] text-sm text-gray-600">{plan.tagline}</p>
                <p className="mt-3 text-3xl font-bold">
                  {money(price, locale)}
                  <span className="text-sm font-normal text-gray-600">{t('perMonth')}</span>
                </p>
                <p className="min-h-[20px] text-xs text-gray-600">
                  {!free && interval === 'year' && plan.yearlyPriceCents ? t('billedYearly', { amount: money(plan.yearlyPriceCents, locale) }) : null}
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
                    {plan.includedUsers ? t('users', { count: plan.includedUsers }) : t('unlimitedUsers')}
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
                    {t('storage', { gb: plan.storageGb })}
                  </li>
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {isCurrent ? (
                    <Button type="button" variant="secondary" disabled className="w-full">
                      {t('yourPlan')}
                    </Button>
                  ) : free ? null : !isAuthenticated && !isLoading ? (
                    <a
                      href={createSignInUrl(locale, `/${locale}/subscription`)}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      {t('signInToChoose')}
                    </a>
                  ) : (
                    <Button
                      type="button"
                      className="w-full"
                      disabled={busy !== null || !canBuy || current?.comped}
                      onClick={() => void post('/api/billing/checkout', { plan: plan.slug, interval }, plan.slug)}
                    >
                      {busy === plan.slug ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {!canBuy
                        ? t('comingSoon')
                        : current && current.plan !== 'free' && current.hasStripe && !current.comped
                          ? t('switchTo', { plan: plan.name })
                          : plan.trialDays > 0
                            ? t('startTrial', { days: plan.trialDays })
                            : t('choose', { plan: plan.name })}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isAuthenticated && usage ? (
          <div className="max-w-lg space-y-2 rounded-lg border-2 border-black p-4">
            <p className="font-semibold">{t('included')}</p>
            <ProDriveMeter usage={usage} />
            <p className="text-sm text-gray-700">
              {formatDriveBytes(usage.usedBytes)} / {formatDriveBytes(usage.freeBytes)}. {usage.overageEnabled ? t('overageOn') : t('overageOff')}
            </p>
            {!usage.overageEnabled ? (
              <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void post('/api/billing/create-drive-overage', {}, 'overage')}>
                {busy === 'overage' ? t('openingCheckout') : t('enableOverage')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
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
