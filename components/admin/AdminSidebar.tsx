'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Eraser, 
  Package,
  Folder,
  LucideIcon 
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/businesses', label: 'Businesses', icon: Building2 },
  { href: '/admin/suppliers', label: 'Suppliers', icon: Package },
  { href: '/admin/storage', label: 'Storage', icon: Folder },
  { href: '/admin/clear-data', label: 'Clear Data', icon: Eraser },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActiveRoute = (itemHref: string) => {
    // Exact match
    if (pathname === itemHref) return true;
    
    // For base /admin route, only match exactly (not sub-routes)
    if (itemHref === '/admin') return false;
    
    // For other routes, match if pathname starts with the route + '/'
    return pathname.startsWith(itemHref + '/');
  };

  return (
    <>
      {/* Mobile: Horizontal scrollable menu - positioned absolutely at top */}
      <div className="md:hidden w-full border-b-2 border-black bg-white fixed top-[60px] left-0 right-0 z-40">
        <nav className="flex items-center gap-3 overflow-x-auto scrollbar-custom px-2 py-2 h-[60px]">
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
      </div>

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

