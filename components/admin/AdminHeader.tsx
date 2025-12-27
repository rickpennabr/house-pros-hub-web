'use client';

import Link from 'next/link';
import Image from 'next/image';
import Logo from '@/components/Logo';
import { Bell } from 'lucide-react';
import { AdminAccountButton } from './AdminAccountButton';

interface AdminHeaderProps {
  userEmail: string;
  notificationCount?: number;
}

export function AdminHeader({ userEmail, notificationCount = 0 }: AdminHeaderProps) {
  return (
    <header className="w-full h-[60px] border-b-2 border-black p-2 md:px-2 md:py-4 bg-white sticky top-0 z-50">
      <div className="relative w-full h-full flex items-center gap-2">
        {/* Left: Small logo button on mobile, large logo on desktop */}
        <div className="flex items-center flex-shrink-0 z-10">
          {/* Mobile: Small logo button */}
          <Link
            href="/"
            className="md:hidden w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white shrink-0 hover:bg-gray-50 transition-colors overflow-hidden cursor-pointer"
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
          {/* Desktop: Large logo */}
          <Link
            href="/"
            className="hidden md:block flex-shrink-0 cursor-pointer"
            aria-label="Go to home page"
          >
            <Logo width={200} height={50} className="h-12 w-auto" />
          </Link>
        </div>

        {/* Center: Admin Center title */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-0">
          <h1 className="text-base md:text-2xl font-bold text-black whitespace-nowrap">
            Admin Center
          </h1>
        </div>

        {/* Right: Notification Bell and Admin Account Button */}
        <div className="flex items-center flex-shrink-0 ml-auto z-[100] gap-2">
          <button
            className="relative w-10 h-10 rounded-lg bg-white flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors bell-shake-on-hover"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-black" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold border-2 border-white">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>
          <AdminAccountButton userEmail={userEmail} />
        </div>
      </div>
    </header>
  );
}

