'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Home as HomeIcon } from 'lucide-react';
import type { ChatDocPlace } from '@/lib/types/chat';

/**
 * Chat bubbles that carry a document card use this width, so estimates, invoices,
 * calendars and places all line up. Phones get 85% of the thread.
 */
export const CHAT_DOC_BUBBLE_WIDTH = 'w-[25rem] max-w-[85%]';

export type ChatDocTone = 'estimate' | 'invoice' | 'payment' | 'calendar' | 'place';

/** Same frame for every document; the color strip and icon tile tell them apart. */
const TONES: Record<ChatDocTone, { bar: string; tile: string; eyebrow: string }> = {
  estimate: { bar: 'bg-sky-500', tile: 'bg-sky-50 text-sky-700', eyebrow: 'text-sky-700' },
  invoice: { bar: 'bg-amber-500', tile: 'bg-amber-50 text-amber-700', eyebrow: 'text-amber-700' },
  payment: { bar: 'bg-emerald-500', tile: 'bg-emerald-50 text-emerald-700', eyebrow: 'text-emerald-700' },
  calendar: { bar: 'bg-red-500', tile: 'bg-red-50 text-red-600', eyebrow: 'text-red-600' },
  place: { bar: 'bg-violet-500', tile: 'bg-violet-50 text-violet-700', eyebrow: 'text-violet-700' },
};

interface ChatDocCardProps {
  tone: ChatDocTone;
  icon: ReactNode;
  /** Business logo; replaces the icon tile when set. */
  logoUrl?: string | null;
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  amountLabel?: string;
  amount?: string | null;
  children?: ReactNode;
}

export default function ChatDocCard({
  tone,
  icon,
  logoUrl,
  eyebrow,
  title,
  subtitle,
  amountLabel,
  amount,
  children,
}: ChatDocCardProps) {
  const style = TONES[tone];
  return (
    <div className="mt-2 w-full overflow-hidden rounded-2xl border-2 border-black bg-white text-gray-900 shadow-sm">
      <div className={`h-1 ${style.bar}`} aria-hidden />
      <div className="flex items-start gap-3 px-3 py-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 ${
            logoUrl ? 'bg-white' : style.tile
          }`}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- chat card; remote business logos
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            icon
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[11px] font-semibold uppercase tracking-wide ${style.eyebrow}`}>{eyebrow}</p>
          <p className="truncate text-sm font-semibold">{title}</p>
          {subtitle ? <p className="truncate text-xs text-gray-500">{subtitle}</p> : null}
        </div>
        {amount ? (
          <div className="shrink-0 text-right">
            {amountLabel ? <p className="text-[11px] uppercase text-gray-500">{amountLabel}</p> : null}
            <p className="text-base font-bold">{amount}</p>
          </div>
        ) : null}
      </div>
      {children ? <div className="border-t border-gray-100">{children}</div> : null}
    </div>
  );
}

/** Where the document landed in the customer's My Places. The customer can open it. */
export function ChatDocPlaceNote({ place, canOpen }: { place?: ChatDocPlace | null; canOpen: boolean }) {
  const t = useTranslations('probot');
  const locale = useLocale();
  if (!place) return null;
  const label = canOpen ? t('crmDocOnPlace', { place: place.name }) : t('crmDocOnPlacePro', { place: place.name });
  return canOpen ? (
    <Link
      href={`/${locale}/myplaces/${place.id}`}
      className="flex items-center justify-center gap-1.5 text-xs font-medium text-violet-700 underline hover:no-underline"
    >
      <HomeIcon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Link>
  ) : (
    <p className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
      <HomeIcon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </p>
  );
}
