'use client';

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
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
  Shovel,
  BarChart3,
  Car,
  Hammer,
  Camera,
  Home,
  QrCode,
  GripVertical,
  ChevronDown,
} from 'lucide-react';
import { BsGrid3X3Gap } from 'react-icons/bs';
import { MobileGridActionsModal, type MobileGridActionItem } from '@/components/crm/MobileGridActionsModal';
import { useCRMChrome } from '@/components/crm/CRMChromeContext';
import { useProTrades } from '@/hooks/useProTrades';
import { TRADES, TRADE_SLUGS } from '@/lib/protrades/trades';
import { HardscapeIcon, LandscapeIcon, MaintenanceIcon, PlantsIcon, ProTradesIcon, PROTRADES_TILE_COLORS, type AppIcon } from '@/components/icons/hub';

interface NavItem {
  href: string;
  labelKey: string;
  icon: AppIcon;
  /** Trade tools use their trade color instead of red. */
  iconClass?: string;
  /** A group (e.g. Landscape) that opens and closes on desktop; phones list the children flat. */
  children?: NavItem[];
}

interface CRMSidebarProps {
  locale: string;
  /** Hide the horizontal menu on phones while search is open. */
  mobileCollapsed?: boolean;
}

const NAV_ORDER_KEY = 'crm-nav-order';
const NAV_GROUPS_KEY = 'crm-nav-groups-open';

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
  const dragHref = useRef<string | null>(null);
  const [navOrder, setNavOrder] = useState<string[] | null>(null);
  const { state: proTrades } = useProTrades();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  /** Group being hovered: it opens while the pointer is on it; a click keeps it open. */
  const [hoverGroup, setHoverGroup] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NAV_GROUPS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read saved open/closed groups after mount (same as nav order)
      if (parsed && typeof parsed === 'object') setOpenGroups(parsed as Record<string, boolean>);
    } catch {
      // Private mode or blocked storage: groups start closed.
    }
  }, []);
  const toggleGroup = (key: string, open: boolean) => {
    setOpenGroups((current) => {
      const next = { ...current, [key]: open };
      try {
        localStorage.setItem(NAV_GROUPS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors.
      }
      return next;
    });
  };
  const tradeOn = (trade: 'landscape' | 'hardscape') => Boolean(proTrades?.active.includes(trade));
  // ProTrades icon: a tile per trade in its color (green, orange, blue, red); trades that are on are filled.
  const activeTradeKey = (proTrades?.active ?? []).join(',');
  const ProTradesNavIcon = useMemo<AppIcon>(() => {
    const active = activeTradeKey.split(',');
    const on = [...TRADE_SLUGS.map((slug) => active.includes(slug)), false, false];
    function ProTradesNavIcon({ className }: { className?: string }) {
      return <ProTradesIcon className={className} colors={[...PROTRADES_TILE_COLORS]} on={on} />;
    }
    return ProTradesNavIcon;
  }, [activeTradeKey]);

  const realtorCalendarOnly = (roles as string[]).includes('realtor') && !roles.includes('contractor');
  const navItems: NavItem[] = (
  [
    { href: base, labelKey: 'crmDashboard', icon: LayoutDashboard },
    { href: `${base}/customers`, labelKey: 'crmCustomers', icon: Users },
    { href: `${base}/estimates`, labelKey: 'crmEstimates', icon: FileText },
    { href: `${base}/invoices`, labelKey: 'crmInvoices', icon: FileCheck },
    { href: `${base}/projects`, labelKey: 'crmProjects', icon: FolderKanban },
    { href: `${base}/portal`, labelKey: 'crmPortal', icon: Home },
    { href: `${base}/jobsite`, labelKey: 'crmJobsite', icon: Camera },
    // ProTrades tools show only while their trade is on.
    ...(tradeOn('landscape')
      ? [
          {
            href: 'group:landscape',
            labelKey: 'crmLandscape',
            icon: LandscapeIcon,
            iconClass: TRADES.landscape.color.text,
            children: [
              { href: `${base}/protrades/landscape`, labelKey: 'crmPlants', icon: PlantsIcon, iconClass: TRADES.landscape.color.text },
              { href: `${base}/maintenance`, labelKey: 'crmMaintenance', icon: MaintenanceIcon, iconClass: TRADES.landscape.color.text },
            ],
          },
        ]
      : []),
    ...(tradeOn('hardscape') ? [{ href: `${base}/protrades/hardscape`, labelKey: 'crmHardscape', icon: HardscapeIcon, iconClass: TRADES.hardscape.color.text }] : []),
    { href: `${base}/protrades`, labelKey: 'crmProTrades', icon: ProTradesNavIcon },
    { href: `${base}/expenses`, labelKey: 'crmExpenses', icon: Receipt },
    { href: `${base}/mileage`, labelKey: 'crmMileage', icon: Car },
    { href: `${base}/tools`, labelKey: 'crmTools', icon: Hammer },
    { href: `${base}/reports`, labelKey: 'crmReports', icon: BarChart3 },
    { href: `${base}/services`, labelKey: 'crmServices', icon: Shovel },
    { href: `${base}/products`, labelKey: 'crmProducts', icon: Package },
    { href: `${base}/calendar`, labelKey: 'crmCalendar', icon: Calendar },
    { href: `${base}/qrcode`, labelKey: 'crmQrcode', icon: QrCode },
  ] as NavItem[]
  ).filter((item) => !realtorCalendarOnly || item.href.endsWith('/calendar') || item.href.endsWith('/qrcode'));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NAV_ORDER_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      setNavOrder(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []);
    } catch {
      setNavOrder([]);
    }
  }, []);

  // A trade tool turned on after the pro saved an order goes right above ProTrades, not to the bottom.
  const proTradesHref = `${base}/protrades`;
  const isTradeTool = (href: string) => href.startsWith('group:') || (href.startsWith(`${proTradesHref}/`));
  const orderedNavItems = [...navItems].sort((a, b) => {
    if (!navOrder) return 0;
    const rank = (href: string) => {
      const index = navOrder.indexOf(href);
      if (index !== -1) return index;
      const proTradesIndex = navOrder.indexOf(proTradesHref);
      return isTradeTool(href) && proTradesIndex !== -1 ? proTradesIndex : navOrder.length;
    };
    return rank(a.href) - rank(b.href);
  });

  const moveNavItem = (fromHref: string, toHref: string) => {
    if (!fromHref || fromHref === toHref) return;
    const current = orderedNavItems.map((item) => item.href);
    const from = current.indexOf(fromHref);
    const to = current.indexOf(toHref);
    if (from < 0 || to < 0) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setNavOrder(next);
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(next));
  };

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
    const active = nav.querySelector<HTMLElement>('[data-nav-active="true"]');
    active?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: didScrollNav.current ? 'smooth' : 'auto' });
    didScrollNav.current = true;
  }, [pathname, mounted]);

  const isActiveRoute = (itemHref: string) => {
    if (!mounted) return false;
    if (pathname === itemHref) return true;
    if (itemHref === base) return false;
    return pathname.startsWith(itemHref + '/') || pathname === itemHref;
  };
  /** Phones show group children as plain items. */
  const flatNavItems = orderedNavItems.flatMap((item) => item.children ?? [item]);
  const mobileNavItems = flatNavItems;
  const activeCount = (href: string): number | null => {
    if (href.endsWith('/customers')) return crmChrome?.customerCount ?? null;
    if (href.endsWith('/estimates')) return sectionCounts.estimates ?? null;
    if (href.endsWith('/invoices')) return sectionCounts.invoices ?? null;
    if (href.endsWith('/projects')) return sectionCounts.projects ?? null;
    if (href.endsWith('/expenses')) return sectionCounts.expenses ?? null;
    return null;
  };
  const mobileMenuItems: MobileGridActionItem[] = flatNavItems.map((item) => ({
    id: item.href,
    href: item.href,
    label: t(item.labelKey),
    icon: item.icon,
    iconClass: item.iconClass,
    isActive: isActiveRoute(item.href),
  }));

  const renderDesktopLink = (item: NavItem, nested = false) => {
    const isActive = isActiveRoute(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          moveNavItem(dragHref.current || event.dataTransfer.getData('text/plain'), item.href);
          dragHref.current = null;
        }}
        className={`
          group flex items-center ${nested ? 'py-2 pl-8 pr-4' : 'px-4 py-3'} rounded-lg transition-all duration-300 border-2 hover:scale-[1.02]
          ${
            isActive
              ? 'bg-white border-black text-black font-medium'
              : 'text-black border-transparent hover:border-gray-400'
          }
        `}
      >
        <span
          draggable
          onDragStart={(event) => {
            dragHref.current = item.href;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', item.href);
          }}
          onDragEnd={() => { dragHref.current = null; }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          className="flex w-0 cursor-grab items-center overflow-hidden opacity-0 transition-all group-hover:mr-2 group-hover:w-4 group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 shrink-0 text-gray-500" />
        </span>
        <Icon className={`mr-3 w-5 h-5 ${item.iconClass ?? 'text-red-600'} transition-transform duration-300 group-hover:scale-110`} />
        {t(item.labelKey)}
      </Link>
    );
  };

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
                  data-nav-active={isActive ? 'true' : undefined}
                  className={`
                    group h-10 border-2 transition-all duration-300 font-medium flex items-center justify-center px-3 gap-2 whitespace-nowrap shrink-0 cursor-pointer hover:scale-[1.02] rounded-lg
                    ${
                      isActive
                        ? 'bg-black border-black text-white'
                        : 'bg-transparent border-transparent text-black hover:border-gray-400'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white' : item.iconClass ?? 'text-red-600'}`} />
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
        onReorder={moveNavItem}
        dragHint={t('crmMenuDragHint')}
      />

      {/* Desktop: vertical sidebar */}
      <aside className="no-print hidden md:block w-64 border-r-2 border-black bg-white h-full min-h-0 flex-shrink-0 overflow-y-auto overscroll-contain scrollbar-custom">
        <nav className="p-4 pb-24 space-y-2">
          {orderedNavItems.map((item) => {
            if (!item.children) return renderDesktopLink(item);
            const Icon = item.icon;
            const childActive = item.children.some((child) => isActiveRoute(child.href));
            const pinned = openGroups[item.href] ?? childActive;
            const open = pinned || hoverGroup === item.href;
            return (
              <div
                key={item.href}
                onMouseEnter={() => setHoverGroup(item.href)}
                onMouseLeave={() => setHoverGroup((current) => (current === item.href ? null : current))}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  moveNavItem(dragHref.current || event.dataTransfer.getData('text/plain'), item.href);
                  dragHref.current = null;
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(item.href, !pinned)}
                  aria-expanded={open}
                  aria-pressed={pinned}
                  title={pinned ? 'Click to close' : 'Click to keep open'}
                  className={`group flex w-full cursor-pointer items-center rounded-lg border-2 px-4 py-3 text-left transition-all duration-300 hover:border-gray-400 ${
                    childActive && !open ? 'border-black font-medium' : 'border-transparent'
                  }`}
                >
                  <span
                    draggable
                    onDragStart={(event) => {
                      dragHref.current = item.href;
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', item.href);
                    }}
                    onDragEnd={() => { dragHref.current = null; }}
                    onClick={(event) => event.stopPropagation()}
                    className="flex w-0 cursor-grab items-center overflow-hidden opacity-0 transition-all group-hover:mr-2 group-hover:w-4 group-hover:opacity-100 active:cursor-grabbing"
                    aria-label="Drag to reorder"
                  >
                    <GripVertical className="h-4 w-4 shrink-0 text-gray-500" />
                  </span>
                  <Icon className={`mr-3 h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${item.iconClass ?? 'text-red-600'}`} />
                  <span className="flex-1 font-semibold">{t(item.labelKey)}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${pinned ? 'text-black' : 'text-gray-400'}`} />
                </button>
                {open ? <div className="mt-1 space-y-1">{item.children.map((child) => renderDesktopLink(child, true))}</div> : null}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
