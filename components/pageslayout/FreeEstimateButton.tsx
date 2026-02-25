'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { createSignUpUrl } from '@/lib/redirect';

/** Links to sign-up (if not logged in) or the Free Estimate form (if logged in). Return URL is set so after sign-up user lands on estimate. */
export default function FreeEstimateButton() {
  const t = useTranslations('common');
  const locale = useLocale();
  const { isAuthenticated, isLoading } = useAuth();

  const href = !isLoading && isAuthenticated
    ? `/${locale}/estimate`
    : createSignUpUrl(locale as 'en' | 'es', 'estimate');

  return (
    <Link
      href={href}
      className="
        relative h-10 px-2 
        bg-black text-white 
        rounded-lg border-2 border-black 
        font-bold text-[11px] md:text-[13px]
        flex items-center justify-center
        cursor-pointer overflow-hidden
        transition-all duration-300
        hover:bg-gray-900 
        active:scale-95
      "
    >
      <span className="whitespace-nowrap tracking-wider">{t('button.freeEstimate')}</span>
    </Link>
  );
}
