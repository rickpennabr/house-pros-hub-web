'use client';

import { Share2 } from 'lucide-react';
import { useState } from 'react';
import ShareBusinessModal from '@/components/businessdetails/ShareBusinessModal';
import { useLocale, useTranslations } from 'next-intl';
import type { PlacePro } from '@/lib/places/portal';

function ProLogo({ pro, size = 'h-11 w-11' }: { pro: PlacePro; size?: string }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black bg-white text-sm font-semibold text-black`}>
      {pro.logoUrl ? (
        // Business logos live on the public storage host.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pro.logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        pro.businessName.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

/**
 * The pros working on one of the customer's places, laid out like Account management:
 * a "Select a pro" row of chips, then "Share with a pro". One pro is always picked (its work fills every
 * tab); the other pros sit beside it, and picking one switches the filter.
 */
export function PlacePros({
  pros,
  selected,
  onSelect,
}: {
  pros: PlacePro[];
  selected: string | null;
  onSelect: (ownerId: string | null) => void;
}) {
  const t = useTranslations('places.prosSection');
  const locale = useLocale();
  const [sharing, setSharing] = useState<PlacePro | null>(null);
  const chip = (active: boolean) =>
    `relative flex shrink-0 items-center gap-2 rounded-lg border-2 px-2 py-2 transition-all cursor-pointer md:px-4 ${
      active ? 'border-black bg-black text-white' : 'border-gray-300 bg-white hover:border-black'
    }`;

  return (
    <section className="mt-2 space-y-3" aria-label={t('selectPro')}>
      <div>
        <h2 className="mb-2 text-lg font-bold text-black md:text-xl">{t('selectPro')}</h2>
        {pros.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {pros.map((pro) => {
              const active = selected === pro.ownerId;
              const pick = (
                <button
                  type="button"
                  onClick={() => onSelect(pro.ownerId)}
                  aria-pressed={active}
                  className="flex items-center gap-2 bg-transparent text-inherit"
                >
                  <ProLogo pro={pro} size="h-7 w-7" />
                  <span className="whitespace-nowrap text-sm font-medium md:text-base">{pro.businessName}</span>
                </button>
              );
              // Like Services and Images on the pro page: the picked pro carries its share icon inside.
              return active ? (
                <div key={pro.ownerId} className={`${chip(true)} gap-2`}>
                  {pick}
                  {pro.slug ? (
                    <button
                      type="button"
                      onClick={() => setSharing(pro)}
                      className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-black bg-white text-black hover:bg-gray-100"
                      aria-label={`${t('shareCard')} ${pro.businessName}`}
                      title={`${t('shareCard')} ${pro.businessName}`}
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ) : (
                <div key={pro.ownerId} className={chip(false)}>
                  {pick}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-600">{t('empty')}</p>
        )}
      </div>

      {/* Same share window as the pro's page: booking link, business page or feedback. */}
      <ShareBusinessModal
        isOpen={Boolean(sharing)}
        onClose={() => setSharing(null)}
        businessName={sharing?.businessName ?? ''}
        contractorType={sharing?.primaryTrade ?? ''}
        logo={sharing?.logoUrl ?? undefined}
        businessUrl={
          sharing?.slug && typeof window !== 'undefined'
            ? `${window.location.origin}/${locale}/business/${encodeURIComponent(sharing.slug)}`
            : ''
        }
      />
    </section>
  );
}
