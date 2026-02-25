'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Eraser, 
  Package,
  Folder,
  Search,
  X,
  MessageCircle,
  Key,
  LucideIcon 
} from 'lucide-react';
import { useAdminSearch } from './AdminSearchContext';
import Modal from '@/components/ui/Modal';
import { BsGrid3X3Gap } from 'react-icons/bs';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/chat', label: 'ProBot Chat', icon: MessageCircle },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/businesses', label: 'Businesses', icon: Building2 },
  { href: '/admin/suppliers', label: 'Suppliers', icon: Package },
  { href: '/admin/invitation-codes', label: 'Invitation codes', icon: Key },
  { href: '/admin/storage', label: 'Storage', icon: Folder },
  { href: '/admin/clear-data', label: 'Clear Data', icon: Eraser },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { searchQuery, setSearchQuery } = useAdminSearch();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  // Avoid hydration mismatch: pathname can differ server vs client (e.g. locale); compute active only after mount.
  useEffect(() => setMounted(true), []);

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

  const handleClear = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  return (
    <>
      {/* Mobile: Horizontal menu in flow so it scrolls with the page */}
      <div className="md:hidden w-full border-b-2 border-black bg-white shrink-0 z-40">
        <div className="relative flex items-center h-[60px] px-2 py-2">
          <nav className="flex items-center gap-3 overflow-x-auto scrollbar-custom flex-1 min-w-0 pr-24">
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
            className={`absolute left-0 right-0 top-0 bottom-0 flex items-center px-2 transition-all duration-300 z-30 bg-white ${
              isSearchOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="w-full flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full h-10 pl-9 pr-9 border-2 border-black dark:border-gray-600 rounded-lg bg-white dark:bg-[#1a1a1a] focus:outline-none text-black dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none w-4 h-4" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-gray-100 transition-colors cursor-pointer p-0.5"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
                className="h-10 w-10 rounded-lg bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 shrink-0"
                aria-label="Close search"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Main menu modal - all nav items in 3-column grid */}
      <Modal
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        title="Menu"
        showHeader={true}
        maxWidth="md"
      >
        <div className="grid grid-cols-3 gap-3 p-4">
          {navItems.map((item) => {
            const isActive = isActiveRoute(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className={`
                  flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all font-medium cursor-pointer hover:scale-[1.02]
                  ${
                    isActive
                      ? 'bg-white border-black text-black'
                      : 'border-gray-200 text-black hover:border-black'
                  }
                `}
              >
                <Icon className="w-6 h-6 text-red-600" />
                <span className="text-sm text-center">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </Modal>

      {/* Desktop: Vertical sidebar */}
      <aside className="hidden md:block w-64 border-r-2 border-black bg-white h-full flex-shrink-0">
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
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

