'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Home, ChevronRight, LucideIcon } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  const locale = useLocale();
  const t = useTranslations('breadcrumb');
  
  // Only show breadcrumb if there are at least 2 levels (Home + at least 1 item)
  if (items.length === 0) {
    return null;
  }

  return (
    <nav className={`flex items-center gap-1 md:gap-2 text-sm text-gray-500 mb-2 overflow-x-auto whitespace-nowrap pb-2 ${className}`}>
      <Link href={`/${locale}`} prefetch={false} className="hover:text-black flex items-center gap-1">
        <Home className="w-4 h-4 text-red-600" />
        <span className="hidden md:inline">{t('home')}</span>
      </Link>
      
      {items.map((item, index) => {
        const IconComponent = item.icon;
        return (
          <div key={index} className="flex items-center gap-1 md:gap-2">
            <ChevronRight className="w-4 h-4" />
            {item.href ? (
              <Link href={`/${locale}${item.href}`} prefetch={false} className="hover:text-black flex items-center gap-1">
                {IconComponent && <IconComponent className="w-4 h-4 hidden md:block text-red-600" />}
                {item.label}
              </Link>
            ) : (
              <span className="text-black font-medium flex items-center gap-1">
                {IconComponent && <IconComponent className="w-4 h-4 hidden md:block text-red-600" />}
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
