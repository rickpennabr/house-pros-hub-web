'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { createSignInUrl } from '@/lib/redirect';
import SettingsModal from '@/components/settings/SettingsModal';
import { 
  Check, 
  User, 
  Building2, 
  Settings, 
  LogIn, 
  LogOut, 
  HelpCircle,
  Palette,
  Users
} from 'lucide-react';

interface ProfileIconProps {
  className?: string;
}

export default function ProfileIcon({ className = '' }: ProfileIconProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, logout, user } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Check if user is a contractor (has companyName) or has businesses
  const hasBusiness = !!user?.companyName;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Reset image error when user or picture changes
  useEffect(() => {
    setImageError(false);
  }, [user?.userPicture]);

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

  const handleThemeChange = (newTheme: 'default' | 'colorful') => {
    setTheme(newTheme);
    setIsDropdownOpen(false);
  };

  const handleSignOut = () => {
    logout();
    setIsDropdownOpen(false);
    router.push('/signin');
  };

  const handleMenuItemClick = (path: string) => {
    router.push(path);
    setIsDropdownOpen(false);
  };

  const handleAccountButtonClick = () => {
    if (isAuthenticated) {
      // If logged in, toggle the dropdown menu
      setIsDropdownOpen(!isDropdownOpen);
    } else {
      // If not logged in, redirect to sign in with return URL
      const signInUrl = createSignInUrl(pathname);
      router.push(signInUrl);
    }
  };

  return (
    <div className="relative z-[100]">
      <button
        ref={buttonRef}
        onClick={handleAccountButtonClick}
        className={`h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors px-2 md:px-4 gap-2 ${className}`}
        aria-label="Account"
      >
        {isAuthenticated && user?.userPicture && !imageError ? (
          <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 border border-black relative aspect-square">
            <Image
              src={user.userPicture}
              alt={`${user.firstName} ${user.lastName}`}
              fill
              className="object-cover"
              sizes="28px"
              onError={() => setImageError(true)}
            />
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
        <span className="hidden md:inline font-medium text-black">Account</span>
      </button>

      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-64 bg-white rounded-lg border-2 border-black shadow-lg z-[100] overflow-hidden"
        >
          {/* Account Section */}
          {isAuthenticated ? (
            <>
              <div className="p-2">
                <div className="w-full text-left px-4 py-2.5 flex items-center gap-3 font-medium text-black cursor-default">
                  <User className="w-4 h-4" />
                  <span>{user ? `${user.firstName} ${user.lastName}` : 'User'}</span>
                </div>
                {hasBusiness && (
                  <button
                    onClick={() => handleMenuItemClick('/businesslist')}
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>My Business</span>
                  </button>
                )}
                <button
                  onClick={() => handleMenuItemClick('/account-management')}
                  className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  <span>Account Management</span>
                </button>
              </div>
              <div className="border-t-2 border-black"></div>
            </>
          ) : (
            <div className="p-2">
              <button
                onClick={() => handleMenuItemClick('/signin')}
                className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
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
                  <span>Settings</span>
                </button>
              </div>
            </>
          )}

          {/* Theme Section */}
          <div className="border-t-2 border-black"></div>
          <div className="p-2">
            <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
              <Palette className="w-3 h-3" />
              <span>Theme</span>
            </div>
            <button
              onClick={() => handleThemeChange('default')}
              className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between font-medium text-black cursor-pointer"
            >
              <span>Default</span>
              {theme === 'default' && (
                <Check className="w-4 h-4 text-black" />
              )}
            </button>
            <button
              onClick={() => handleThemeChange('colorful')}
              className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between font-medium text-black cursor-pointer"
            >
              <span>Colorful</span>
              {theme === 'colorful' && (
                <Check className="w-4 h-4 text-black" />
              )}
            </button>
          </div>

          {/* Help Section */}
          <div className="p-2">
            <button
              onClick={() => handleMenuItemClick('/help')}
              className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 font-medium text-black cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Help & Support</span>
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
                  <span>Sign Out</span>
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
