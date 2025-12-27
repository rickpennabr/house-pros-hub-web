'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';

export default function Footer() {
  const t = useTranslations('footer');
  const locale = useLocale();
  const currentYear = new Date().getFullYear();
  const isSpanish = locale === 'es';
  // Use smaller font on mobile for Spanish, normal size otherwise
  const textSizeClass = isSpanish ? 'text-xs md:text-sm' : 'text-sm';

  return (
    <footer className="w-full h-[60px] border-t-2 border-black bg-white mt-auto">
      <div className="max-w-7xl mx-auto h-full px-1 py-2 md:px-2 md:py-4 flex items-center">
        <div className="w-full flex flex-col md:flex-row justify-between items-center gap-2 md:gap-6">
          {/* Legal Links */}
          <div className={`flex flex-nowrap justify-center md:justify-start gap-2 md:gap-6 ${textSizeClass}`}>
            <Link 
              href={`/${locale}/legal/terms`}
              className="text-gray-600 hover:text-black underline transition-colors whitespace-nowrap"
            >
              {t('termsOfService')}
            </Link>
            <Link 
              href={`/${locale}/legal/privacy`}
              className="text-gray-600 hover:text-black underline transition-colors whitespace-nowrap"
            >
              {t('privacyPolicy')}
            </Link>
            <Link 
              href={`/${locale}/legal/cookies`}
              className="text-gray-600 hover:text-black underline transition-colors whitespace-nowrap"
            >
              {t('cookiePolicy')}
            </Link>
          </div>

          {/* Copyright */}
          <div className={`${textSizeClass} text-gray-600 text-center md:text-right`}>
            <p>&copy; {currentYear} House Pros Hub. {t('copyright')}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

