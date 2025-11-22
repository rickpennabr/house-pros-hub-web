'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Building, Map } from 'lucide-react';

interface PagesMenuProps {
  children?: ReactNode;
}

type MenuItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
};

const menuItems: MenuItem[] = [
  { label: 'ProsBlog', path: '/blog', icon: BookOpen },
  { label: 'HousePros', path: '/businesslist', icon: Building },
  { label: 'ProsMap', path: '/mapview', icon: Map },
];

export default function PagesMenu({ children }: PagesMenuProps) {
  const pathname = usePathname();

  const menuItemClasses = (path: string) => {
    const baseClasses = 'h-10 rounded-full border-2 transition-all font-medium flex items-center justify-center md:px-4 gap-1 flex-1 cursor-pointer';
    // Active item: same style as ProfileIcon - bg-white border-2 border-black
    const activeClasses = 'bg-white border-black text-black';
    const inactiveClasses = 'bg-transparent border-transparent text-black hover:border-gray-400';
    
    return pathname === path 
      ? `${baseClasses} ${activeClasses}`
      : `${baseClasses} ${inactiveClasses}`;
  };

  return (
    <div className="w-full h-[60px] border-b border-black p-2 md:p-4 flex items-center gap-2 md:gap-4">
      {menuItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            href={item.path}
            className={menuItemClasses(item.path)}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
      {children}
    </div>
  );
}

