'use client';

import { ReactNode, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { openQuickRepairCamera } from '@/lib/media/quick-repair-camera';
import { BookOpen, Briefcase, HardHat, Package, Truck } from 'lucide-react';

interface PagesMenuProps {
  children?: ReactNode;
}

type MenuItem = {
  labelKey: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
};

const menuItems: MenuItem[] = [
  { labelKey: 'proJobs', path: '/projobs', icon: Briefcase },
  { labelKey: 'proSuppliers', path: '/prosuppliers', icon: Truck },
  { labelKey: 'proProducts', path: '/proproducts', icon: Package },
  { labelKey: 'prosBlog', path: '/blog', icon: BookOpen },
  { labelKey: 'housePros', path: '/businesslist', icon: HardHat },
  { labelKey: 'quickRepair', path: '/quick-repair' },
];

/** Scroll so Quick Repair, the last pill, sits flush on the right. Same idea as BrazaLink's home menu. */
function scrollMenuToEnd(container: HTMLDivElement | null) {
  if (!container) return;
  const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
  if (Math.abs(container.scrollLeft - maxScroll) > 1) {
    container.scrollTo({ left: maxScroll, behavior: 'auto' });
  }
}

const CAMERA_OUTLINE =
  "M10.5 13 H27 V9 C27 7 28.4 5.8 30.6 5.8 H49.4 C51.6 5.8 53 7 53 9 V13 H69.5 A8 8 0 0 1 77.5 21 V53.5 A8 8 0 0 1 69.5 61.5 H10.5 A8 8 0 0 1 2.5 53.5 V21 A8 8 0 0 1 10.5 13 Z";

/** Camera mark. The lens label is FIX for Quick Repair and JOB for Jobsite. */
export function RepairCameraMark({ label = 'FIX' }: { label?: string }) {
  return (
    <span className="relative block h-full w-full overflow-visible text-black">
      <svg viewBox="0 3 80 61" className="h-full w-full overflow-visible" aria-hidden>
        <path d={CAMERA_OUTLINE} fill="none" stroke="#000" strokeWidth="3" strokeLinejoin="round" pathLength="2" strokeDasharray="1 1" className="repair-cam-border repair-cam-border-black" />
        <path d={CAMERA_OUTLINE} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinejoin="round" pathLength="2" strokeDasharray="1 1" className="repair-cam-border repair-cam-border-red" />
        <circle cx="40" cy="38" r="18.2" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="40" cy="38" r="15.4" fill="none" stroke="#ef4444" strokeWidth="2.3" />
        <text
          x="40"
          y="38.6"
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          fontSize="12"
          fontWeight="900"
          fontFamily="inherit"
          letterSpacing="-0.35"
          className="repair-fix-pulse"
        >
          {label}
        </text>
        <rect x="7.9" y="17.9" width="6.2" height="6.2" fill="#ffffff" stroke="none" />
        <rect x="7.9" y="17.9" width="6.2" height="6.2" fill="#ffe14a" stroke="none" className="repair-cam-flash" />
        <rect x="7" y="17" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d={CAMERA_OUTLINE} fill="none" stroke="#ffe14a" strokeWidth="3.6" strokeLinecap="round" pathLength="2" strokeDasharray="0.12 0.88" className="repair-cam-junction repair-cam-junction-halo" />
        <path d={CAMERA_OUTLINE} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" pathLength="2" strokeDasharray="0.04 0.96" className="repair-cam-junction repair-cam-junction-core" />
      </svg>
    </span>
  );
}

export function QuickRepairCameraLink({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations('navigation');
  return (
    <Link
      href={`/${locale}/quick-repair`}
      aria-label={t('quickRepair')}
      onClick={(event) => {
        event.preventDefault();
        openQuickRepairCamera();
      }}
      className={className ?? 'relative flex h-10 w-[52px] shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0'}
    >
      <RepairCameraMark />
    </Link>
  );
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
      return 'relative flex h-10 w-[52px] shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 md:hidden';
    }
    return isActive
      ? `${baseClasses} ${itemGap} ${itemPadding} ${activeClasses}`
      : `${baseClasses} ${itemGap} ${itemPadding} ${inactiveClasses}`;
  };

  return (
    <div className="flex h-[60px] w-full min-w-0 flex-shrink-0 border-b-2 border-black px-1 pt-1 pb-0 md:h-[69px] md:px-[6px] md:pt-[6px]">
      <div ref={scrollRef} className="scrollbar-category h-[52px] min-w-0 flex-1 overflow-x-auto overflow-y-hidden md:h-[63px]">
        <div className="flex h-full w-max items-center gap-2 md:w-full md:justify-between">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isHousePros = item.labelKey === 'housePros';
            const isQuickRepair = item.labelKey === 'quickRepair';
            const iconSizeClass = isHousePros
              ? 'w-[1.35rem] h-[1.35rem] md:w-[1.62rem] md:h-[1.62rem] lg:w-[1.89rem] lg:h-[1.89rem]'
              : 'w-[1.125rem] h-[1.125rem] md:w-[1.35rem] md:h-[1.35rem] lg:w-[1.575rem] lg:h-[1.575rem]';
            return (
              <Link
                key={item.path}
                href={`/${locale}${item.path}`}
                onMouseDown={(event) => {
                  if (event.button === 0) event.preventDefault();
                }}
                onClick={isQuickRepair ? (event) => {
                  event.preventDefault();
                  openQuickRepairCamera();
                } : undefined}
                aria-label={isQuickRepair ? t(item.labelKey) : undefined}
                className={menuItemClasses(item.path, item.labelKey)}
              >
                {isQuickRepair ? (
                  <RepairCameraMark />
                ) : Icon ? (
                  <Icon className={`${iconSizeClass} text-red-500 transition-transform duration-300 group-hover:scale-110`} />
                ) : null}
                {isQuickRepair ? null : (
                  <>
                    <span className="whitespace-nowrap text-sm md:hidden">{mobileMenuLabel(t(item.labelKey), item.labelKey)}</span>
                    <span className="hidden whitespace-nowrap text-base lg:text-lg md:inline">{t(item.labelKey)}</span>
                  </>
                )}
              </Link>
            );
          })}
          {children}
        </div>
      </div>
    </div>
  );
}

