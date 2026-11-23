'use client';

import { ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { openQuickRepairCamera } from '@/lib/media/quick-repair-camera';
import { BookOpen, Briefcase, HardHat, Package, Truck } from 'lucide-react';
import { FeedIcon } from '@/components/icons/hub';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeMainMenuOrder, type MainMenuKey } from '@/lib/constants/mainMenu';

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
  { labelKey: 'feed', path: '/feed', icon: FeedIcon },
  { labelKey: 'quickRepair', path: '/quick-repair' },
];

const DRAG_SLOP_PX = 8;
const LONG_PRESS_MS = 280;

type MenuDrag = {
  key: MainMenuKey;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  startOrder: MainMenuKey[];
  active: boolean;
  timer: number | null;
  target: HTMLElement;
};

function sameOrder(a: MainMenuKey[], b: MainMenuKey[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

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

/** Camera mark. The lens label is FIX for Quick Repair and JOB for Jobsite. White lines are for a black camera screen. */
export function RepairCameraMark({ label = 'FIX', line = 'black' }: { label?: string; line?: 'black' | 'white' }) {
  const ink = line === 'white' ? '#fff' : '#000';
  return (
    <span className={`repair-cam-mark relative block h-full w-full overflow-visible ${line === 'white' ? 'text-white' : 'text-black'}`}>
      <svg viewBox="0 3 80 61" className="h-full w-full overflow-visible" aria-hidden>
        <path d={CAMERA_OUTLINE} fill="none" stroke={ink} strokeWidth="3" strokeLinejoin="round" pathLength="2" strokeDasharray="1 1" className="repair-cam-border repair-cam-border-black" />
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
  const { isAdmin } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const orderRef = useRef<MainMenuKey[]>(menuItems.map((item) => item.labelKey as MainMenuKey));
  const orderEpochRef = useRef(0);
  const dragRef = useRef<MenuDrag | null>(null);
  const suppressClickRef = useRef(false);
  const [menuOrder, setMenuOrder] = useState<MainMenuKey[] | null>(null);
  const [draggingKey, setDraggingKey] = useState<MainMenuKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    const epoch = orderEpochRef.current;
    fetch('/api/navigation/menu-order', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { order?: unknown } | null) => {
        if (cancelled || epoch !== orderEpochRef.current || !data || dragRef.current?.active) return;
        const next = normalizeMainMenuOrder(data.order);
        orderRef.current = next;
        setMenuOrder(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    const session = dragRef.current;
    if (session?.timer != null) window.clearTimeout(session.timer);
  }, []);

  const orderedItems = useMemo(() => {
    const keys = menuOrder ?? menuItems.map((item) => item.labelKey as MainMenuKey);
    const byKey = new Map(menuItems.map((item) => [item.labelKey, item]));
    return normalizeMainMenuOrder(keys)
      .map((key) => byKey.get(key))
      .filter((item): item is MenuItem => Boolean(item));
  }, [menuOrder]);

  const placeItem = (key: MainMenuKey, clientX: number) => {
    const root = scrollRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-menu-key]'));
    const others = nodes.filter((node) => node.dataset.menuKey !== key);
    let insertAt = 0;
    for (const node of others) {
      const rect = node.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      if (clientX > rect.left + rect.width / 2) insertAt += 1;
    }
    setMenuOrder((current) => {
      const base = normalizeMainMenuOrder(current ?? orderRef.current);
      const without = base.filter((item) => item !== key);
      const next = without.slice();
      next.splice(Math.min(insertAt, without.length), 0, key);
      orderRef.current = next;
      return sameOrder(next, base) ? (current ?? next) : next;
    });
  };

  const beginDrag = (session: MenuDrag) => {
    session.active = true;
    if (session.timer != null) {
      window.clearTimeout(session.timer);
      session.timer = null;
    }
    setDraggingKey(session.key);
    try {
      session.target.setPointerCapture(session.pointerId);
    } catch {
      // The pointer can already be gone if the finger lifted as the timer fired.
    }
  };

  const finishDrag = (event: React.PointerEvent<HTMLAnchorElement>) => {
    const session = dragRef.current;
    if (!session || event.pointerId !== session.pointerId) return;
    if (session.timer != null) window.clearTimeout(session.timer);
    dragRef.current = null;
    setDraggingKey(null);
    if (!session.active) return;
    suppressClickRef.current = true;
    if (sameOrder(session.startOrder, orderRef.current)) return;
    orderEpochRef.current += 1;
    const order = orderRef.current.slice();
    void fetch('/api/admin/menu-order', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    }).then(async (res) => {
      if (res.ok) return;
      const fresh = await fetch('/api/navigation/menu-order', { cache: 'no-store' });
      const data = await fresh.json().catch(() => null);
      if (!data) return;
      const next = normalizeMainMenuOrder(data.order);
      orderRef.current = next;
      setMenuOrder(next);
    }).catch(() => {});
  };

  const onItemPointerDown = (event: React.PointerEvent<HTMLAnchorElement>, key: MainMenuKey) => {
    if (!isAdmin || event.button !== 0) return;
    const session: MenuDrag = {
      key,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      startOrder: orderRef.current.slice(),
      active: false,
      timer: null,
      target: event.currentTarget,
    };
    dragRef.current = session;
    if (event.pointerType === 'mouse') {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Capture can fail if the pointer is already gone.
      }
      return;
    }
    session.timer = window.setTimeout(() => {
      if (dragRef.current === session) beginDrag(session);
    }, LONG_PRESS_MS);
  };

  const onItemPointerMove = (event: React.PointerEvent<HTMLAnchorElement>) => {
    const session = dragRef.current;
    if (!session || event.pointerId !== session.pointerId) return;
    const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    if (!session.active) {
      if (distance < DRAG_SLOP_PX) return;
      if (session.pointerType !== 'mouse') {
        if (session.timer != null) window.clearTimeout(session.timer);
        dragRef.current = null;
        return;
      }
      beginDrag(session);
    }
    placeItem(session.key, event.clientX);
  };

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
    const baseClasses = 'group h-10 min-w-max shrink-0 border-2 transition-all duration-300 font-medium flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-[1.02]';
    const itemGap = 'gap-1 md:gap-2.5';
    const itemPadding = 'px-2.5 md:px-4';
    const activeClasses = 'bg-black border-black text-white rounded-lg';
    const inactiveClasses = 'bg-transparent border-transparent text-black hover:border-gray-400 rounded-lg';
    
    // Check if pathname matches the path with locale prefix
    const pathWithLocale = `/${locale}${path}`;
    const isActive = pathname === pathWithLocale || pathname.startsWith(`${pathWithLocale}/`);
    if (labelKey === 'quickRepair') {
      return 'relative flex h-10 w-[52px] shrink-0 cursor-grab items-center justify-center border-0 bg-transparent p-0 active:cursor-grabbing md:hidden';
    }
    return isActive
      ? `${baseClasses} ${itemGap} ${itemPadding} ${activeClasses}`
      : `${baseClasses} ${itemGap} ${itemPadding} ${inactiveClasses}`;
  };

  return (
    <div id="main-menu" className="sticky top-0 z-30 flex h-[60px] w-full min-w-0 flex-shrink-0 items-center border-b-2 border-black bg-white px-1 md:h-[69px] md:px-[6px]">
      <div ref={scrollRef} className={`scrollbar-category h-full min-w-0 flex-1 overflow-x-auto overflow-y-hidden ${draggingKey ? 'touch-none cursor-grabbing' : ''}`}>
        <div className="flex h-full w-max items-center gap-2 md:w-full md:justify-between">
          {orderedItems.map((item) => {
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
                data-menu-key={item.labelKey}
                draggable={false}
                onMouseDown={(event) => {
                  if (event.button === 0) event.preventDefault();
                }}
                onPointerDown={(event) => onItemPointerDown(event, item.labelKey as MainMenuKey)}
                onPointerMove={onItemPointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onPointerLeave={(event) => {
                  const session = dragRef.current;
                  if (!session || session.active || session.pointerType === 'mouse' || event.pointerId !== session.pointerId) return;
                  if (session.timer != null) window.clearTimeout(session.timer);
                  dragRef.current = null;
                }}
                onClick={(event) => {
                  if (suppressClickRef.current) {
                    event.preventDefault();
                    event.stopPropagation();
                    suppressClickRef.current = false;
                    return;
                  }
                  if (!isQuickRepair) return;
                  event.preventDefault();
                  openQuickRepairCamera();
                }}
                aria-label={isQuickRepair ? t(item.labelKey) : undefined}
                className={`${menuItemClasses(item.path, item.labelKey)}${isAdmin ? ' select-none' : ''}${draggingKey ? ' !transition-none' : ''}${draggingKey === item.labelKey ? ' opacity-60 hover:!scale-100' : ''}`}
                style={isAdmin ? { WebkitTouchCallout: 'none' } : undefined}
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

