'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  CalendarCheck,
  Camera,
  Check,
  CheckCircle2,
  EyeOff,
  FileText,
  Hammer,
  MessageSquareQuote,
  MoreHorizontal,
  Send,
  Trash2,
  UserPlus,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import ProCard from '@/components/proscard/ProCard';
import type { HubFeedKind } from '@/lib/types/supabase';
import type { FeedItem } from '@/lib/feed/types';

const KIND_ICON: Record<HubFeedKind, LucideIcon> = {
  member_joined: UserPlus,
  pro_joined: Hammer,
  estimate_requested: FileText,
  fix_requested: Wrench,
  estimate_sent: Send,
  estimate_approved: CheckCircle2,
  project_scheduled: CalendarCheck,
  project_photos: Camera,
  feedback_left: MessageSquareQuote,
};

/** Kinds where the actor (left side) is a customer, so a missing name reads "A customer in {city}". */
const CUSTOMER_ACTOR: HubFeedKind[] = ['member_joined', 'estimate_requested', 'fix_requested', 'estimate_approved', 'feedback_left'];
/** Kinds where the target (right side) is a customer. */
const CUSTOMER_TARGET: HubFeedKind[] = ['estimate_sent', 'project_scheduled', 'project_photos'];

function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

/** "2 hours ago", "3 days ago": always relative, like BrazaFeed. */
export function feedRelativeTime(iso: string, locale: string): string {
  const diffSec = Math.round((Date.parse(iso) - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(diffSec);
  if (abs < 45) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 86400 * 35) return rtf.format(Math.round(diffSec / (86400 * 7)), 'week');
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), 'month');
  return rtf.format(Math.round(diffSec / (86400 * 365)), 'year');
}

