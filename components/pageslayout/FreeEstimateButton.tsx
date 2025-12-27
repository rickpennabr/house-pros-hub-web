'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function FreeEstimateButton() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('common');
  const { isAuthenticated } = useAuth();

  const handleClick = () => {
    // If authenticated, go directly to estimate page
    if (isAuthenticated) {
      router.push(`/${locale}/estimate`);
    } else {
      // If not authenticated, go to signup and skip role selection, go directly to form as customer
      router.push(`/${locale}/signup?skipRoleSelection=true&role=customer`);
    }
  };

  return (
    <button
      onClick={handleClick}
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
    </button>
  );
}
