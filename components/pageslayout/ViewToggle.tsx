'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { List } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LuIdCard } from 'react-icons/lu';
import { useBackgroundMode } from '@/contexts/BackgroundModeContext';

export type ViewType = 'card' | 'list';

interface ViewToggleProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  /** When true, render only the toggle content (no fixed position, no portal). For use inside a bottom bar. */
  embedded?: boolean;
  /** When true (desktop only), show ProBot head on the right of the toggle with Beta badge. */
  showProBotHead?: boolean;
  /** Called when the ProBot head is clicked. Used when showProBotHead is true. */
  onProBotClick?: () => void;
}

interface ViewOption {
  type: ViewType;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
}

export default function ViewToggle({ currentView, onViewChange, embedded = false, showProBotHead = false, onProBotClick }: ViewToggleProps) {
  const t = useTranslations('common');
  const { mode, setMode } = useBackgroundMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const views: ViewOption[] = [
    {
      type: 'card',
      icon: LuIdCard,
      labelKey: 'view.card',
    },
    {
      type: 'list',
      icon: List,
      labelKey: 'view.list',
    },
  ];

  const isDynamic = mode === 'dynamic';
  const isHidden = false;

  const toggleContent = (
    <div className={`
      ${embedded ? 'py-1 md:py-2 gap-2' : 'p-2 md:py-[0.525rem] md:px-2 border-2 border-black'}
      bg-black text-white
      rounded-lg
      font-bold text-[11px] md:text-[13px]
      flex items-center ${embedded ? 'justify-between w-full' : 'justify-center gap-2'}
      cursor-pointer ${embedded ? 'overflow-visible' : 'overflow-hidden'}
      shadow-lg
    `}>
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = currentView === view.type;

        return (
          <button
            key={view.type}
            onClick={() => onViewChange(view.type)}
            className={`
              flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer active:scale-95 shrink-0
              ${embedded ? `w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] rounded-lg border-2 ${isActive ? 'border-black' : 'border-white'}` : 'px-2 md:px-3 py-1.5 rounded'}
              ${isActive
                ? 'bg-white text-black'
                : 'hover:bg-gray-800 text-white'
              }
            `}
            aria-label={t(view.labelKey)}
          >
            <Icon className={embedded ? 'w-5 h-5' : `${view.type === 'card' ? 'w-5 h-5 md:w-6 md:h-6' : 'w-4 h-4 md:w-5 md:h-5'}`} />
            <span className="hidden md:inline whitespace-nowrap tracking-wider">
              {t(view.labelKey)}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setMode(isDynamic ? 'regular' : 'dynamic')}
        data-bg-toggle={isDynamic ? 'dynamic' : 'sky'}
        className={`
          flex items-center justify-center rounded-lg border-2 border-white
          transition-[transform] duration-200 cursor-pointer active:scale-95 shrink-0
          ${embedded ? 'w-11 h-11 min-w-[2.75rem] min-h-[2.75rem]' : 'w-8 h-8 md:w-9 md:h-9'}
          ${isDynamic
            ? 'bg-white'
            : 'bg-toggle-sky-preview'
          }
        `}
        aria-label={isDynamic ? t('view.bgToggleDynamic') : t('view.bgToggleRegular')}
        title={isDynamic ? t('view.bgToggleDynamic') : t('view.bgToggleRegular')}
      />
      {/* ProBot head on the right (desktop floating bar only), with Beta badge */}
      {!embedded && showProBotHead && onProBotClick && (
        <div className="relative flex items-center justify-center shrink-0">
          <span
            className="beta-badge-dynamic absolute -top-[10px] -right-2 z-10 px-0.5 rounded text-[9px] font-bold text-black border border-black shadow"
            aria-hidden
          >
            Beta
          </span>
          <button
            type="button"
            onClick={onProBotClick}
            className="flex items-center justify-center w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] md:w-9 md:h-9 md:min-w-0 md:min-h-0 rounded-lg border-2 border-white bg-black overflow-hidden hover:opacity-90 active:scale-95 transition-all"
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
      )}
    </div>
  );

  if (embedded) {
    return toggleContent;
  }

  const toggleEl = (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-50 bottom-[35px] md:bottom-[75px] transition-all duration-300 ease-out ${
        isHidden
          ? 'opacity-0 translate-y-4 pointer-events-none'
          : 'opacity-100 translate-y-0 pointer-events-auto'
      }`}
    >
      {toggleContent}
    </div>
  );

  if (typeof document === 'undefined' || !mounted) return null;
  return createPortal(toggleEl, document.body);
}
