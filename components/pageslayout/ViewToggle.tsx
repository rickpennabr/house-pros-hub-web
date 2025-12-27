'use client';

import { List } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useScrollPosition } from '@/hooks/useScrollPosition';
import { useWindowDimensions } from '@/hooks/useWindowDimensions';
import { LuIdCard } from 'react-icons/lu';

export type ViewType = 'card' | 'list';

interface ViewToggleProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

interface ViewOption {
  type: ViewType;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
}

export default function ViewToggle({ currentView, onViewChange }: ViewToggleProps) {
  const t = useTranslations('common');
  const { isAtBottom } = useScrollPosition({ threshold: 50, useRequestAnimationFrame: false });
  const { isDesktop } = useWindowDimensions();

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

  return (
    <div 
      className={`fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        isAtBottom && isDesktop 
          ? 'bottom-[90px]' // Move up 100px from original 80px (80 + 100 = 180) + 100px more = 280
          : 'bottom-[90px] md:bottom-[75px]'
      }`}
    >
      <div className="
        p-2
        bg-black text-white 
        rounded-lg border-2 border-black 
        font-bold text-[11px] md:text-[13px]
        flex items-center justify-center gap-2
        cursor-pointer overflow-hidden
        transition-all duration-300
        shadow-lg
      ">
        {views.map((view) => {
          const Icon = view.icon;
          const isActive = currentView === view.type;
          
          return (
            <button
              key={view.type}
              onClick={() => onViewChange(view.type)}
              className={`
                flex items-center gap-2 px-2 md:px-3 py-1.5
                rounded transition-all duration-200
                cursor-pointer
                ${isActive 
                  ? 'bg-white text-black' 
                  : 'hover:bg-gray-800 text-white'
                }
                active:scale-95
              `}
              aria-label={t(view.labelKey)}
            >
              <Icon className={`${view.type === 'card' ? 'w-5 h-5 md:w-6 md:h-6' : 'w-4 h-4 md:w-5 md:h-5'}`} />
              <span className="hidden md:inline whitespace-nowrap tracking-wider">
                {t(view.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
