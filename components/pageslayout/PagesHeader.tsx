'use client';

import { ReactNode, useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import Logo from '../Logo';
import ProfileIcon from './ProfileIcon';
import LanguageSwitcher from './LanguageSwitcher';
import FreeEstimateButton from './FreeEstimateButton';
import PhoneButton from './PhoneButton';
import { NotificationBellDropdown } from '@/components/admin/NotificationBellDropdown';
import { Phone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface PageHeaderProps {
  children?: ReactNode;
}

function CallButton() {
  const phoneNumber = '702-232-0411';
  
  const handlePhoneClick = () => {
    window.location.href = `tel:${phoneNumber.replace(/-/g, '')}`;
  };

  return (
    <button
      onClick={handlePhoneClick}
      className="
        w-10 h-10 
        rounded-lg 
        border-2 border-black 
        bg-white 
        text-black
        flex items-center justify-center 
        cursor-pointer 
        hover:bg-gray-50 
        transition-colors
      "
      aria-label={`Call ${phoneNumber}`}
    >
      <Phone className="w-5 h-5" />
    </button>
  );
}

const NEW_SIGNUPS_POLL_MS = 60 * 1000;

export default function PageHeader({ children }: PageHeaderProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const headerRef = useRef<HTMLElement>(null);
  const { isAdmin, roles } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);

  const fetchNewSignupsCount = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/admin/notifications/new-signups-count', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.count === 'number') setNotificationCount(data.count);
    } catch {
      // ignore
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchNewSignupsCount();
    const interval = setInterval(fetchNewSignupsCount, NEW_SIGNUPS_POLL_MS);
    return () => clearInterval(interval);
  }, [isAdmin, fetchNewSignupsCount]);

  const isLegalPage = pathname?.includes('/legal');
  const isHomePage = pathname?.includes('/businesslist') || pathname === `/${locale}` || pathname === `/${locale}/`;
  const isSuppliersPage = pathname?.includes('/prosuppliers');
  const isContractor = roles.includes('contractor');
  const showFreeEstimate = (isHomePage || isSuppliersPage) && !isAdmin && !isContractor;

  // #region agent log - Development only
  useEffect(() => {
    // Only run debug logging in development mode
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof window === 'undefined') return;
    const headerEl = headerRef.current;
    if (!headerEl) return;
    
    const checkDimensions = () => {
      // Double-check we're in development before making the request
      if (process.env.NODE_ENV !== 'development') return;
      
      const logData = {
        headerWidth: headerEl.offsetWidth,
        headerHeight: headerEl.offsetHeight,
        headerScrollWidth: headerEl.scrollWidth,
        headerClientWidth: headerEl.clientWidth,
        windowWidth: window.innerWidth,
        hasHorizontalOverflow: headerEl.scrollWidth > headerEl.clientWidth,
        isMobile: window.innerWidth < 768,
      };
      
      // Silently fail if analytics endpoint is not available
      // Use AbortController with timeout to fail fast and suppress console errors
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 100); // 100ms timeout
      
      fetch('http://127.0.0.1:7243/ingest/461d373c-ca6e-41da-982f-915e017b1f50', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'PagesHeader.tsx:25',
          message: 'Header dimensions',
          data: logData,
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'C',
        }),
        signal: controller.signal,
      }).catch(() => {
        // Silently handle errors - this is debug-only code
        // Network errors are expected when analytics service is not running
      }).finally(() => {
        clearTimeout(timeoutId);
      });
    };
    
    checkDimensions();
    const resizeObserver = new ResizeObserver(checkDimensions);
    resizeObserver.observe(headerEl);
    
    return () => resizeObserver.disconnect();
  }, []);
  // #endregion

  return (
    <header ref={headerRef} className="w-full min-h-[60px] h-[60px] border-b-2 border-black px-2 md:px-2 py-2 md:py-0 flex-shrink-0">
      <div className="relative w-full h-full flex items-center justify-between gap-2">
        {/* Left: Logo button for legal pages, Language Switcher for others */}
        <div className="flex items-center flex-shrink-0 z-10">
          {isLegalPage ? (
            <Link
              href={`/${locale}/businesslist`}
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
          ) : (
            <LanguageSwitcher />
          )}
        </div>

        {/* Center: "HouseProsHub Legal" label on legal pages, Logo on others */}
        {isLegalPage ? (
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-0 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-black whitespace-nowrap">
              HouseProsHub Legal
            </h1>
          </div>
        ) : (
          <div className="flex items-center justify-center flex-shrink min-w-0">
            <Link href={`/${locale}/businesslist`} className="cursor-pointer">
              <Logo width={200} height={50} className="h-9 md:h-12 w-auto object-contain" />
            </Link>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center flex-shrink-0 gap-2 z-[100]">
          {showFreeEstimate && <FreeEstimateButton />}
          {!isLegalPage && (
            <>
              {isAdmin ? (
                <NotificationBellDropdown
                  notificationCount={notificationCount}
                  onMarkAllRead={fetchNewSignupsCount}
                />
              ) : (
                <>
                  <div className="hidden md:block">
                    <PhoneButton />
                  </div>
                  <div className="md:hidden">
                    <CallButton />
                  </div>
                </>
              )}
            </>
          )}
          <ProfileIcon />
        </div>

        {children}
      </div>
    </header>
  );
}

