'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { FileText, LogIn, Phone } from 'lucide-react';
import { RepairCameraMark } from '@/components/pageslayout/PagesMenu';
import { useProBotTransition } from '@/contexts/ProBotTransitionContext';
import { HUB_WHATSAPP_URL } from '@/lib/constants/company';
import { useHomeShortcut } from '@/components/pageslayout/HomeShortcutButton';
import { HouseMark } from '@/components/icons/HouseMark';
import { NotificationCount } from '@/components/ui/NotificationCount';
import { useChatOptional } from '@/contexts/ChatContext';
import { createSignUpUrl } from '@/lib/redirect';

const PHONE_NUMBER = '702-232-0411';
const PROBOT_BLACKOUT_MS = 500;

interface BusinessListMobileBottomBarProps {
  /** Signed-in contractor, realtor, installer or handyman: Job cam on the far left. */
  showProAdd?: boolean;
  signedIn?: boolean;
  addOpen?: boolean;
  /** Opens the Add menu (CRM creates on a business profile, places and requests on a personal one). */
  onAdd?: () => void;
  addLabel?: string;
  onJobCamera?: () => void;
  jobCameraLabel?: string;
}

/**
 * The standard mobile bottom bar: black, five even spots (like Venmo), the raised house in the center.
 *
 *              | 1            | 2      | center (house)  | 4                  | 5
 *   Pro        | Job cam      | ProBot | Client portal*  | CRM* / Accounts    | Add (follows profile)
 *   Customer   | Help (chat)  | ProBot | My Places       | Accounts           | Add (place, estimate, pro)
 *   Guest      | Help (chat)  | ProBot | My Places → sign up | Sign in        | Estimate
 *   (* business profile active; on the personal profile the pro gets My Places and Accounts)
 *
 * Mobile is card view only, so there are no view buttons. Settings is in the profile menu.
 */
/** The notch: 63px opening (53px house + 5px gap each side), 44px deep (5px under the house); corners follow the house (8px + 5px gap = 13px) and the top edges curve in smoothly. */
const NOTCH_SVG = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="75" height="44"><path d="M0 0H75A6 6 0 0 0 69 6V31A13 13 0 0 1 56 44H19A13 13 0 0 1 6 31V6A6 6 0 0 0 0 0Z"/></svg>');
export const NOTCHED_BAR_MASK: import('react').CSSProperties = {
  WebkitMaskImage: `url("data:image/svg+xml,${NOTCH_SVG}"), linear-gradient(#000, #000)`,
  maskImage: `url("data:image/svg+xml,${NOTCH_SVG}"), linear-gradient(#000, #000)`,
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center top, 0 0',
  maskPosition: 'center top, 0 0',
  WebkitMaskSize: '75px 44px, 100% 100%',
  maskSize: '75px 44px, 100% 100%',
  WebkitMaskComposite: 'xor',
  maskComposite: 'exclude',
};

