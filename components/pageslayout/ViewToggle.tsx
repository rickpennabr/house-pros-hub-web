'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { List, Map, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LuIdCard } from 'react-icons/lu';
import { useBackgroundMode } from '@/contexts/BackgroundModeContext';
import { DAY_CYCLE_SKY_ENABLED } from '@/lib/constants/probot';
import { RepairCameraMark } from '@/components/pageslayout/PagesMenu';

export type ViewType = 'card' | 'list' | 'map';

interface ViewToggleProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  /** Defaults to card and list. Pass map on pages whose rows have an address. */
  views?: ViewType[];
  /** When true, render only the toggle content (no fixed position, no portal). For use inside a bottom bar. */
  embedded?: boolean;
  /** Hug the buttons instead of stretching across half the bar. */
  fitContent?: boolean;
  /** When true, hide the background (sky/dynamic) toggle button. Useful for CRM and other non-home pages. */
  hideBackgroundToggle?: boolean;
  /** Rightmost button in the bar, used for create actions. */
  onAdd?: () => void;
  addLabel?: string;
  /** Plus turns into an X while the add chooser is open. */
  addOpen?: boolean;
  /** CRM list pages keep Add on the phone only. The directory shows it on desktop too. */
  showAddOnDesktop?: boolean;
  /** Desktop Jobsite camera. Add sits to its right. */
  onJobCamera?: () => void;
  jobCameraLabel?: string;
}

interface ViewOption {
  type: ViewType;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
}

const VIEW_OPTIONS: ViewOption[] = [
  { type: 'card', icon: LuIdCard, labelKey: 'view.card' },
  { type: 'list', icon: List, labelKey: 'view.list' },
  { type: 'map', icon: Map, labelKey: 'view.map' },
];

export default function ViewToggle({
  currentView,
  onViewChange,
  views: enabledViews = ['card', 'list'],
  embedded = false,
  fitContent = false,
  hideBackgroundToggle = false,
  onAdd,
  addLabel = 'Add',
  addOpen = false,
  showAddOnDesktop = false,
  onJobCamera,
  jobCameraLabel = 'JOB',
}: ViewToggleProps) {
  const t = useTranslations('common');
  const { mode, setMode } = useBackgroundMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const views = VIEW_OPTIONS.filter((view) => enabledViews.includes(view.type));

  const isDynamic = mode === 'dynamic';
  const isHidden = false;
  /** Same box for every control. Labels only widen the desktop buttons. */
  const controlSize = embedded
    ? 'h-11 w-11 min-h-[2.75rem] min-w-[2.75rem]'
    : 'h-9 w-9 min-h-9 min-w-9 p-0 md:h-10 md:min-h-10';
  const iconSize = embedded ? 'h-5 w-5' : 'h-4 w-4 md:h-5 md:w-5';

  const toggleContent = (
    <div className={`
      ${embedded ? 'py-1 md:py-2' : 'p-2 md:py-[0.525rem] md:px-2 border-2 border-black'}
      bg-black text-white
      rounded-lg
      font-bold text-[11px] md:text-[13px]
      flex items-center ${embedded ? (fitContent ? 'w-max justify-center gap-3' : 'w-full justify-evenly') : 'justify-center gap-2'}
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
              rounded-lg border-2 box-border ${controlSize}
              ${isActive ? 'border-black bg-white text-black' : 'border-white text-white hover:bg-gray-800'}
              ${embedded ? '' : 'md:w-auto md:min-w-10 md:px-3'}
            `}
            aria-label={t(view.labelKey)}
          >
            <Icon className={iconSize} />
            <span className="hidden md:inline whitespace-nowrap tracking-wider">
              {t(view.labelKey)}
            </span>
          </button>
        );
      })}
      {DAY_CYCLE_SKY_ENABLED && !hideBackgroundToggle && (
        <button
          type="button"
          onClick={() => setMode(isDynamic ? 'regular' : 'dynamic')}
          data-bg-toggle={isDynamic ? 'dynamic' : 'sky'}
          className={`
            flex items-center justify-center rounded-lg border-2 border-white box-border
            transition-[transform] duration-200 cursor-pointer active:scale-95 shrink-0
            ${controlSize}
            ${embedded ? '' : 'md:w-10 md:min-w-10'}
            ${isDynamic
              ? 'bg-white'
              : 'bg-toggle-sky-preview'
            }
          `}
          aria-label={isDynamic ? t('view.bgToggleDynamic') : t('view.bgToggleRegular')}
          title={isDynamic ? t('view.bgToggleDynamic') : t('view.bgToggleRegular')}
        />
      )}
      {onJobCamera && (
        <div className="mx-0.5 hidden h-10 w-px shrink-0 bg-white opacity-90 md:block" aria-hidden />
      )}
      {onJobCamera && (
        <div className="relative hidden shrink-0 md:flex">
          <span
            className="beta-badge-dynamic absolute -top-[10px] -right-2 z-10 rounded border border-black px-0.5 text-[9px] font-bold text-black shadow"
            aria-hidden
          >
            Beta
          </span>
          <button
            type="button"
            onClick={onJobCamera}
            className="flex h-10 w-[3.25rem] shrink-0 items-center justify-center rounded-lg bg-white text-black"
            aria-label={jobCameraLabel}
          >
            <span className="relative block h-8 w-[2.6rem] overflow-hidden">
              <RepairCameraMark label="JOB" />
            </span>
          </button>
        </div>
      )}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className={`
            ${showAddOnDesktop ? 'flex' : 'flex md:hidden'} items-center justify-center gap-2 transition-all duration-200 cursor-pointer active:scale-95 shrink-0
            rounded-lg border-2 border-white box-border text-white hover:bg-gray-800
            ${controlSize}
            ${!embedded && showAddOnDesktop ? 'md:w-auto md:min-w-10 md:px-3' : ''}
          `}
          aria-label={addLabel}
          aria-expanded={addOpen}
        >
          <Plus className={`${iconSize} transition-transform duration-200 ${addOpen ? 'rotate-45' : ''}`} />
          {!embedded && showAddOnDesktop && (
            <span className="hidden md:inline whitespace-nowrap tracking-wider">{addLabel}</span>
          )}
        </button>
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
