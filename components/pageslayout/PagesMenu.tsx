'use client';

import { ReactNode, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { BookOpen, Briefcase, HardHat, Package, Truck, Zap } from 'lucide-react';

interface PagesMenuProps {
  children?: ReactNode;
}

type MenuItem = {
  labelKey: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
};

const menuItems: MenuItem[] = [
  { labelKey: 'proJobs', path: '/projobs', icon: Briefcase },
  { labelKey: 'proSuppliers', path: '/prosuppliers', icon: Truck },
  { labelKey: 'proProducts', path: '/proproducts', icon: Package },
  { labelKey: 'prosBlog', path: '/blog', icon: BookOpen },
  { labelKey: 'housePros', path: '/businesslist', icon: HardHat },
  { labelKey: 'quickRepair', path: '/quick-repair', icon: Zap },
];

/** Scroll so Quick Repair, the last pill, sits flush on the right. Same idea as BrazaLink's home menu. */
function scrollMenuToEnd(container: HTMLDivElement | null) {
  if (!container) return;
  const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
  if (Math.abs(container.scrollLeft - maxScroll) > 1) {
    container.scrollTo({ left: maxScroll, behavior: 'auto' });
  }
}

/** Mobile labels drop the Pro/Pros brand prefix so the row can scroll full words. HousePros keeps Pros. */
function mobileMenuLabel(label: string, labelKey: string): string {
  if (labelKey === 'housePros') return label.endsWith('Pros') ? 'Pros' : label;
  if (labelKey === 'quickRepair') return 'Repair';
  if (label.startsWith('Pros')) return label.slice(4);
  if (label.startsWith('Pro')) return label.slice(3);
  if (label.endsWith('Pro')) return label.slice(0, -3);
  return label;
}

export default function PagesMenu({ children }: PagesMenuProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('navigation');
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const run = () => scrollMenuToEnd(scrollRef.current);
    run();
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
    const timer = window.setTimeout(run, 100);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(timer);
    };
  }, [pathname]);

  const menuItemClasses = (path: string, labelKey: string) => {
    const baseClasses = 'group h-10 min-w-max shrink-0 border-2 transition-all duration-300 font-medium flex items-center justify-center cursor-pointer hover:scale-[1.02]';
    const itemGap = 'gap-1 md:gap-2.5';
    const itemPadding = 'px-2.5 md:px-4';
    const activeClasses = 'bg-black border-black text-white rounded-lg';
    const inactiveClasses = 'bg-transparent border-transparent text-black hover:border-gray-400 rounded-lg';
    
    // Check if pathname matches the path with locale prefix
    const pathWithLocale = `/${locale}${path}`;
    const isActive = pathname === pathWithLocale || pathname.startsWith(`${pathWithLocale}/`);
    if (labelKey === 'quickRepair') {
      return `${baseClasses} quick-repair-border gap-2 px-2 text-white rounded-lg`;
    }
    return isActive
      ? `${baseClasses} ${itemGap} ${itemPadding} ${activeClasses}`
      : `${baseClasses} ${itemGap} ${itemPadding} ${inactiveClasses}`;
  };

  return (
    <div className="flex h-[60px] w-full min-w-0 flex-shrink-0 border-b-2 border-black px-1 pt-1 pb-0 md:h-[69px] md:px-[6px] md:pt-[6px]">
      <div ref={scrollRef} className="scrollbar-category h-[52px] min-w-0 flex-1 overflow-x-auto overflow-y-hidden md:h-[63px]">
        <div className="flex h-full w-max items-center gap-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isHousePros = item.labelKey === 'housePros';
            const isQuickRepair = item.labelKey === 'quickRepair';
            const iconSizeClass = isHousePros
              ? 'w-[1.35rem] h-[1.35rem] md:w-[1.62rem] md:h-[1.62rem] lg:w-[1.89rem] lg:h-[1.89rem]'
              : 'w-[1.125rem] h-[1.125rem] md:w-[1.35rem] md:h-[1.35rem] lg:w-[1.575rem] lg:h-[1.575rem]';
            const iconColorClass = isQuickRepair ? 'text-black' : 'text-red-500';
            return (
              <Link
                key={item.path}
                href={`/${locale}${item.path}`}
                onMouseDown={(event) => {
                  if (event.button === 0) event.preventDefault();
                }}
                className={menuItemClasses(item.path, item.labelKey)}
              >
                <Icon className={`${iconSizeClass} ${iconColorClass} transition-transform duration-300 group-hover:scale-110`} />
                <span className="whitespace-nowrap text-sm md:hidden">{mobileMenuLabel(t(item.labelKey), item.labelKey)}</span>
                <span className="hidden whitespace-nowrap text-base lg:text-lg md:inline">{t(item.labelKey)}</span>
              </Link>
            );
          })}
          {children}
        </div>
      </div>
    </div>
  );
}

