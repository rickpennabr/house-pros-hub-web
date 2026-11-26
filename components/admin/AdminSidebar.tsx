'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  User,
  Users, 
  Building2, 
  Eraser, 
  Truck,
  Folder,
  Search,
  X,
  MessageCircle,
  Key,
  Bot,
  FileCheck,
  ClipboardList,
  BookOpen,
  Package,
  QrCode,
  CreditCard,
  Shapes,
  Blocks,
  GripVertical,
  Sprout,
  type LucideIcon,
  Presentation,
  FlaskConical,
} from 'lucide-react';
import { useAdminSearch } from './AdminSearchContext';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import { MobileGridActionsModal, type MobileGridActionItem } from '@/components/crm/MobileGridActionsModal';
import { BsGrid3X3Gap } from 'react-icons/bs';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/presentation', label: 'Hub presentation', icon: Presentation },
  { href: '/admin/qrcodes', label: 'QR code', icon: QrCode },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/estimates', label: 'Estimates', icon: ClipboardList },
  { href: '/admin/chat', label: 'ProBot Chat', icon: MessageCircle },
  { href: '/admin/hublab', label: 'HubLab', icon: FlaskConical },
  { href: '/admin/plant-corrections', label: 'Plant ID training', icon: Sprout },
  { href: '/admin/customers', label: 'Customers', icon: User },
  { href: '/admin/businesses', label: 'Businesses', icon: Building2 },
  { href: '/admin/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/blog', label: 'Blog', icon: BookOpen },
  { href: '/admin/license-categories', label: 'License categories', icon: FileCheck },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/admin/icons', label: 'Icons', icon: Shapes },
  { href: '/admin/protrades', label: 'ProTrades databases', icon: Blocks },
  { href: '/admin/invitation-codes', label: 'Invitation codes', icon: Key },
  { href: '/admin/agent-apps', label: 'Agent apps', icon: Bot },
  { href: '/admin/storage', label: 'Storage', icon: Folder },
  { href: '/admin/clear-data', label: 'Clear Data', icon: Eraser },
];

const NAV_ORDER_KEY = 'admin-nav-order';

export function AdminSidebar() {
  const pathname = usePathname();
  const { searchQuery, setSearchQuery } = useAdminSearch();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const dragHref = useRef<string | null>(null);
  const [navOrder, setNavOrder] = useState<string[] | null>(null);

  // Avoid hydration mismatch: pathname can differ server vs client (e.g. locale); compute active only after mount.
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

  const orderedNavItems = [...navItems].sort((a, b) => {
    if (!navOrder) return 0;
    const ai = navOrder.indexOf(a.href);
    const bi = navOrder.indexOf(b.href);
    return (ai === -1 ? navOrder.length : ai) - (bi === -1 ? navOrder.length : bi);
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

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isSearchOpen &&
        searchBarRef.current &&
        !searchBarRef.current.contains(e.target as Node) &&
        searchButtonRef.current &&
        !searchButtonRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
        setSearchQuery('');
      }
    };
    if (isSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isSearchOpen, setSearchQuery]);

  const isActiveRoute = (itemHref: string) => {
    if (!mounted) return false;
    if (pathname === itemHref) return true;
    if (itemHref === '/admin') return false;
    return pathname.startsWith(itemHref + '/');
  };

  return (
    <>
      {/* Mobile: Horizontal menu in flow so it scrolls with the page */}
      <div className="md:hidden w-full border-b-2 border-black bg-white shrink-0 z-40">
        <div className="relative flex items-center h-[60px] px-2 py-2">
          <nav className="flex items-center gap-3 overflow-x-auto scrollbar-custom flex-1 min-w-0 pr-24">
            {orderedNavItems.map((item) => {
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
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Search + Main menu buttons - right side, mobile only (menu to the right of search) */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 z-20">
            <button
              ref={searchButtonRef}
              onClick={() => setIsSearchOpen((o) => !o)}
              className={`h-10 w-10 rounded-lg bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-all ${
                isSearchOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => setIsMenuOpen(true)}
              className={`h-10 w-10 rounded-lg bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-all ${
                isSearchOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
              aria-label="Main menu"
            >
              <BsGrid3X3Gap className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Expandable search bar - overlays row when open */}
          <div
            ref={searchBarRef}
            className={`absolute inset-0 z-30 flex bg-white p-2 transition-all duration-300 ${
              isSearchOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex h-full w-full items-center gap-2">
              <TypingSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search…"
                clearLabel="Clear search"
                inputRef={searchInputRef}
                className="relative h-full min-w-0 flex-1"
                inputClassName="h-full w-full rounded-lg border-2 border-black bg-white pl-9 pr-9 text-sm text-black placeholder-gray-500 focus:outline-none dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-gray-100 dark:placeholder-gray-400"
                iconClassName="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500"
              />
              <button
                type="button"
                onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
                className="aspect-square h-full rounded-lg bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 shrink-0"
                aria-label="Close search"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Main menu modal - all nav items in 3-column grid */}
      <MobileGridActionsModal
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        title="Menu"
        items={orderedNavItems.map((item) => ({
          id: item.href,
          href: item.href,
          label: item.label,
          icon: item.icon,
          isActive: isActiveRoute(item.href),
        }))}
        onReorder={moveNavItem}
      />

      {/* Desktop: Vertical sidebar */}
      <aside className="hidden md:block w-64 shrink-0 border-r-2 border-black bg-white md:h-full md:min-h-0 md:overflow-y-auto">
        <nav className="space-y-2 p-4 pb-14">
          {orderedNavItems.map((item) => {
            const isActive = isActiveRoute(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                draggable={false}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  moveNavItem(dragHref.current || event.dataTransfer.getData('text/plain'), item.href);
                  dragHref.current = null;
                }}
                className={`
                  group flex items-center px-4 py-3 rounded-lg transition-all duration-300 border-2 hover:scale-[1.02]
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
                <Icon className="mr-3 w-5 h-5 text-red-600 transition-transform duration-300 group-hover:scale-110" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

