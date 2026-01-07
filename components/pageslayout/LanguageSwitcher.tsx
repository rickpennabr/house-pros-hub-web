'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { Locale } from '@/i18n';

interface LanguageSwitcherProps {
  className?: string;
}

export default function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { user, updateUser, isAuthenticated } = useAuth();

  const toggleLanguage = async () => {
    const newLocale: Locale = locale === 'es' ? 'en' : 'es';
    
    // Save preference to user account if authenticated
    if (isAuthenticated && user) {
      try {
        await updateUser({ preferredLocale: newLocale });
      } catch (error) {
        console.error('Error saving language preference:', error);
        // Continue with navigation even if save fails
      }
    }
    
    // Remove current locale from pathname and add new locale
    let pathWithoutLocale = pathname;
    if (pathname.startsWith(`/${locale}`)) {
      pathWithoutLocale = pathname.replace(`/${locale}`, '') || '/';
    } else if (pathname.startsWith('/en/') || pathname.startsWith('/es/')) {
      // Handle case where pathname has a different locale prefix
      pathWithoutLocale = '/' + pathname.split('/').slice(2).join('/') || '/';
    }
    const newPath = `/${newLocale}${pathWithoutLocale}`;
    router.push(newPath);
  };

  return (
    <button
      onClick={toggleLanguage}
      className={`
        w-10 h-10
        bg-white border-2 border-black rounded-lg
        flex items-center justify-center
        font-medium text-sm
        cursor-pointer
        hover:bg-gray-50 
        active:bg-gray-100
        transition-all duration-200
        ${className}
      `}
      aria-label={locale === 'es' ? 'Switch to English' : 'Switch to Spanish'}
    >
      {/* Show the TARGET language flag (what you will switch to) */}
      {locale === 'es' ? (
        <div className="flex-shrink-0 w-6 h-4 rounded-sm overflow-hidden border border-black/20 shadow-sm">
          <svg viewBox="0 0 27 18" className="w-full h-full">
            {/* US flag (switching to English) */}
            <rect y="0" width="27" height="18" fill="#FFFFFF" />
            <rect x="0" y="0" width="11" height="8" fill="#002868" />
            <rect y="0" width="27" height="1.4" fill="#BF0A30" />
            <rect y="2.8" width="27" height="1.4" fill="#BF0A30" />
            <rect y="5.6" width="27" height="1.4" fill="#BF0A30" />
            <rect y="8.4" width="27" height="1.4" fill="#BF0A30" />
            <rect y="11.2" width="27" height="1.4" fill="#BF0A30" />
            <rect y="14" width="27" height="1.4" fill="#BF0A30" />
            <rect y="16.8" width="27" height="1.2" fill="#BF0A30" />
            <circle cx="1.5" cy="1.2" r="0.3" fill="#FFFFFF" />
            <circle cx="3.5" cy="1.2" r="0.3" fill="#FFFFFF" />
            <circle cx="5.5" cy="1.2" r="0.3" fill="#FFFFFF" />
            <circle cx="7.5" cy="1.2" r="0.3" fill="#FFFFFF" />
            <circle cx="9.5" cy="1.2" r="0.3" fill="#FFFFFF" />
            <circle cx="1.5" cy="3.2" r="0.3" fill="#FFFFFF" />
            <circle cx="3.5" cy="3.2" r="0.3" fill="#FFFFFF" />
            <circle cx="5.5" cy="3.2" r="0.3" fill="#FFFFFF" />
            <circle cx="7.5" cy="3.2" r="0.3" fill="#FFFFFF" />
            <circle cx="9.5" cy="3.2" r="0.3" fill="#FFFFFF" />
            <circle cx="2.5" cy="2.2" r="0.3" fill="#FFFFFF" />
            <circle cx="4.5" cy="2.2" r="0.3" fill="#FFFFFF" />
            <circle cx="6.5" cy="2.2" r="0.3" fill="#FFFFFF" />
            <circle cx="8.5" cy="2.2" r="0.3" fill="#FFFFFF" />
          </svg>
        </div>
      ) : (
        <div className="flex-shrink-0 w-6 h-4 rounded-sm overflow-hidden border border-black/20 shadow-sm">
          <svg viewBox="0 0 27 18" className="w-full h-full">
            {/* Spain flag (switching to Spanish) */}
            <rect y="0" width="27" height="6" fill="#AA151B" />
            <rect y="6" width="27" height="6" fill="#F1BF00" />
            <rect y="12" width="27" height="6" fill="#AA151B" />
          </svg>
        </div>
      )}
    </button>
  );
}

