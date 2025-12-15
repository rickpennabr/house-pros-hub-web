'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
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
  const { getThemeClasses } = useTheme();
  const menuClass = getThemeClasses('menu');

  const menuItemClasses = (path: string) => {
    const baseClasses = 'group h-10 border-2 transition-all duration-300 font-medium flex items-center justify-center md:px-4 gap-1 flex-1 cursor-pointer hover:scale-[1.02]';
    // Active item: always use black border (not theme-aware)
    const activeClasses = 'bg-white border-black text-black rounded-lg';
    // Inactive item: use rounded-lg to match active shape, including on hover
    const inactiveClasses = 'bg-transparent border-transparent text-black hover:border-gray-400 rounded-lg';
    
    return pathname === path 
      ? `${baseClasses} ${activeClasses}`
      : `${baseClasses} ${inactiveClasses}`;
  };

  return (
    <div className={`w-full h-[60px] ${menuClass} p-2 md:px-2 md:py-4 flex items-center gap-2 md:gap-4`}>
      {menuItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            href={item.path}
            className={menuItemClasses(item.path)}
          >
            <Icon className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 transition-transform duration-300 group-hover:scale-125" />
            <span className="text-sm md:text-base lg:text-lg">{item.label}</span>
          </Link>
        );
      })}
      {children}
    </div>
  );
}

