'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useHoverMenu } from '@/hooks/useHoverMenu';
import { useAccountSwitch } from '@/contexts/AccountSwitchContext';
import { isHubPro } from '@/components/pageslayout/ProAddChooser';
import { createLocalePath, createSignInUrl } from '@/lib/redirect';
import { AccountAvatar } from '@/components/pageslayout/AccountAvatar';
import { AccountSwitchModal, AccountSwitchRows, BusinessAccountTools } from '@/components/pageslayout/AccountSwitcher';
import ShareBusinessModal from '@/components/businessdetails/ShareBusinessModal';
import type { SwitchAccount } from '@/contexts/AccountSwitchContext';
import type { Locale } from '@/i18n';
import { 
  Settings, 
  LogIn, 
  LogOut, 
  HelpCircle,
  LayoutDashboard,
  MessageCircle,
  Briefcase,
  HardDrive,
  Home,
  Calendar,
  Phone
} from 'lucide-react';

const HUB_PHONE_NUMBER = '702-232-0411';

interface ProfileIconProps {
  className?: string;
}

export default function ProfileIcon({ className = '' }: ProfileIconProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const t = useTranslations('common.account');
  const { isAuthenticated, isAdmin, logout, user, roles } = useAuth();
  const { activeAccount, activeAccountId, accounts, businesses } = useAccountSwitch();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAccountListOpen, setIsAccountListOpen] = useState(false);
  const [shareAccount, setShareAccount] = useState<SwitchAccount | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; right: number } | null>(null);
  const { openOnHover, closeOnHover, cancelClose } = useHoverMenu(
    setIsDropdownOpen,
    [buttonRef, dropdownRef],
    isAuthenticated,
  );

  // The page card uses a transform, so a menu inside it cannot stack above the
  // body-portaled ProBot. Pin the menu to the viewport instead.
  useLayoutEffect(() => {
    if (!isDropdownOpen) return;

    const update = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setMenuBox({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isDropdownOpen]);

  const personalName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
  const displayName = activeAccount?.name || personalName || 'User';
  // A business is active but its details are not loaded yet: show no photo rather than the personal one.
  const displayPicture = activeAccount
    ? activeAccount.avatar
    : user?.id && activeAccountId && activeAccountId !== user.id
      ? undefined
      : user?.userPicture;
  const displaySubtitle =
    activeAccount?.type === 'business' ? t('businessAccount') : user?.email;
  const isContractor = !!user?.businessId;
  const activeIsBusiness =
    activeAccount?.type === 'business' ||
    (!!user?.id && !!activeAccountId && activeAccountId !== user.id);
  const isPro =
    isContractor ||
    activeIsBusiness ||
    roles.includes('contractor') ||
    accounts.some((account) => account.type === 'business');
  const showMyPlaces = !activeIsBusiness;
  const showProbot = !isPro;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  const handleSignOut = () => {
    logout();
    setIsDropdownOpen(false);
    // User stays on current page after sign out
  };

  const handleMenuItemClick = (path: string) => {
    // Ensure internal navigation stays locale-prefixed
    router.push(createLocalePath(locale, path));
    setIsDropdownOpen(false);
  };

  const handleCallHub = () => {
    setIsDropdownOpen(false);
    window.location.href = `tel:${HUB_PHONE_NUMBER.replace(/-/g, '')}`;
  };

  const handleAccountButtonClick = () => {
    if (isAuthenticated) {
      // If logged in, toggle the dropdown menu
      setIsDropdownOpen(!isDropdownOpen);
    } else {
      // If not logged in, redirect to sign in with return URL
      const signInUrl = createSignInUrl(locale, pathname ?? '/businesslist');
      router.push(signInUrl);
    }
  };

  return (
    <div className="relative z-[200]">
      <button
        ref={buttonRef}
        onClick={handleAccountButtonClick}
        onMouseEnter={openOnHover}
        onMouseLeave={closeOnHover}
        className={`w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden relative text-black ${className}`}
        aria-label={t('account')}
        aria-expanded={isDropdownOpen}
        aria-haspopup="menu"
      >
        {isAuthenticated ? (
          <AccountAvatar
            src={displayPicture}
            name={displayName}
            className="w-full h-full"
            framed={false}
            textClassName="text-xs"
          />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5 shrink-0 !text-black"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
        )}
      </button>

      {isDropdownOpen && menuBox && createPortal(
        <div
          ref={dropdownRef}
          onMouseEnter={cancelClose}
          onMouseLeave={closeOnHover}
          className="fixed z-[300] w-64 pt-2"
          style={{ top: menuBox.top - 8, right: menuBox.right }}
        >
        <div className="overflow-hidden rounded-lg border-2 border-black bg-white shadow-lg">
          {/* Account Section */}
          {isAuthenticated ? (
            <>
              <div className="px-2 py-3 flex items-center gap-3 border-b-2 border-black bg-gray-50 h-[60px]">
                <AccountAvatar
                  src={displayPicture}
                  name={displayName}
                  className="w-10 h-10"
                  textClassName="text-sm"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-bold text-black truncate">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-gray-600 truncate">
                    {displaySubtitle}
                  </span>
                </div>
                {activeAccount?.type === 'business' && (
                  <BusinessAccountTools
                    onShare={() => {
                      setShareAccount(activeAccount);
                      setIsDropdownOpen(false);
                    }}
                  />
                )}
              </div>
              <AccountSwitchRows
                onOpenList={() => {
                  setIsDropdownOpen(false);
                  setIsAccountListOpen(true);
                }}
                onSwitched={() => setIsDropdownOpen(false)}
                onShareBusiness={(account) => {
                  setShareAccount(account);
                  setIsDropdownOpen(false);
                }}
              />
              {/* Account / Admin section - same style as Settings and Help */}
              <div className="border-t-2 border-black"></div>
              <div className="p-2">
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer mb-1"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <LayoutDashboard className="w-4 h-4 text-red-600" />
                    <span>Admin Dash</span>
                  </Link>
                )}
                {showMyPlaces && (
                  <button
                    onClick={() => handleMenuItemClick('/myplaces')}
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                  >
                    <Home className="w-4 h-4 text-red-600" />
                    <span>{t('myPlaces')}</span>
                  </button>
                )}
                {!activeIsBusiness && (
                  <button
                    onClick={() => handleMenuItemClick('/appointments')}
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 text-red-600" />
                    <span>{t('appointments')}</span>
                  </button>
                )}
                {activeIsBusiness && !isAdmin && (
                  <button
                    onClick={() => handleMenuItemClick('/crm/portal')}
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                  >
                    <Home className="w-4 h-4 text-red-600" />
                    <span>{t('customerPortal')}</span>
                  </button>
                )}
                {activeIsBusiness && !isAdmin && (
                  <button
                    onClick={() => handleMenuItemClick('/crm')}
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                  >
                    <Briefcase className="w-4 h-4 text-red-600" />
                    <span>{t('proscrm')}</span>
                  </button>
                )}
                {activeIsBusiness && (
                  <button
                    onClick={() => handleMenuItemClick('/prodrive')}
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                  >
                    <HardDrive className="w-4 h-4 text-red-600" />
                    <span>ProDrive</span>
                  </button>
                )}
                {isPro && (
                  <button
                    onClick={() => handleMenuItemClick('/probot')}
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                  >
                    <Image src="/hph-pro-bot.jpg" alt="" width={20} height={20} className="h-5 w-5 rounded-md bg-black object-contain" />
                    <span>{t('probot')}</span>
                  </button>
                )}
                <button
                  onClick={() => handleMenuItemClick('/account-management')}
                  className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-red-600" />
                  <span>{t('accountManagement')}</span>
                </button>
                {showProbot && (
                  <button
                    onClick={() => handleMenuItemClick('/probot')}
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 text-red-600" />
                    <span>{t('probot')}</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="p-2">
              <button
                onClick={() => handleMenuItemClick('/signin')}
                className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-red-600" />
                <span>{t('signIn')}</span>
              </button>
            </div>
          )}

          <div className="border-t-2 border-black"></div>
          <div className="p-2">
            <button
              onClick={() => handleMenuItemClick('/help')}
              className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-red-600" />
              <span>{t('helpSupport')}</span>
            </button>
            {isAuthenticated && isHubPro(roles) && (
              <button
                type="button"
                onClick={handleCallHub}
                className="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 text-left font-medium text-black transition-colors hover:bg-gray-50 md:hidden"
              >
                <Phone className="w-4 h-4 text-red-600" />
                <span>{t('callTheHub')}</span>
              </button>
            )}
          </div>

          {/* Sign Out (if authenticated) */}
          {isAuthenticated && (
            <>
              <div className="border-t-2 border-black"></div>
              <div className="p-2">
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-3 font-medium text-red-600 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-red-600" />
                  <span>{t('signOut')}</span>
                </button>
              </div>
            </>
          )}
        </div>
        </div>,
        document.body
      )}

      {isAccountListOpen && (
        <AccountSwitchModal
          isOpen
          onClose={() => setIsAccountListOpen(false)}
        />
      )}
      {shareAccount?.slug && (
        <ShareBusinessModal
          isOpen
          onClose={() => setShareAccount(null)}
          businessName={shareAccount.name}
          contractorType={businesses.find((business) => business.id === shareAccount.id)?.contractorType ?? ''}
          logo={shareAccount.avatar}
          businessUrl={`${window.location.origin}/${locale}/business/${shareAccount.slug}`}
        />
      )}
    </div>
  );
}