export default function BusinessListMobileBottomBar({
  showProAdd = false,
  signedIn = false,
  addOpen = false,
  onAdd,
  addLabel = 'Add',
  onJobCamera,
  jobCameraLabel = 'JOB',
}: BusinessListMobileBottomBarProps) {
  const router = useRouter();
  const locale = useLocale();
  const tAccount = useTranslations('common.account');
  const tBot = useTranslations('bot');
  const { setTransitioningToProbot } = useProBotTransition();
  const home = useHomeShortcut();
  const probotUnread = useChatOptional()?.chatUnreadCount ?? 0;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleProBotClick = useCallback(() => {
    setTransitioningToProbot(true);
    setTimeout(() => {
      router.push(`/${locale}/probot`);
    }, PROBOT_BLACKOUT_MS);
  }, [locale, router, setTransitioningToProbot]);

  const go = (path: string) => router.push(`/${locale}${path}`);

  const item =
    'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold leading-none text-white active:scale-95 transition-transform';
  const beta = (
    <span className="beta-badge-dynamic absolute -top-1 left-1/2 z-10 ml-1 rounded border border-black px-0.5 text-[8px] font-bold text-black" aria-hidden>
      Beta
    </span>
  );
  /** The thin white square the side icons sit in (the center house has the thick one). */
  const box = (children: ReactNode, extra = '') => (
    <span className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 border-white ${extra}`}>{children}</span>
  );

  // Spot 1: pros get the job camera; everyone else gets Help (WhatsApp, or a call when it is not set).
  const first = showProAdd ? (
    <button type="button" onClick={onJobCamera} className={item} aria-label={jobCameraLabel}>
      {beta}
      <span className="relative block h-9 w-11 overflow-hidden">
        <RepairCameraMark label="JOB" line="white" />
      </span>
      <span>Job cam</span>
    </button>
  ) : HUB_WHATSAPP_URL ? (
    <a href={HUB_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={item} aria-label="WhatsApp">
      {box(
        <svg className="h-5 w-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      )}
      <span>{tAccount('helpShort')}</span>
    </a>
  ) : (
    <a href={`tel:${PHONE_NUMBER.replace(/-/g, '')}`} className={item} aria-label={`Call ${PHONE_NUMBER}`}>
      {box(<Phone className="h-5 w-5 text-white" />)}
      <span>{tAccount('helpShort')}</span>
    </a>
  );

  const probot = (
    <button type="button" onClick={handleProBotClick} className={item} aria-label={probotUnread > 0 ? `Open ProBot, ${probotUnread} new messages` : 'Open ProBot (online)'}>
      {beta}
      <span className="relative block h-9 w-9">
        <Image src="/hph-pro-bot.jpg" alt="" width={36} height={36} className="h-9 w-9 rounded-md bg-black object-contain" />
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-black bg-green-500" aria-hidden />
        <NotificationCount count={probotUnread} className="pointer-events-none absolute -left-2 -top-2 z-10" />
      </span>
      <span>ProBot</span>
    </button>
  );

  // Center: the house follows the active profile. Guests are sent to sign up, then land on My Places.
  const homeLabel = !signedIn ? tAccount('myPlaces') : home.business ? tAccount('clientPortal') : home.label;
  const homeTarget = signedIn
    ? home.href
    : `/signup?role=customer&returnUrl=${encodeURIComponent(`/${locale}/myplaces`)}`;
  const center = (
    <button type="button" onClick={() => go(homeTarget)} className={item.replace('relative ', '')} aria-label={homeLabel}>
      {/* Raised above the other icons' line. */}
      <span className="relative z-10 -mt-[46px] -translate-y-3 flex h-[53px] w-[53px] items-center justify-center rounded-lg bg-black">
        <HouseMark variant="plain" tone="light" className="h-10 w-10" />
        {signedIn ? <NotificationCount count={home.count} className="pointer-events-none absolute -right-3 -top-3 z-10" /> : null}
      </span>
      <span className="max-w-full -translate-y-1 truncate">{homeLabel}</span>
    </button>
  );

  // Spot 4: CRM on a business profile, Account management when signed in otherwise, Sign in for guests.
  const fourth = !signedIn ? (
    <button type="button" onClick={() => go('/signin')} className={item} aria-label={tAccount('signIn')}>
      {box(<LogIn className="h-[22px] w-[22px] text-white" />)}
      <span className="max-w-full truncate">{tAccount('signIn')}</span>
    </button>
  ) : showProAdd && home.business ? (
    <button type="button" onClick={() => go('/crm')} className={item} aria-label="CRM">
      {box(<HouseMark variant="business" tone="light" className="h-[26px] w-[26px]" />)}
      <span>CRM</span>
    </button>
  ) : (
    <button type="button" onClick={() => go('/account-management')} className={item} aria-label={tAccount('manageAccounts')}>
      {box(<HouseMark variant="gear" tone="light" className="h-[26px] w-[26px]" />)}
      <span className="max-w-full truncate">{tAccount('accountsShort')}</span>
    </button>
  );

  // Spot 5: Add when signed in (the menu follows the profile); guests can request an estimate.
  const fifth = signedIn ? (
    <button type="button" onClick={onAdd} className={item} aria-label={addLabel} aria-expanded={addOpen}>
      {box(<HouseMark variant="plus" tone="light" className="h-6 w-6" />, `transition-transform duration-200 ${addOpen ? 'scale-90' : ''}`)}
      <span>{addLabel}</span>
    </button>
  ) : (
    <button
      type="button"
      // Same link as the header's Estimate button: customer sign-up, then the estimate form.
      onClick={() => router.push(`${createSignUpUrl(locale as 'en' | 'es', 'estimate')}&role=customer`)}
      className={item} aria-label={tBot('proAdd.requestEstimate')}>
      {box(<FileText className="h-[22px] w-[22px] text-white" />)}
      <span className="max-w-full truncate">{tAccount('estimateShort')}</span>
    </button>
  );

  const bar = (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[100] flex items-end px-1 pt-1.5"
      aria-label="Main menu"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Black background with a see-through notch around the raised center house (like a cut-out). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-black" style={NOTCHED_BAR_MASK} />
      {first}
      {probot}
      {center}
      {fourth}
      {fifth}
    </nav>
  );

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(bar, document.body);
}
