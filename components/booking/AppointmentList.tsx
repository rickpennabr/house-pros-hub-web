'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { createSignInUrl } from '@/lib/redirect';
import { Button } from '@/components/ui/Button';
import type { Locale } from '@/i18n';

interface AppointmentRow {
  token: string;
  businessName: string;
  serviceName: string | null;
  startAt: string;
  endAt: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  timezone: string;
  canChange: boolean;
}

export default function AppointmentList() {
  const t = useTranslations('appointments');
  const locale = useLocale() as Locale;
  const { isAuthenticated, isLoading } = useAuth();
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/appointments', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error || t('loadFailed'));
        setLoading(false);
        return;
      }
      setRows(data.appointments ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, t]);

  if (isLoading || (isAuthenticated && loading)) {
    return <p className="p-4 text-sm text-gray-600">{t('loading')}</p>;
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg space-y-3 p-4">
        <p className="text-sm text-gray-700">{t('signIn')}</p>
        <Link href={createSignInUrl(locale, '/appointments')}>
          <Button type="button" size="sm" variant="primary">{t('signInAction')}</Button>
        </Link>
      </div>
    );
  }

  const upcoming = rows.filter((row) => row.status === 'confirmed' && Date.parse(row.endAt) >= Date.now());
  const earlier = rows.filter((row) => !upcoming.includes(row));

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 p-4">
      <p className="text-sm text-gray-600">{t('subtitle')}</p>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {rows.length === 0 && !error && <p className="text-sm text-gray-700">{t('empty')}</p>}
      <AppointmentGroup title={t('upcoming')} rows={upcoming} locale={locale} />
      <AppointmentGroup title={t('earlier')} rows={earlier} locale={locale} />
    </div>
  );
}

function AppointmentGroup({ title, rows, locale }: { title: string; rows: AppointmentRow[]; locale: string }) {
  const t = useTranslations('appointments');
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">{title}</h2>
      <ul className="space-y-2">
        {rows.map((row) => {
          const when = new Date(row.startAt).toLocaleString(locale, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: row.timezone,
          });
          const status = row.status === 'cancelled' ? t('cancelled') : row.status === 'completed' ? t('completed') : t('confirmed');
          return (
            <li key={row.token}>
              <Link
                href={`/${locale}/appointments/${row.token}`}
                className="block rounded-lg border-2 border-black bg-white p-3 hover:bg-gray-50"
              >
                <p className="font-semibold text-black">{row.businessName}</p>
                <p className="text-sm text-gray-700">{when}</p>
                {row.serviceName && <p className="text-sm text-gray-600">{row.serviceName}</p>}
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">{status}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
