'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Phone, Plus, Settings } from 'lucide-react';
import ViewToggle, { ViewType } from '@/components/pageslayout/ViewToggle';
import { RepairCameraMark } from '@/components/pageslayout/PagesMenu';
import { useProBotTransition } from '@/contexts/ProBotTransitionContext';
import { HUB_WHATSAPP_URL } from '@/lib/constants/company';

const PHONE_NUMBER = '702-232-0411';
const PROBOT_BLACKOUT_MS = 500;

interface BusinessListMobileBottomBarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  /** Signed-in contractor, realtor, or installer: ProBot, job camera, then Add. */
  showProAdd?: boolean;
  /** Signed-in users get a settings button that opens Account Management. */
  signedIn?: boolean;
  addOpen?: boolean;
  onAdd?: () => void;
  addLabel?: string;
  onJobCamera?: () => void;
  jobCameraLabel?: string;
}

/**
 * Mobile-only bottom bar on the business list (HousePros) page.
 * Guests: two view buttons, then ProBot, WhatsApp, and Phone.
 * Signed-in users also get a settings button that opens Account Management.
 * Signed-in pros: two view buttons, then ProBot, call, camera, Add, and settings.
 */
export default function BusinessListMobileBottomBar({
  currentView,
  onViewChange,
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
  const { setTransitioningToProbot } = useProBotTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleProBotClick = useCallback(() => {
    setTransitioningToProbot(true);
    setTimeout(() => {
      router.push(`/${locale}/probot`);
    }, PROBOT_BLACKOUT_MS);
  }, [locale, router, setTransitioningToProbot]);

  const handlePhoneClick = () => {
    window.location.href = `tel:${PHONE_NUMBER.replace(/-/g, '')}`;
  };

  const settingsButton = signedIn ? (
    <button
      type="button"
      onClick={() => router.push(`/${locale}/account-management`)}
      className="flex h-11 w-11 min-h-[2.75rem] min-w-[2.75rem] shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white text-black transition-colors hover:bg-gray-50"
      aria-label={tAccount('accountManagement')}
    >
      <Settings className="h-5 w-5" />
    </button>
  ) : null;

  const barEl = (
    <div
      className="fixed bottom-0 left-2 right-2 z-[100] flex items-center py-2 px-3 min-h-[60px] bg-black border-t-2 border-black rounded-t-lg rounded-b-lg shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
      role="toolbar"
      aria-label="View, ProBot, contact"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Pros: two buttons only. Guests: two of the five equal slots. */}
      <div className={showProAdd
        ? 'flex shrink-0 items-center pr-2'
        : 'flex min-w-0 flex-[2] items-center'}>
        <ViewToggle currentView={currentView} onViewChange={onViewChange} embedded fitContent={showProAdd} />
      </div>

      {/* Center white vertical divider */}
      <div className="h-11 w-px flex-shrink-0 bg-white opacity-90" aria-hidden />

      {showProAdd ? (
        <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5 pl-2">
          <div className="relative flex shrink-0 items-center justify-center">
            <span
              className="beta-badge-dynamic absolute -top-[10px] -right-2 z-10 rounded border border-black px-0.5 text-[9px] font-bold text-black shadow"
              aria-hidden
            >
              Beta
            </span>
            <button
              type="button"
              onClick={handleProBotClick}
              className="flex h-11 w-11 min-h-[2.75rem] min-w-[2.75rem] items-center justify-center overflow-hidden rounded-lg border-2 border-white bg-black transition-all hover:opacity-90 active:scale-95"
              aria-label="Open ProBot"
            >
              <Image
                src="/hph-pro-bot.jpg"
                alt=""
                width={44}
                height={44}
                className="h-full w-full object-contain"
              />
            </button>
          </div>
          <button
            type="button"
            onClick={handlePhoneClick}
            className="flex h-11 w-11 min-h-[2.75rem] min-w-[2.75rem] shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white text-black transition-colors hover:bg-gray-50"
            aria-label={`Call ${PHONE_NUMBER}`}
          >
            <Phone className="h-5 w-5" />
          </button>
          <div className="relative flex shrink-0 items-center justify-center">
            <span
              className="beta-badge-dynamic absolute -top-[10px] -right-2 z-10 rounded border border-black px-0.5 text-[9px] font-bold text-black shadow"
              aria-hidden
            >
              Beta
            </span>
            <button
              type="button"
              onClick={onJobCamera}
              className="flex h-11 w-[3.25rem] shrink-0 items-center justify-center rounded-lg bg-white text-black"
              aria-label={jobCameraLabel}
            >
              <span className="relative block h-8 w-[2.6rem] overflow-hidden">
                <RepairCameraMark label="JOB" />
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="flex h-11 w-11 min-h-[2.75rem] min-w-[2.75rem] shrink-0 items-center justify-center rounded-lg border-2 border-white bg-white text-black transition-all hover:bg-gray-100 active:scale-95"
            aria-label={addLabel}
            aria-expanded={addOpen}
          >
            <Plus className={`h-5 w-5 transition-transform duration-200 ${addOpen ? 'rotate-45' : ''}`} />
          </button>
          {settingsButton}
        </div>
      ) : (
      <div className={`grid min-w-0 flex-[3] place-items-center overflow-visible ${signedIn ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <div className="relative flex shrink-0 items-center justify-center">
          <span
            className="beta-badge-dynamic absolute -top-[10px] -right-2 z-10 rounded border border-black px-0.5 text-[9px] font-bold text-black shadow"
            aria-hidden
          >
            Beta
          </span>
          <button
            type="button"
            onClick={handleProBotClick}
            className="flex h-11 w-11 min-h-[2.75rem] min-w-[2.75rem] items-center justify-center overflow-hidden rounded-lg border-2 border-white bg-black transition-all hover:opacity-90 active:scale-95"
            aria-label="Open ProBot"
          >
            <Image
              src="/hph-pro-bot.jpg"
              alt=""
              width={44}
              height={44}
              className="h-full w-full object-contain"
            />
          </button>
        </div>

        {HUB_WHATSAPP_URL ? (
          <a
            href={HUB_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 w-11 min-h-[2.75rem] min-w-[2.75rem] shrink-0 items-center justify-center rounded-lg border-2 border-white bg-[#25D366] text-white transition-colors hover:bg-[#20bd5a]"
            aria-label="WhatsApp"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </a>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={handlePhoneClick}
          className="flex h-11 w-11 min-h-[2.75rem] min-w-[2.75rem] shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white text-black transition-colors hover:bg-gray-50"
          aria-label={`Call ${PHONE_NUMBER}`}
        >
            <Phone className="h-5 w-5" />
          </button>
        {settingsButton}
      </div>
      )}
    </div>
  );

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(barEl, document.body);
}
