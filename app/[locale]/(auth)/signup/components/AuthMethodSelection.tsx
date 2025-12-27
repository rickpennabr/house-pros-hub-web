'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';

interface AuthMethodSelectionProps {
  role: 'customer' | 'contractor' | 'both';
  onEmailSelected: () => void;
  onGoogleSelected: () => void;
  isLoading?: boolean;
}

export function AuthMethodSelection({
  role,
  onEmailSelected,
  onGoogleSelected,
  isLoading = false,
}: AuthMethodSelectionProps) {
  const t = useTranslations('auth.signup.authMethod');

  const getRoleText = () => {
    switch (role) {
      case 'customer':
        return t('roleText.customer');
      case 'contractor':
        return t('roleText.contractor');
      case 'both':
        return t('roleText.both');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col text-black">
      {/* Logo */}
      <div className="flex items-center justify-center h-[40px] md:h-[95px] mt-8 md:mt-4 mb-6 md:mb-0 pb-4 md:pb-0 animate-fade-in">
        <div className="cursor-pointer flex-shrink-0 w-full md:w-auto">
          <Image
            src="/hph-logo-2.3.png"
            alt="House Pros Hub"
            width={400}
            height={100}
            className="h-full w-full md:w-auto max-w-full object-contain"
            priority
          />
        </div>
      </div>

      {/* Title */}
      <div className="flex items-center justify-center gap-3 mb-2 md:pt-4">
        <h2 className="text-3xl font-semibold text-center animate-fade-in">
          {t('title')}
        </h2>
      </div>

      {/* Auth Method Buttons */}
      <div className="space-y-4 mt-2 md:mt-6">
        {/* Continue with Email Button */}
        <Button
          type="button"
          onClick={onEmailSelected}
          variant="primary"
          disabled={isLoading}
          className="w-full"
        >
          {t('emailButton')}
        </Button>

        {/* Sign up with Google Button */}
        <Button
          type="button"
          onClick={onGoogleSelected}
          variant="secondary"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {t('googleButton')}
        </Button>
      </div>

      {/* Back button */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="
            w-full h-10 px-2 
            bg-black text-white 
            rounded-lg border-2 border-black 
            font-bold text-[11px] md:text-[13px]
            flex items-center justify-center
            cursor-pointer overflow-hidden
            transition-all duration-300
            hover:bg-gray-900 
            active:scale-95
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          disabled={isLoading}
        >
          <span className="whitespace-nowrap tracking-wider">{t('backButton')}</span>
        </button>
      </div>
    </div>
  );
}

