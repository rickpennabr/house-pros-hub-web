'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  FileText,
  FileCheck,
  FolderKanban,
  Receipt,
  Calendar,
  Package,
  BarChart3,
  Camera,
  Home,
  LucideIcon,
} from 'lucide-react';
import { BsGrid3X3Gap } from 'react-icons/bs';
import { MobileGridActionsModal, type MobileGridActionItem } from '@/components/crm/MobileGridActionsModal';

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

interface CRMSidebarProps {
  locale: string;
}

export function CRMSidebar({ locale }: CRMSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('bot');
  const base = `/${locale}/crm`;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const navItems: NavItem[] = [
    { href: base, labelKey: 'crmDashboard', icon: LayoutDashboard },
    { href: `${base}/customers`, labelKey: 'crmCustomers', icon: Users },
    { href: `${base}/estimates`, labelKey: 'crmEstimates', icon: FileText },
    { href: `${base}/invoices`, labelKey: 'crmInvoices', icon: FileCheck },
    { href: `${base}/projects`, labelKey: 'crmProjects', icon: FolderKanban },
    { href: `${base}/portal`, labelKey: 'crmPortal', icon: Home },
    { href: `${base}/jobsite`, labelKey: 'crmJobsite', icon: Camera },
    { href: `${base}/expenses`, labelKey: 'crmExpenses', icon: Receipt },
    { href: `${base}/reports`, labelKey: 'crmReports', icon: BarChart3 },
    { href: `${base}/items`, labelKey: 'crmItems', icon: Package },
    { href: `${base}/calendar`, labelKey: 'crmCalendar', icon: Calendar },
  ];

  useEffect(() => setMounted(true), []);

  const isActiveRoute = (itemHref: string) => {
    if (!mounted) return false;
    if (pathname === itemHref) return true;
    if (itemHref === base) return false;
    return pathname.startsWith(itemHref + '/') || pathname === itemHref;
  };
  const mobileMenuItems: MobileGridActionItem[] = navItems.map((item) => ({
    id: item.href,
    href: item.href,
    label: t(item.labelKey),
    icon: item.icon,
    isActive: isActiveRoute(item.href),
  }));

  return (
    <>
      {/* Mobile: horizontal nav */}
      <div className="no-print md:hidden w-full border-b-2 border-black bg-white shrink-0 z-40">
        <div className="relative flex items-center h-[60px] px-2 py-2">
          <nav className="flex items-center gap-3 overflow-x-auto scrollbar-custom flex-1 min-w-0 pr-12">
            {navItems.map((item) => {
              const isActive = isActiveRoute(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    group h-10 border-2 transition-all duration-300 font-medium flex items-center justify-center px-3 gap-2 whitespace-nowrap shrink-0 cursor-pointer hover:scale-[1.02] rounded-lg
                    ${
                      isActive
                        ? 'bg-white border-black text-black'
                        : 'bg-transparent border-transparent text-black hover:border-gray-400'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 text-red-600 transition-transform duration-300 group-hover:scale-110" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
          <button
            onClick={() => setIsMenuOpen(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-lg bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-all"
            aria-label="Menu"
          >
            <BsGrid3X3Gap className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Mobile menu modal */}
      <MobileGridActionsModal
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        title="Menu"
        items={mobileMenuItems}
      />

      {/* Desktop: vertical sidebar */}
      <aside className="no-print hidden md:block w-64 border-r-2 border-black bg-white h-full flex-shrink-0">
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = isActiveRoute(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  group flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 border-2 hover:scale-[1.02]
                  ${
                    isActive
                      ? 'bg-white border-black text-black font-medium'
                      : 'text-black border-transparent hover:border-gray-400'
                  }
                `}
              >
                <Icon className="w-5 h-5 text-red-600 transition-transform duration-300 group-hover:scale-110" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
