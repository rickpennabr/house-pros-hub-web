'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
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
  QrCode,
  LucideIcon,
} from 'lucide-react';
import { BsGrid3X3Gap } from 'react-icons/bs';
import { MobileGridActionsModal, type MobileGridActionItem } from '@/components/crm/MobileGridActionsModal';
import { useCRMChrome } from '@/components/crm/CRMChromeContext';

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

interface CRMSidebarProps {
  locale: string;
  /** Hide the horizontal menu on phones while search is open. */
  mobileCollapsed?: boolean;
}

export function CRMSidebar({ locale, mobileCollapsed = false }: CRMSidebarProps) {
  const pathname = usePathname();
  const { roles } = useAuth();
  const crmChrome = useCRMChrome();
  const t = useTranslations('bot');
  const base = `/${locale}/crm`;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  const didScrollNav = useRef(false);

  const realtorCalendarOnly = (roles as string[]).includes('realtor') && !roles.includes('contractor');
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
    { href: `${base}/qrcode`, labelKey: 'crmQrcode', icon: QrCode },
  ].filter((item) => !realtorCalendarOnly || item.href.endsWith('/calendar') || item.href.endsWith('/qrcode'));

  useEffect(() => setMounted(true), []);

  const setCustomerCount = crmChrome?.setCustomerCount;
  const [sectionCounts, setSectionCounts] = useState<Partial<Record<'estimates' | 'invoices' | 'projects' | 'expenses', number>>>({});
  useEffect(() => {
    let cancelled = false;
    const loadTotal = async (url: string) => {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) return null;
      const data = await response.json();
      return typeof data.total === 'number' ? data.total : null;
    };
    Promise.all([
      loadTotal('/api/crm/customers?page=1&pageSize=1'),
      loadTotal('/api/crm/estimates?page=1&pageSize=1'),
      loadTotal('/api/crm/invoices?page=1&pageSize=1'),
      loadTotal('/api/crm/projects?page=1&pageSize=1'),
      loadTotal('/api/crm/expenses?page=1&pageSize=1'),
    ])
      .then(([customers, estimates, invoices, projects, expenses]) => {
        if (cancelled) return;
        if (customers != null) setCustomerCount?.(customers);
        setSectionCounts({
          ...(estimates != null ? { estimates } : {}),
          ...(invoices != null ? { invoices } : {}),
          ...(projects != null ? { projects } : {}),
          ...(expenses != null ? { expenses } : {}),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname, setCustomerCount]);

  useLayoutEffect(() => {
    if (!mounted) return;
    const nav = mobileNavRef.current;
    if (!nav || window.matchMedia('(min-width: 768px)').matches) return;
    nav.scrollTo({ left: 0, behavior: didScrollNav.current ? 'smooth' : 'auto' });
    didScrollNav.current = true;
  }, [pathname, mounted]);

  const isActiveRoute = (itemHref: string) => {
    if (!mounted) return false;
    if (pathname === itemHref) return true;
    if (itemHref === base) return false;
    return pathname.startsWith(itemHref + '/') || pathname === itemHref;
  };
  const mobileNavItems = [...navItems].sort((a, b) => {
    const aActive = isActiveRoute(a.href);
    const bActive = isActiveRoute(b.href);
    if (aActive === bActive) return 0;
    return aActive ? -1 : 1;
  });
  const activeCount = (href: string): number | null => {
    if (href.endsWith('/customers')) return crmChrome?.customerCount ?? null;
    if (href.endsWith('/estimates')) return sectionCounts.estimates ?? null;
    if (href.endsWith('/invoices')) return sectionCounts.invoices ?? null;
    if (href.endsWith('/projects')) return sectionCounts.projects ?? null;
    if (href.endsWith('/expenses')) return sectionCounts.expenses ?? null;
    return null;
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
      <div className={`no-print md:hidden w-full border-b-2 border-black bg-white shrink-0 z-40 ${mobileCollapsed ? 'pointer-events-none invisible h-0 min-h-0 max-h-0 overflow-hidden border-0 opacity-0' : ''}`}>
        <div className="relative flex items-center h-[60px] px-2 py-2">
          <nav ref={mobileNavRef} className="flex items-center gap-3 overflow-x-auto scrollbar-custom flex-1 min-w-0 pr-12">
            {mobileNavItems.map((item) => {
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
                        ? 'bg-black border-black text-white'
                        : 'bg-transparent border-transparent text-black hover:border-gray-400'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white' : 'text-red-600'}`} />
                  {t(item.labelKey)}
                  {isActive && activeCount(item.href) != null && (
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border-2 border-black bg-white px-1 text-xs font-semibold text-black">
                      {activeCount(item.href)}
                    </span>
                  )}
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
