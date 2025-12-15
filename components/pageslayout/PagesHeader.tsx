'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useTheme } from '@/contexts/ThemeContext';
import Logo from '../Logo';
import ProfileIcon from './ProfileIcon';
import LanguageSwitcher from './LanguageSwitcher';

interface PageHeaderProps {
  children?: ReactNode;
}

export default function PageHeader({ children }: PageHeaderProps) {
  const { getThemeClasses } = useTheme();
  const headerClass = getThemeClasses('header');

  return (
    <header className={`w-full h-[60px] ${headerClass} p-2 md:px-2 md:py-4`}>
      <div className="relative w-full h-full flex items-center">
        {/* Left: Language Switcher */}
        <div className="flex items-center flex-shrink-0 z-10">
          <LanguageSwitcher />
        </div>

        {/* Center: Logo - absolutely centered */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-0">
          <Link href="/" className="cursor-pointer">
            <Logo width={200} height={50} className="h-11 md:h-12 w-auto" />
          </Link>
        </div>

        {/* Right: Profile Icon */}
        <div className="flex items-center flex-shrink-0 ml-auto z-[100]">
          <ProfileIcon />
        </div>

        {children}
      </div>
    </header>
  );
}

