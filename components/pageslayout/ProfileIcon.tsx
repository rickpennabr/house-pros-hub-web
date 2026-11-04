'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountSwitch } from '@/contexts/AccountSwitchContext';
import { createLocalePath, createSignInUrl } from '@/lib/redirect';
import SettingsModal from '@/components/settings/SettingsModal';
import { AccountAvatar } from '@/components/pageslayout/AccountAvatar';
import { AccountSwitchModal, AccountSwitchRows } from '@/components/pageslayout/AccountSwitcher';
import type { Locale } from '@/i18n';
import { 
  Settings, 
  LogIn, 
  LogOut, 
  HelpCircle,
  Users,
  LayoutDashboard,
  MessageCircle,
  Briefcase,
  HardDrive,
  Home,
  Calendar,
  Zap
} from 'lucide-react';

interface ProfileIconProps {
  className?: string;
}

export default function ProfileIcon({ className = '' }: ProfileIconProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const t = useTranslations('common.account');
  const tNav = useTranslations('navigation');
  const { isAuthenticated, isAdmin, logout, user, roles } = useAuth();
  const { activeAccount, activeAccountId, accounts } = useAccountSwitch();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAccountListOpen, setIsAccountListOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; right: number } | null>(null);

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
  const displayPicture = activeAccount ? activeAccount.avatar : user?.userPicture;
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
        className={`w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden relative text-black ${className}`}
        aria-label={t('account')}
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
          className="fixed w-64 bg-white rounded-lg border-2 border-black shadow-lg z-[300] overflow-hidden"
          style={{ top: menuBox.top, right: menuBox.right }}
        >
          {/* Account Section */}
          {isAuthenticated ? (
            <>
              <div className="px-4 py-3 flex items-center gap-3 border-b-2 border-black bg-gray-50 h-[60px]">
                <AccountAvatar
                  src={displayPicture}
                  name={displayName}
                  className="w-10 h-10"
                  textClassName="text-sm"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-black truncate">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-gray-600 truncate">
                    {displaySubtitle}
                  </span>
                </div>
              </div>
              <AccountSwitchRows
                onOpenList={() => {
                  setIsDropdownOpen(false);
                  setIsAccountListOpen(true);
                }}
                onSwitched={() => setIsDropdownOpen(false)}
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
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Admin Dash</span>
                  </Link>
                )}
                {showMyPlaces && (
                  <button
                    onClick={() => handleMenuItemClick('/myplaces')}
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                  >
                    <Home className="w-4 h-4" />
                    <span>{t('myPlaces')}</span>
                  </button>
                )}
                <button
                  onClick={() => handleMenuItemClick('/appointments')}
                  className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>{t('appointments')}</span>
                </button>
                <button
                  onClick={() => handleMenuItemClick('/account-management')}
                  className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  <span>{t('accountManagement')}</span>
                </button>
                {activeIsBusiness && !isAdmin && (
                  <button
                    onClick={() => handleMenuItemClick('/crm')}
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>{t('proscrm')}</span>
                  </button>
                )}
                {activeIsBusiness && (
                  <button
                    onClick={() => handleMenuItemClick('/prodrive')}
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                  >
                    <HardDrive className="w-4 h-4" />
                    <span>ProDrive</span>
                  </button>
                )}
                {showProbot && (
                  <button
                    onClick={() => handleMenuItemClick('/probot')}
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
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
                <LogIn className="w-4 h-4" />
                <span>{t('signIn')}</span>
              </button>
            </div>
          )}

          {/* Settings Section */}
          {isAuthenticated && (
            <>
              <div className="border-t-2 border-black"></div>
              <div className="p-2">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setIsSettingsModalOpen(true);
                  }}
                  className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  <span>{t('settings')}</span>
                </button>
              </div>
            </>
          )}

          {/* Help Section */}
          <div className="p-2">
            <button
              onClick={() => handleMenuItemClick('/help')}
              className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
              <span>{t('helpSupport')}</span>
            </button>
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
                  <LogOut className="w-4 h-4" />
                  <span>{t('signOut')}</span>
                </button>
              </div>
            </>
          )}

          <div className="border-t-2 border-black"></div>
          <div className="p-2">
            <button
              type="button"
              onClick={() => handleMenuItemClick('/quick-repair')}
              className="quick-repair-border w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 font-medium text-black cursor-pointer [--repair-fill:#fff] [--repair-fill-hover:#f9fafb]"
            >
              <Zap className="w-4 h-4" />
              <span>{tNav('quickRepair')}</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setIsSettingsModalOpen(false)} 
      />
      {isAccountListOpen && (
        <AccountSwitchModal
          isOpen
          onClose={() => setIsAccountListOpen(false)}
        />
      )}
    </div>
  );
}
