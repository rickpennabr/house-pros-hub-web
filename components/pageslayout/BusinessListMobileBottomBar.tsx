'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { Phone } from 'lucide-react';
import ViewToggle, { ViewType } from '@/components/pageslayout/ViewToggle';
import { useProBotTransition } from '@/contexts/ProBotTransitionContext';
import { HUB_WHATSAPP_URL } from '@/lib/constants/company';

const PHONE_NUMBER = '702-232-0411';
const BLACKOUT_MS = 500;

interface BusinessListMobileBottomBarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

/**
 * Mobile-only bottom bar on the business list (HousePros) page.
 * Left: view toggle (card/list + day cycle). Right: ProBot, WhatsApp, Phone (mobile-only; header hides these on mobile).
 * Rendered via portal to document.body so it stays fixed to the viewport (not the scroll container).
 */
export default function BusinessListMobileBottomBar({
  currentView,
  onViewChange,
}: BusinessListMobileBottomBarProps) {
  const router = useRouter();
  const locale = useLocale();
  const { setTransitioningToProbot } = useProBotTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleProBotClick = () => {
    setTransitioningToProbot(true);
    setTimeout(() => {
      router.push(`/${locale}/probot`);
    }, BLACKOUT_MS);
  };

  const handlePhoneClick = () => {
    window.location.href = `tel:${PHONE_NUMBER.replace(/-/g, '')}`;
  };

  const barEl = (
    <div
      className="fixed bottom-0 left-2 right-2 z-[100] flex items-center py-2 px-3 min-h-[60px] bg-black border-t-2 border-black rounded-t-lg rounded-b-lg shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
      role="toolbar"
      aria-label="View, ProBot, contact"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Left 50%: flex container with space-between (view toggle: Card, List, Day cycle); pr-3 on mobile, pr-2 on md+ */}
      <div className="flex flex-1 min-w-0 flex-shrink-0 basis-0 items-center justify-between pr-3 md:pr-2">
        <ViewToggle currentView={currentView} onViewChange={onViewChange} embedded />
      </div>

      {/* Center white vertical divider */}
      <div className="h-11 w-px flex-shrink-0 bg-white opacity-90" aria-hidden />

      {/* Right 50%: ProBot, WhatsApp, Phone (mobile only; header shows these on desktop only) */}
      <div className="flex flex-1 min-w-0 flex-shrink-0 basis-0 items-center justify-between overflow-visible pl-3">
        {/* ProBot with Beta badge on top-right */}
        <div className="relative flex items-center justify-center shrink-0">
          <span
            className="beta-badge-dynamic absolute -top-[10px] -right-2 z-10 px-0.5 rounded text-[9px] font-bold text-black border border-black shadow"
            aria-hidden
          >
            Beta
          </span>
          <button
            type="button"
            onClick={handleProBotClick}
            className="flex items-center justify-center w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] rounded-lg border-2 border-white bg-black overflow-hidden hover:opacity-90 active:scale-95 transition-all"
            aria-label="Open ProBot"
          >
            <Image
              src="/hph-pro-bot.jpg"
              alt=""
              width={44}
              height={44}
              className="w-full h-full object-contain"
            />
          </button>
        </div>

        {/* WhatsApp */}
        {HUB_WHATSAPP_URL && (
          <a
            href={HUB_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] rounded-lg border-2 border-white bg-[#25D366] flex items-center justify-center text-white hover:bg-[#20bd5a] transition-colors shrink-0"
            aria-label="WhatsApp"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </a>
        )}

        {/* Phone */}
        <button
          type="button"
          onClick={handlePhoneClick}
          className="w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] rounded-lg border-2 border-black bg-white text-black flex items-center justify-center hover:bg-gray-50 transition-colors shrink-0"
          aria-label={`Call ${PHONE_NUMBER}`}
        >
          <Phone className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(barEl, document.body);
}
