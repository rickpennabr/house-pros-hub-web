'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

interface AccountManagementLayoutProps {
  children: ReactNode;
}

export default function AccountManagementLayout({ children }: AccountManagementLayoutProps) {
  const { getThemeClasses } = useTheme();
  const { user } = useAuth();
  const headerClass = getThemeClasses('header');
  const containerClass = getThemeClasses('container');

  // Get business logo or use initials
  const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    } else {
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
  };

  const businessName = user?.companyName || user?.firstName + ' ' + user?.lastName || 'Business';
  const businessLogo = null; // TODO: Get from user/business data when available
  const initials = getInitials(businessName);

  return (
    <div className="min-h-screen w-full bg-white">
      {/* Container with same max-width as other pages */}
      <div className={`w-full max-w-[960px] min-h-screen mx-auto ${containerClass} bg-white`}>
        {/* Header - Same height as other pages */}
        <header className={`w-full h-[60px] ${headerClass} p-2 md:px-2 md:py-4`}>
          <div className="relative w-full h-full flex items-center">
          {/* Left: House image button to go back to home */}
          <div className="flex items-center flex-shrink-0 z-10">
            <Link
              href="/"
              className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white shrink-0 hover:bg-gray-50 transition-colors overflow-hidden cursor-pointer"
              aria-label="Go to home page"
            >
              <Image
                src="/hph-logo-simble-sq-white-bg-2.2.png"
                alt="House Pros Hub"
                width={40}
                height={40}
                className="w-full h-full object-contain"
              />
            </Link>
          </div>

          {/* Center: Account Management title */}
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-0">
            <h1 className="text-xl md:text-2xl font-bold text-black">
              Account Management
            </h1>
          </div>

          {/* Right: Business Logo */}
          <div className="flex items-center flex-shrink-0 ml-auto z-[100]">
            <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden bg-black">
              {businessLogo ? (
                <Image
                  src={businessLogo}
                  alt={businessName}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-white">{initials}</span>
              )}
            </div>
          </div>
        </div>
      </header>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}

