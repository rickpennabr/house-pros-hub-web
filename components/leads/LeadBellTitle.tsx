'use client';

import { useTranslations } from 'next-intl';

/** "New job request" in the bell list (its own component: the admin bell renders outside next-intl). */
export function LeadBellTitle() {
  const t = useTranslations('probot');
  return <span className="block truncate text-sm font-semibold text-red-600">{t('leadEyebrow')}</span>;
}
