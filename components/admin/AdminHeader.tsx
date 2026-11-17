'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { QrCode } from 'lucide-react';
import { AdminAccountButton } from './AdminAccountButton';
import { NotificationBellDropdown } from './NotificationBellDropdown';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import { useAdminSearch } from './AdminSearchContext';

interface AdminHeaderProps {
  userEmail: string;
  notificationCount?: number;
  onSearchChange?: (query: string) => void;
  /** Called after marking notifications as read so the layout can refresh the badge count. */
  onMarkAllRead?: () => void;
}

export function AdminHeader({ userEmail, notificationCount = 0, onMarkAllRead }: AdminHeaderProps) {
  const { searchQuery, setSearchQuery } = useAdminSearch();
  const searchInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="w-full h-[60px] border-b-2 border-black px-2 md:px-2 py-2 md:py-2 bg-white sticky top-0 z-50 shrink-0">
      <div className="w-full h-full flex items-center gap-2 md:gap-3">
        {/* Left: Small logo + Admin Dash label */}
        <div className="flex items-center flex-shrink-0 gap-2">
          <Link
            href="/"
            className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white shrink-0 hover:bg-gray-50 transition-colors overflow-hidden cursor-pointer"
            aria-label="Go to home page"
          >
            <Image
              src="/house-pros-hub-logo-simble-bot.png"
              alt="House Pros Hub"
              width={40}
              height={40}
              className="w-full h-full object-contain"
            />
          </Link>
          <h1 className="text-xl md:text-2xl font-bold text-black whitespace-nowrap">
            Admin Dash
          </h1>
        </div>

        {/* Center: Search bar — desktop only; on mobile search is in sidebar row */}
        <div className="flex-1 min-w-0 hidden md:flex items-center justify-center px-2">
          <TypingSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search…"
            clearLabel="Clear search"
            inputRef={searchInputRef}
            className="relative w-full max-w-xl"
            inputClassName="h-10 w-full rounded-lg border-2 border-black bg-white pl-9 pr-9 text-sm text-black placeholder-gray-500 focus:outline-none dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-gray-100 dark:placeholder-gray-400"
            iconClassName="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500"
          />
        </div>

        {/* Right: site QR, notifications, account */}
        <div className="flex items-center flex-shrink-0 gap-2 ml-auto md:ml-0">
          <Link
            href="/admin/qrcodes"
            className="w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
            aria-label="QR code system"
          >
            <QrCode className="w-5 h-5 text-black" />
          </Link>
          <NotificationBellDropdown
            notificationCount={notificationCount}
            onMarkAllRead={onMarkAllRead}
          />
          <AdminAccountButton userEmail={userEmail} />
        </div>
      </div>
    </header>
  );
}

