'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { BookOpen, Package } from 'lucide-react';
import { MdGroups2 } from 'react-icons/md';

interface PagesMenuProps {
  children?: ReactNode;
}

type MenuItem = {
  labelKey: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
};

const menuItems: MenuItem[] = [
  { labelKey: 'prosBlog', path: '/blog', icon: BookOpen },
  { labelKey: 'housePros', path: '/businesslist', icon: MdGroups2 },
  { labelKey: 'proSuppliers', path: '/prosuppliers', icon: Package },
];

export default function PagesMenu({ children }: PagesMenuProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('navigation');

  const menuItemClasses = (path: string) => {
    const baseClasses = 'group h-10 border-2 transition-all duration-300 font-medium flex items-center justify-center md:px-4 gap-1 md:gap-2.5 flex-1 cursor-pointer hover:scale-[1.02]';
    // Active item: always use black border (not theme-aware)
    const activeClasses = 'bg-white border-black text-black rounded-lg';
    // Inactive item: use rounded-lg to match active shape, including on hover
    const inactiveClasses = 'bg-transparent border-transparent text-black hover:border-gray-400 rounded-lg';
    
    // Check if pathname matches the path with locale prefix
    const pathWithLocale = `/${locale}${path}`;
    const isActive = pathname === pathWithLocale || pathname.startsWith(`${pathWithLocale}/`);
    return isActive
      ? `${baseClasses} ${activeClasses}`
      : `${baseClasses} ${inactiveClasses}`;
  };

  return (
    <div className="w-full h-[60px] border-b-2 border-black p-2 md:px-2 md:py-4 flex items-center gap-2 md:gap-4">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isHousePros = item.icon === MdGroups2;
        const iconSizeClass = isHousePros 
          ? 'w-6 h-6 md:w-[1.8rem] md:h-[1.8rem] lg:w-[2.1rem] lg:h-[2.1rem]'
          : 'w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7';
        return (
          <Link
            key={item.path}
            href={`/${locale}${item.path}`}
            className={menuItemClasses(item.path)}
          >
            <Icon className={`${iconSizeClass} transition-transform duration-300 group-hover:scale-110`} />
            <span className="text-sm md:text-base lg:text-lg">{t(item.labelKey)}</span>
          </Link>
        );
      })}
      {children}
    </div>
  );
}

