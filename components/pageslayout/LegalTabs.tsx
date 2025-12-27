'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ShieldCheck, FileText, Cookie } from 'lucide-react';

const LEGAL_TABS = [
  {
    id: 'terms',
    desktopLabel: 'Legal Terms',
    mobileLabel: 'Terms',
    path: '/legal/terms',
    icon: FileText,
    color: 'text-blue-600',
  },
  {
    id: 'privacy',
    desktopLabel: 'Privacy Policy',
    mobileLabel: 'Privacy',
    path: '/legal/privacy',
    icon: ShieldCheck,
    color: 'text-green-600',
  },
  {
    id: 'cookies',
    desktopLabel: 'Cookie Policy',
    mobileLabel: 'Cookies',
    path: '/legal/cookies',
    icon: Cookie,
    color: 'text-yellow-600',
  },
];

export default function LegalTabs() {
  const pathname = usePathname();
  const locale = useLocale();

  const tabClasses = (path: string) => {
    const pathWithLocale = `/${locale}${path}`;
    const isActive = pathname === path || pathname === pathWithLocale;
    const baseClasses = 'group h-10 border-2 transition-all duration-300 font-medium flex items-center justify-center px-4 gap-2 whitespace-nowrap shrink-0 cursor-pointer hover:scale-105';
    const activeClasses = 'bg-white border-black text-black rounded-lg';
    const inactiveClasses = 'bg-transparent border-transparent text-black hover:border-gray-400 rounded-lg';
    
    return isActive 
      ? `${baseClasses} ${activeClasses}`
      : `${baseClasses} ${inactiveClasses}`;
  };

  return (
    <div className="w-full h-[60px] border-b-2 border-black py-1 px-1 md:px-2 md:py-2 flex items-center relative overflow-hidden overflow-y-hidden">
      <div className="w-full flex items-center justify-start gap-3 overflow-x-auto scrollbar-custom p-2">
        {LEGAL_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={`/${locale}${tab.path}`}
              className={tabClasses(tab.path)}
            >
              <Icon className={`w-4 h-4 transition-transform duration-300 group-hover:scale-110 ${tab.color}`} />
              <span className="hidden md:inline">{tab.desktopLabel}</span>
              <span className="md:hidden">{tab.mobileLabel}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
