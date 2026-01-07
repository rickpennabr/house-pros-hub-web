'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { createLocalePath, createSignInUrl } from '@/lib/redirect';
import SettingsModal from '@/components/settings/SettingsModal';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import type { Locale } from '@/i18n';
import { 
  Building2, 
  Settings, 
  LogIn, 
  LogOut, 
  HelpCircle,
  Users,
  LayoutDashboard
} from 'lucide-react';

interface ProfileIconProps {
  className?: string;
}

export default function ProfileIcon({ className = '' }: ProfileIconProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const t = useTranslations('common.account');
  const { isAuthenticated, logout, user } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const pictureUrl = user?.userPicture;
  const [imageErrorState, setImageErrorState] = useState<{ url?: string; hasError: boolean }>(() => ({
    url: pictureUrl,
    hasError: false,
  }));
  const [dropdownImageErrorState, setDropdownImageErrorState] = useState<{ url?: string; hasError: boolean }>(() => ({
    url: pictureUrl,
    hasError: false,
  }));
  const imageError = imageErrorState.url === pictureUrl ? imageErrorState.hasError : false;
  const dropdownImageError =
    dropdownImageErrorState.url === pictureUrl ? dropdownImageErrorState.hasError : false;
  
  // Check if user is a contractor (has companyName) or has businesses
  const hasBusiness = !!user?.companyName;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const userInitials = user 
    ? (user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase()
    : '';
  
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
    <div className="relative z-[100]">
      <button
        ref={buttonRef}
        onClick={handleAccountButtonClick}
        className={`w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden relative ${className}`}
        aria-label={t('account')}
      >
        {isAuthenticated && user?.userPicture && !imageError ? (
          user.userPicture.startsWith('data:') ? (
            <Image
              src={user.userPicture}
              alt={`${user.firstName} ${user.lastName}`}
              fill
              className="object-cover"
              sizes="40px"
              unoptimized
              onError={() => setImageErrorState({ url: pictureUrl, hasError: true })}
            />
          ) : (
            <Image
              src={user.userPicture}
              alt={`${user.firstName} ${user.lastName}`}
              fill
              className="object-cover"
              sizes="40px"
              quality={90}
              priority={false}
              onError={() => setImageErrorState({ url: pictureUrl, hasError: true })}
            />
          )
        ) : isAuthenticated ? (
          <div className="w-full h-full bg-black flex items-center justify-center">
            <span className="text-xs font-bold text-white leading-none">
              {userInitials}
            </span>
          </div>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
        )}
      </button>

      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-64 bg-white rounded-lg border-2 border-black shadow-lg z-[100] overflow-hidden"
        >
          {/* Account Section */}
          {isAuthenticated ? (
            <>
              <div className="px-4 py-3 flex items-center gap-3 border-b-2 border-black bg-gray-50 h-[60px]">
                <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden bg-black relative aspect-square">
                  {user?.userPicture && !dropdownImageError ? (
                    user.userPicture.startsWith('data:') ? (
                      <Image
                        src={user.userPicture}
                        alt={`${user.firstName} ${user.lastName}`}
                        fill
                        className="object-cover"
                        sizes="40px"
                        unoptimized
                        onError={() => setDropdownImageErrorState({ url: pictureUrl, hasError: true })}
                      />
                    ) : (
                      <Image
                        src={user.userPicture}
                        alt={`${user.firstName} ${user.lastName}`}
                        fill
                        className="object-cover"
                        sizes="40px"
                        quality={90}
                        priority={false}
                        onError={() => setDropdownImageErrorState({ url: pictureUrl, hasError: true })}
                      />
                    )
                  ) : (
                    <span className="text-sm font-bold text-white">
                      {userInitials}
                    </span>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-black truncate">
                    {user ? `${user.firstName} ${user.lastName}` : 'User'}
                  </span>
                  <span className="text-[10px] text-gray-600 truncate">
                    {user?.email}
                  </span>
                </div>
              </div>
              <div className="p-2 h-[60px]">
                {hasBusiness && (
                  <button
                    onClick={() => handleMenuItemClick('/businesslist')}
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>{t('myBusiness')}</span>
                  </button>
                )}
                {/* Admin Dash - Only for specific email */}
                {user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() && (
                  <Link
                    href="/admin"
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer mb-1"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Admin Dash</span>
                  </Link>
                )}
                <button
                  onClick={() => handleMenuItemClick('/account-management')}
                  className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  <span>{t('accountManagement')}</span>
                </button>
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
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setIsSettingsModalOpen(false)} 
      />
    </div>
  );
}
