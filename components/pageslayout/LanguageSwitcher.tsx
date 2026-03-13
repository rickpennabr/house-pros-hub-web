'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronDown } from 'lucide-react';
import { locales, type Locale } from '@/i18n';
import { UsFlagIcon, SpainFlagIcon, BrazilFlagIcon } from './LocaleFlagIcons';

interface LanguageSwitcherProps {
  className?: string;
}

function getPathWithoutLocale(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (first && (locales as readonly string[]).includes(first)) {
    const rest = segments.slice(1).join('/');
    return rest ? `/${rest}` : '/';
  }
  return pathname;
}

const flagWrap = 'flex-shrink-0 w-6 h-4 rounded-sm overflow-hidden border border-black/20 shadow-sm';

function CurrentFlag({ locale }: { locale: Locale }) {
  if (locale === 'en') return <div className={flagWrap}><UsFlagIcon /></div>;
  if (locale === 'es') return <div className={flagWrap}><SpainFlagIcon /></div>;
  return <div className={flagWrap}><BrazilFlagIcon /></div>;
}

function FlagOption({ locale }: { locale: Locale }) {
  if (locale === 'en') return <UsFlagIcon />;
  if (locale === 'es') return <SpainFlagIcon />;
  return <BrazilFlagIcon />;
}

export default function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { updateUser, isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const allLocales = locales as readonly Locale[];
  const otherLocales = allLocales.filter((l) => l !== locale);

  const switchToLocale = async (newLocale: Locale) => {
    if (newLocale === locale) {
      setOpen(false);
      return;
    }
    if (isAuthenticated && user) {
      try {
        await updateUser({ preferredLocale: newLocale });
      } catch (error) {
        console.error('Error saving language preference:', error);
      }
    }
    const pathWithoutLocale = getPathWithoutLocale(pathname);
    const newPath = pathWithoutLocale === '/' ? `/${newLocale}` : `/${newLocale}${pathWithoutLocale}`;
    setOpen(false);
    router.push(newPath);
  };

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative w-full min-w-[2.5rem] ${className}`}>
      {/* Trigger button: fixed size, never moves */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="
          w-full min-h-10 h-10
          flex items-center justify-center gap-1 pl-1 pr-0
          font-medium text-sm
          cursor-pointer
          bg-white border-2 border-black rounded-lg
          hover:bg-gray-50
          active:bg-gray-100
          transition-colors duration-200
          shadow-sm
        "
        aria-label={open ? 'Close language menu' : 'Change language'}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <CurrentFlag locale={locale} />
        <span className="flex items-center shrink-0" aria-hidden>
          <ChevronDown className={`w-4 h-4 text-black transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Options: absolutely positioned dropdown expanding downward */}
      {open && (
        <div
          className="
            absolute left-0 top-full mt-0.5 min-w-full
            bg-white border-2 border-black rounded-lg
            overflow-hidden shadow-sm
            z-50
          "
          role="listbox"
          aria-label="Select language"
        >
          {otherLocales.map((l) => (
            <button
              key={l}
              type="button"
              role="option"
              onClick={() => switchToLocale(l)}
              className="w-full flex items-center justify-center py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors border-t-2 border-black first:border-t-0 cursor-pointer"
              aria-label={l === 'en' ? 'English' : l === 'es' ? 'Español' : 'Português'}
            >
              <div className={flagWrap}>
                <FlagOption locale={l} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
