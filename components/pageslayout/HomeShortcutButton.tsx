'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Home } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountSwitch } from '@/contexts/AccountSwitchContext';
import { NotificationCount } from '@/components/ui/NotificationCount';

/**
 * Where the house goes, following the active profile (the account switcher in the profile menu):
 * a business profile opens the Customer portal with new customer activity; the personal profile
 * opens My Places with new updates from pros. Counts refresh when the app comes back and every minute.
 */
export function useHomeShortcut(): { signedIn: boolean; business: boolean; label: string; href: string; count: number } {
  const t = useTranslations('common.account');
  const { user, isAdmin } = useAuth();
  const { activeAccount, activeAccountId } = useAccountSwitch();
  const business =
    !isAdmin && (activeAccount?.type === 'business' || (!!user?.id && !!activeAccountId && activeAccountId !== user.id));

  const [counts, setCounts] = useState({ crm: 0, places: 0 });
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = () =>
      void fetch('/api/activity/unread', { credentials: 'include', cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { crmTotal?: number; placesTotal?: number } | null) => {
          if (!cancelled && data) setCounts({ crm: data.crmTotal ?? 0, places: data.placesTotal ?? 0 });
        })
        .catch(() => undefined);
    load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const timer = window.setInterval(onVisible, 60_000);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(timer);
    };
  }, [user?.id]);

  return {
    signedIn: Boolean(user?.id),
    business,
    label: business ? t('customerPortal') : t('myPlaces'),
    href: business ? '/crm/portal' : '/myplaces',
    count: business ? counts.crm : counts.places,
  };
}

/** True when the active profile is a business (pro) profile, false on the personal (customer) profile. */
export function useBusinessProfileActive(): boolean {
  const { user, isAdmin } = useAuth();
  const { activeAccount, activeAccountId } = useAccountSwitch();
  return !isAdmin && (activeAccount?.type === 'business' || (!!user?.id && !!activeAccountId && activeAccountId !== user.id));
}

/** The house on the bottom bars (white square, red house icon). */
export function HomeShortcutButton({ withLabel = false }: { withLabel?: boolean }) {
  const router = useRouter();
  const locale = useLocale();
  const { signedIn, label, href, count } = useHomeShortcut();
  if (!signedIn) return null;

  return (
    <div className="relative flex shrink-0 items-center justify-center">
      <button
        type="button"
        onClick={() => router.push(`/${locale}${href}`)}
        className={`flex h-10 min-h-10 min-w-10 shrink-0 items-center justify-center gap-2 rounded-lg border-2 border-white bg-white p-0 text-red-600 transition-all hover:bg-gray-100 active:scale-95 ${
          withLabel ? 'w-10 md:w-auto md:px-3' : 'w-10'
        }`}
        aria-label={label}
        title={label}
      >
        <Home className="h-5 w-5" />
        {withLabel ? (
          <span className="hidden whitespace-nowrap text-sm font-bold tracking-wider text-black md:inline">{label}</span>
        ) : null}
      </button>
      <NotificationCount count={count} className="pointer-events-none absolute -right-2 -top-2 z-10" />
    </div>
  );
}
