'use client';

import { useEffect, useRef } from 'react';
import { X, Settings as SettingsIcon, Palette, Check, User, Shield } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
}: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      // Use a small delay to prevent immediate propagation
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      e.preventDefault();
      onClose();
    }
  };

  const handleThemeChange = (newTheme: 'default' | 'colorful') => {
    setTheme(newTheme);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center md:p-4 bg-black/50"
      onClick={handleOverlayClick}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div 
        ref={modalRef} 
        className="bg-white md:rounded-lg border-2 border-black w-full h-full md:w-full md:h-auto md:max-w-md md:max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-black" />
            <h2 className="text-xl font-bold text-black">Settings</h2>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
            }}
            className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* User Info */}
        {user && (
          <div className="p-4 border-b-2 border-black">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden bg-black relative aspect-square">
                {user.userPicture ? (
                  <Image
                    src={user.userPicture}
                    alt={`${user.firstName} ${user.lastName}`}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                ) : (
                  <span className="text-lg font-bold text-white">
                    {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-black truncate">
                  {user.firstName} {user.lastName}
                </h3>
                <p className="text-sm text-gray-600 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}

        {/* Settings Sections */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Theme Settings */}
          <div className="border-2 border-black rounded-lg bg-white">
            <div className="p-4 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-black" />
                <h3 className="text-base font-bold text-black">Theme</h3>
              </div>
            </div>
            <div className="p-2">
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
          </div>

          {/* Account Settings */}
          <div className="border-2 border-black rounded-lg bg-white">
            <div className="p-4 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-black" />
                <h3 className="text-base font-bold text-black">Account</h3>
              </div>
            </div>
            <div className="p-2">
              <button
                onClick={() => {
                  onClose();
                  router.push('/profile/edit');
                }}
                className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-medium text-black cursor-pointer"
              >
                Edit Profile
              </button>
              <button
                onClick={() => {
                  onClose();
                  router.push('/account-management');
                }}
                className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-medium text-black cursor-pointer"
              >
                Account Management
              </button>
            </div>
          </div>

          {/* Privacy & Security */}
          <div className="border-2 border-black rounded-lg bg-white">
            <div className="p-4 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-black" />
                <h3 className="text-base font-bold text-black">Privacy & Security</h3>
              </div>
            </div>
            <div className="p-2">
              <button
                onClick={() => {
                  onClose();
                  router.push('/help');
                }}
                className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-medium text-black cursor-pointer"
              >
                Help & Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

