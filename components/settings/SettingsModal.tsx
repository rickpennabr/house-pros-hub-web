'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Shield, Globe, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import Modal from '@/components/ui/Modal';
import { UsFlagIcon, SpainFlagIcon, BrazilFlagIcon } from '@/components/pageslayout/LocaleFlagIcons';
import { locales, type Locale } from '@/i18n';

type AccordionSection = 'account' | 'language' | 'privacy';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
}: SettingsModalProps) {
  const t = useTranslations('common');
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale() as Locale;
  const [selectedLocale, setSelectedLocale] = useState<Locale>(currentLocale);
  const [isUpdatingLocale, setIsUpdatingLocale] = useState(false);
  const [openSection, setOpenSection] = useState<AccordionSection>('account');

  // Reset selected locale and accordion when modal opens or current locale changes
  useEffect(() => {
    if (isOpen) {
      setSelectedLocale(currentLocale);
      setOpenSection('account');
    }
  }, [isOpen, currentLocale]);

  const hasChanges = selectedLocale !== currentLocale;

  const handleSaveChanges = async () => {
    if (!user || !hasChanges || isUpdatingLocale) return;

    setIsUpdatingLocale(true);
    try {
      // Update user's preferred locale in database
      await updateUser({ preferredLocale: selectedLocale });

      // Close modal first
      onClose();

      // Wait a brief moment to ensure the update is processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Navigate to the new locale using full page reload to maintain session (support en, es, pt)
      let pathWithoutLocale = pathname;
      if (pathname.startsWith(`/${currentLocale}`)) {
        pathWithoutLocale = pathname.replace(`/${currentLocale}`, '') || '/';
      } else if ((locales as readonly string[]).some((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`)) {
        pathWithoutLocale = '/' + pathname.split('/').slice(2).join('/') || '/';
      }
      const newPath = `/${selectedLocale}${pathWithoutLocale}`;
      
      // Use window.location.href for full page reload to ensure session is maintained
      window.location.href = newPath;
    } catch (error) {
      console.error('Error updating language preference:', error);
      setIsUpdatingLocale(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-black" />
          <span>Settings</span>
        </div>
      }
      showHeader={true}
      maxWidth="md"
    >
      <div className="flex flex-col h-full">
        {/* User Info */}
        {user && (
          <div className="p-4 border-b-2 border-black">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden bg-black relative aspect-square">
                {user.userPicture ? (
                  user.userPicture.startsWith('data:') ? (
                    <Image
                      src={user.userPicture}
                      alt={`${user.firstName} ${user.lastName}`}
                      fill
                      className="object-cover"
                      sizes="48px"
                      unoptimized
                    />
                  ) : (
                    <Image
                      src={user.userPicture}
                      alt={`${user.firstName} ${user.lastName}`}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  )
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

        {/* Settings Sections (accordion: only one open, default Account) */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Account Settings */}
          <div className="border-2 border-black rounded-lg bg-white">
            <button
              type="button"
              onClick={() => setOpenSection('account')}
              className="w-full p-4 flex items-center justify-between gap-2 hover:bg-gray-50/50 transition-colors text-left rounded-t-lg"
              aria-expanded={openSection === 'account'}
            >
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-black shrink-0" />
                <h3 className="text-base font-bold text-black">Account</h3>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-black shrink-0 transition-transform ${openSection === 'account' ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            {openSection === 'account' && (
            <div className="p-2 border-t-2 border-black">
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
            )}
          </div>

          {/* Language Preference */}
          <div className="border-2 border-black rounded-lg bg-white">
            <button
              type="button"
              onClick={() => setOpenSection('language')}
              className="w-full p-4 flex items-center justify-between gap-2 hover:bg-gray-50/50 transition-colors text-left rounded-t-lg"
              aria-expanded={openSection === 'language'}
            >
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-black shrink-0" />
                <h3 className="text-base font-bold text-black">Language</h3>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-black shrink-0 transition-transform ${openSection === 'language' ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            {openSection === 'language' && (
            <>
              <p className="px-4 pt-1 text-xs text-gray-600 border-t-2 border-black">
                {t('settings.languagePreferenceSaved')}
              </p>
            <div className="p-2 space-y-1">
              <button
                onClick={() => setSelectedLocale('en')}
                disabled={isUpdatingLocale}
                className={`w-full text-left px-4 py-2.5 rounded-lg transition-colors font-medium cursor-pointer ${
                  selectedLocale === 'en'
                    ? 'bg-gray-100 border-2 border-black'
                    : 'hover:bg-gray-50 border-2 border-transparent'
                } ${isUpdatingLocale ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-4 rounded-sm overflow-hidden border border-black/20 shadow-sm">
                    <UsFlagIcon />
                  </div>
                  <span>English</span>
                  {selectedLocale === 'en' && (
                    <span className="ml-auto text-xs text-gray-600">Selected</span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setSelectedLocale('es')}
                disabled={isUpdatingLocale}
                className={`w-full text-left px-4 py-2.5 rounded-lg transition-colors font-medium cursor-pointer ${
                  selectedLocale === 'es'
                    ? 'bg-gray-100 border-2 border-black'
                    : 'hover:bg-gray-50 border-2 border-transparent'
                } ${isUpdatingLocale ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-4 rounded-sm overflow-hidden border border-black/20 shadow-sm">
                    <SpainFlagIcon />
                  </div>
                  <span>Español</span>
                  {selectedLocale === 'es' && (
                    <span className="ml-auto text-xs text-gray-600">Seleccionado</span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setSelectedLocale('pt')}
                disabled={isUpdatingLocale}
                className={`w-full text-left px-4 py-2.5 rounded-lg transition-colors font-medium cursor-pointer ${
                  selectedLocale === 'pt'
                    ? 'bg-gray-100 border-2 border-black'
                    : 'hover:bg-gray-50 border-2 border-transparent'
                } ${isUpdatingLocale ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-4 rounded-sm overflow-hidden border border-black/20 shadow-sm">
                    <BrazilFlagIcon />
                  </div>
                  <span>Português</span>
                  {selectedLocale === 'pt' && (
                    <span className="ml-auto text-xs text-gray-600">Selecionado</span>
                  )}
                </div>
              </button>
            </div>
            </>
            )}
          </div>

          {/* Privacy & Security */}
          <div className="border-2 border-black rounded-lg bg-white">
            <button
              type="button"
              onClick={() => setOpenSection('privacy')}
              className="w-full p-4 flex items-center justify-between gap-2 hover:bg-gray-50/50 transition-colors text-left rounded-t-lg"
              aria-expanded={openSection === 'privacy'}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-black shrink-0" />
                <h3 className="text-base font-bold text-black">Privacy & Security</h3>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-black shrink-0 transition-transform ${openSection === 'privacy' ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            {openSection === 'privacy' && (
            <div className="p-2 border-t-2 border-black">
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
            )}
          </div>
        </div>

        {/* Footer with Action Buttons */}
        <div className="p-4 border-t-2 border-black bg-white">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-black bg-white text-black rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Close
            </button>
            {hasChanges && (
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={isUpdatingLocale}
                className="flex-1 px-6 py-3 border-2 border-black bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingLocale ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

