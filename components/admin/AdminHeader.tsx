'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X } from 'lucide-react';
import { AdminAccountButton } from './AdminAccountButton';
import { NotificationBellDropdown } from './NotificationBellDropdown';
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

  const handleClear = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

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
          <div className="relative w-full max-w-xl">
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
        </div>

        {/* Right: Notification Bell and Admin Account Button */}
        <div className="flex items-center flex-shrink-0 gap-2 ml-auto md:ml-0">
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

