'use client';

import { useTranslations } from 'next-intl';
import { openQuickRepairCamera } from '@/lib/media/quick-repair-camera';

export function ProCamHeaderButton() {
  const t = useTranslations('procam');
  return (
    <button
      type="button"
      onClick={() => openQuickRepairCamera()}
      aria-label={t('headerLabel')}
      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border-2 border-black bg-white text-black transition-colors hover:bg-gray-50"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <rect x="2" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="10" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 6l1.2-2h3.6L13 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="18.5" cy="16.5" r="4.2" fill="white" stroke="currentColor" strokeWidth="1.6" />
        <text x="18.5" y="18.2" textAnchor="middle" fontSize="6" fontWeight="700" fill="currentColor">$</text>
      </svg>
    </button>
  );
}
