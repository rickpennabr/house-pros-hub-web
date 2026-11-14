'use client';

import { CheckSquare, Clock, Link as LinkIcon, Building2, Images, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type BusinessDetailsTab = 'contact' | 'hours' | 'services' | 'links' | 'about' | 'images';

interface BusinessDetailsTabsProps {
  activeTab: BusinessDetailsTab;
  onTabChange: (tab: BusinessDetailsTab) => void;
  showServices?: boolean;
}

export default function BusinessDetailsTabs({ activeTab, onTabChange, showServices = false }: BusinessDetailsTabsProps) {
  const t = useTranslations('businessServices');
  const tHours = useTranslations('businessHours');
  const tabs = [
    { id: 'contact' as const, label: 'Contact', icon: CheckSquare },
    { id: 'hours' as const, label: tHours('tab'), icon: Clock },
    ...(showServices ? [{ id: 'services' as const, label: t('tab'), icon: Wrench }] : []),
    { id: 'links' as const, label: 'Links', icon: LinkIcon },
    { id: 'about' as const, label: 'About', icon: Building2 },
    { id: 'images' as const, label: 'Images', icon: Images },
  ];

  return (
    <div className="flex h-[60px] w-full min-w-0 flex-shrink-0 items-center border-b-2 border-black px-1 md:h-[69px] md:px-[6px]">
      <div className="scrollbar-category h-full min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full w-max items-center gap-2 md:w-full md:justify-between">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={`group flex h-10 min-w-max shrink-0 cursor-pointer items-center justify-center gap-1 rounded-lg border-2 px-2.5 font-medium transition-all duration-300 hover:scale-[1.02] md:gap-2.5 md:px-4 ${
                  isActive
                    ? 'border-black bg-black text-white'
                    : 'border-transparent bg-transparent text-black hover:border-gray-400'
                }`}
              >
                <Icon className="h-[1.125rem] w-[1.125rem] shrink-0 text-red-500 transition-transform duration-300 group-hover:scale-110 md:h-[1.35rem] md:w-[1.35rem] lg:h-[1.575rem] lg:w-[1.575rem]" />
                <span className="whitespace-nowrap text-sm md:text-base lg:text-lg">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