/** Words the search box matches against. */
export function feedItemSearchText(item: FeedItem): string {
  return [item.actorName, item.targetName, item.city, item.serviceLabel, item.excerpt, item.business?.name, item.card?.proTrade]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function PostOptions({
  item,
  isAdmin,
  busy,
  onVisibility,
}: {
  item: FeedItem;
  isAdmin: boolean;
  busy: boolean;
  onVisibility: (item: FeedItem, visibility: 'public' | 'hidden') => void;
}) {
  const t = useTranslations('feed');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pending = item.visibility === 'pending';
  const actions: Array<{ key: string; label: string; icon: LucideIcon; tone: string; run: () => void }> = [];
  if (isAdmin && pending) {
    actions.push({ key: 'approve', label: t('approve'), icon: Check, tone: 'text-green-700', run: () => onVisibility(item, 'public') });
  }
  if (isAdmin) {
    actions.push({ key: 'hide', label: t('hide'), icon: EyeOff, tone: 'text-black', run: () => onVisibility(item, 'hidden') });
  } else if (item.canRemove) {
    actions.push({ key: 'remove', label: t('remove'), icon: Trash2, tone: 'text-red-600', run: () => onVisibility(item, 'hidden') });
  }
  if (actions.length === 0) return null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-black disabled:opacity-50"
        aria-label={t('options')}
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-7 z-40 w-max min-w-[11rem] rounded-lg border-2 border-black bg-white p-1 shadow-lg" role="menu">
          {actions.map(({ key, label, icon: Icon, tone, run }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                run();
              }}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold hover:bg-gray-100 ${tone}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Compact activity card: avatar, sentence, quote, photos, and the Book button. */
function ActivityCard({ item, onOpenPhoto }: { item: FeedItem; onOpenPhoto: (item: FeedItem, index: number) => void }) {
  const t = useTranslations('feed');
  const locale = useLocale();

  const customerFallback = item.city ? t('aCustomerIn', { city: item.city }) : t('aCustomer');
  const actor =
    item.actorName || (CUSTOMER_ACTOR.includes(item.kind) ? customerFallback : item.kind === 'pro_joined' ? t('aPro') : t('someone'));
  const target =
    item.targetName ||
    (CUSTOMER_TARGET.includes(item.kind)
      ? customerFallback.charAt(0).toLocaleLowerCase(locale) + customerFallback.slice(1)
      : t('aPro'));

  let messageKey: string = item.kind;
  if (item.kind === 'project_photos') {
    messageKey = item.photoSingleDay
      ? 'project_photos'
      : item.photoDayNo === 1
        ? 'project_photos_first'
        : item.photoDayNo
          ? 'project_photos_day'
          : 'project_photos';
  }
  const date = item.eventDate
    ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${item.eventDate}T12:00:00Z`))
    : '';
  const sentence = t.rich(`items.${messageKey}`, {
    actor,
    target,
    date,
    day: item.photoDayNo ?? 1,
    b: (chunks) => <strong className="font-semibold text-black">{chunks}</strong>,
  });

  // The avatar belongs to whoever acts; a customer acting shows their initials.
  const showLogo = !!item.actorAvatar && !(item.kind === 'estimate_approved' || item.kind === 'feedback_left');
  const Icon = KIND_ICON[item.kind];
  const href = item.business ? `/${locale}/business/${item.business.slug}` : null;

  return (
    <div className="relative isolate rounded-lg border-2 border-black bg-white p-3 transition-colors sm:hover:bg-gray-50">
      {/* The whole card opens the pro's page, like a BrazaFeed post. Buttons sit above this link. */}
      {href ? <Link href={href} className="absolute inset-0 z-0 rounded-lg" aria-label={item.business?.name ?? ''} /> : null}

      <div className="pointer-events-none relative flex items-start gap-3">
        <div className="relative shrink-0">
          {showLogo ? (
            <Image
              src={item.actorAvatar as string}
              alt=""
              width={48}
              height={48}
              unoptimized
              className="h-12 w-12 rounded-lg border-2 border-black bg-white object-cover"
            />
          ) : (
            <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-lg bg-black text-sm font-bold text-white">
              {initials(actor)}
            </span>
          )}
          <span aria-hidden className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-md border border-black bg-white">
            <Icon className="h-3 w-3 text-red-500" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug text-gray-800">{sentence}</p>
          {item.serviceLabel ? <p className="mt-0.5 text-sm font-semibold text-green-700">{item.serviceLabel}</p> : null}
          {item.excerpt ? (
            <blockquote className="mt-2 rounded-lg border-l-4 border-red-500 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              “{item.excerpt}”
            </blockquote>
          ) : null}
        </div>
      </div>

      {item.photos.length > 0 ? (
        <div className={`relative mt-2 grid gap-1.5 ${item.photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {item.photos.slice(0, 4).map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => onOpenPhoto(item, index)}
              className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg border border-black/20 bg-gray-100"
              aria-label={t('photoAlt', { n: index + 1 })}
            >
              <Image src={src} alt="" fill unoptimized sizes="(min-width: 640px) 290px, 50vw" className="object-cover" />
              {index === 3 && item.photos.length > 4 ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-bold text-white">
                  +{item.photos.length - 4}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {item.business && item.kind !== 'member_joined' ? (
        <div className="relative mt-2 flex justify-end">
          <Link
            href={`/${locale}/book/${item.business.slug}`}
            className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
          >
            {t('bookPro')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One feed post, BrazaFeed style: a thin line on top (type · city · time · options),
 * then the card. New pros show the same ProCard as the HousePros directory.
 */
export function FeedPost({
  item,
  isAdmin,
  busy,
  onVisibility,
  onOpenPhoto,
}: {
  item: FeedItem;
  isAdmin: boolean;
  busy: boolean;
  onVisibility: (item: FeedItem, visibility: 'public' | 'hidden') => void;
  onOpenPhoto: (item: FeedItem, index: number) => void;
}) {
  const t = useTranslations('feed');
  const locale = useLocale();
  const pending = item.visibility === 'pending';

  return (
    <article className={pending ? 'rounded-lg bg-amber-50 p-1 outline-2 outline-dashed outline-amber-500' : ''}>
      <div className="relative z-20 flex h-6 items-center gap-2 px-1">
        <div className="flex h-full min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-xs leading-none text-gray-500">
          <span className="shrink-0 font-semibold text-red-500">{t(`types.${item.kind}`)}</span>
          {item.city ? (
            <>
              <span className="shrink-0 text-gray-400" aria-hidden>·</span>
              <span className="truncate font-medium text-gray-600">{item.city}</span>
            </>
          ) : null}
          <span className="shrink-0 text-gray-400" aria-hidden>·</span>
          <time dateTime={item.occurredAt} className="shrink-0 tabular-nums" suppressHydrationWarning>
            {feedRelativeTime(item.occurredAt, locale)}
          </time>
          {pending ? (
            <span className="ml-1 shrink-0 rounded-md bg-amber-200 px-1.5 py-0.5 font-semibold text-amber-900">{t('pending')}</span>
          ) : null}
        </div>
        <PostOptions item={item} isAdmin={isAdmin} busy={busy} onVisibility={onVisibility} />
      </div>

      {item.card ? (
        <ProCard data={item.card} href={`/${locale}/business/${item.card.slug || item.card.id}`} pickOnly />
      ) : (
        <ActivityCard item={item} onOpenPhoto={onOpenPhoto} />
      )}
    </article>
  );
}
