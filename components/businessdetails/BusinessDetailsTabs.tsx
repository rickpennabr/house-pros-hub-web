'use client';

import { CheckSquare, Link as LinkIcon, Building2, Images, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type BusinessDetailsTab = 'contact' | 'services' | 'links' | 'about' | 'images';

interface BusinessDetailsTabsProps {
  activeTab: BusinessDetailsTab;
  onTabChange: (tab: BusinessDetailsTab) => void;
  showServices?: boolean;
}

export default function BusinessDetailsTabs({ activeTab, onTabChange, showServices = false }: BusinessDetailsTabsProps) {
  const t = useTranslations('businessServices');
  const tabs = [
    { id: 'contact' as const, label: 'Contact', icon: CheckSquare },
    ...(showServices ? [{ id: 'services' as const, label: t('tab'), icon: Wrench }] : []),
    { id: 'links' as const, label: 'Links', icon: LinkIcon },
    { id: 'about' as const, label: 'About', icon: Building2 },
    { id: 'images' as const, label: 'Images', icon: Images },
  ];

  return (
    <div className="flex h-full w-full overflow-x-auto border-b-2 border-black">
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex min-w-[4.75rem] flex-1 shrink-0 items-center justify-center gap-1.5 h-full px-2 text-xs font-medium transition-colors cursor-pointer sm:gap-2 sm:px-4 sm:text-sm ${
              isActive
                ? 'border-b-4 border-black bg-white'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

