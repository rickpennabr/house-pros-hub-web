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
import { useChat } from '@/contexts/ChatContext';
import { HUB_WHATSAPP_URL } from '@/lib/constants/company';
import { sendAnalyticsIngest } from '@/lib/utils/analyticsIngest';

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

function WhatsAppButton() {
  if (!HUB_WHATSAPP_URL) return null;
  return (
    <a
      href={HUB_WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="w-10 h-10 rounded-lg border-2 border-black bg-[#25D366] flex items-center justify-center text-white hover:bg-[#20bd5a] transition-colors"
      aria-label="WhatsApp"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  );
}

const NEW_SIGNUPS_POLL_MS = 60 * 1000;

export default function PageHeader({ children }: PageHeaderProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const headerRef = useRef<HTMLElement>(null);
  const { isAdmin, isAuthenticated, roles } = useAuth();
  const { chatUnreadCount } = useChat();
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
  const isCustomer = !isAdmin && !isContractor;
  const showFreeEstimate = (isHomePage || isSuppliersPage) && !isAdmin && !isContractor;
  /** Mobile header logo: mobile-optimized logo with Pro Bot */
  const mobileLogoSrc = '/hph-logo-with-pro-bot-mobile.png';
  /** Mobile dark (dynamic sky or system dark): white logo (same as desktop dark for consistency) */
  const mobileDarkLogoSrc = '/hph-logo-with-pro-bot-wt.png';
  /** PC desktop dark (dynamic sky or system dark): white logo */
  const desktopDarkLogoSrc = '/hph-logo-with-pro-bot-wt.png';

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
      
      sendAnalyticsIngest({
        location: 'PagesHeader.tsx:25',
        message: 'Header dimensions',
        data: logData,
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'C',
      });
    };
    
    checkDimensions();
    const resizeObserver = new ResizeObserver(checkDimensions);
    resizeObserver.observe(headerEl);
    
    return () => resizeObserver.disconnect();
  }, []);
  // #endregion

  return (
    <header ref={headerRef} className="w-full h-[60px] border-b-2 border-black p-1 md:px-2 flex-shrink-0 flex items-center">
      <div className="relative w-full h-10 flex items-center justify-between gap-2">
        {/* Left: Logo button for legal pages, Language Switcher for others */}
        <div className="flex items-center flex-shrink-0 z-10 h-10">
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
          <div className="flex flex-1 items-center justify-center overflow-hidden h-10 min-w-0 shrink-0">
            <Link href={`/${locale}/businesslist`} className="cursor-pointer flex items-center justify-center min-w-0 max-w-full h-10 shrink-0">
              <Logo width={160} height={40} className="h-[40px] md:h-[40px] w-auto object-contain logo-header" mobileSrc={mobileLogoSrc} mobileDarkSrc={mobileDarkLogoSrc} desktopDarkSrc={desktopDarkLogoSrc} />
            </Link>
          </div>
        )}

        {/* Right: Actions — fixed h-10 row so all buttons align evenly */}
        <div className="flex items-center justify-end flex-shrink-0 gap-2 h-10 z-[100]">
          {showFreeEstimate && <span className="flex items-center h-10 shrink-0"><FreeEstimateButton /></span>}
          {!isLegalPage && !isAdmin && (
            <>
              <span className="hidden md:flex items-center h-10 shrink-0"><PhoneButton /></span>
              <span className="hidden md:flex items-center h-10 shrink-0"><WhatsAppButton /></span>
            </>
          )}
          {isAuthenticated && !isLegalPage && (
            <span className="flex items-center h-10 shrink-0">
              {isAdmin ? (
                <NotificationBellDropdown
                  notificationCount={notificationCount}
                  onMarkAllRead={fetchNewSignupsCount}
                />
              ) : (
                <NotificationBellDropdown
                  variant="chat"
                  notificationCount={chatUnreadCount}
                  locale={locale}
                />
              )}
            </span>
          )}
          <span className="flex items-center h-10 shrink-0"><ProfileIcon /></span>
        </div>

        {children}
      </div>
    </header>
  );
}

