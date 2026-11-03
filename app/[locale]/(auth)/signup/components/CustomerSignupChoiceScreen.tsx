'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

interface CustomerSignupChoiceScreenProps {
  isLoading?: boolean;
  error?: string | null;
  onSignUpWithForm: () => void;
  onGoogleSignUp: () => void;
  onBack: () => void;
}

export function CustomerSignupChoiceScreen({
  isLoading = false,
  error,
  onSignUpWithForm,
  onGoogleSignUp,
  onBack,
}: CustomerSignupChoiceScreenProps) {
  const t = useTranslations('auth.signup.customerSignupChoice');
  const tNav = useTranslations('auth.signup.navigation');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const forEstimate = (searchParams.get('returnUrl') ?? '').includes('/estimate');

  return (
    <div className="w-full max-w-md mx-auto flex flex-col text-black md:pt-12">
      <div className="flex items-center justify-center h-[40px] md:h-[95px] mt-8 md:mt-0 mb-6 md:mb-0 pb-4 md:pb-2 md:w-full animate-fade-in">
        <Link href={`/${locale}/businesslist`} className="cursor-pointer flex-shrink-0 w-full md:w-full">
          <Logo
            src="/hph-logo-with-pro-bot-mobile.png"
            width={400}
            height={100}
            className="h-full w-full md:w-full max-w-full object-contain"
          />
        </Link>
      </div>

      <div className="mb-6 flex flex-col items-center justify-center gap-2 md:mb-8 md:pt-4 animate-slide-in-right">
        <h2 className="text-3xl font-semibold text-center">{t('title')}</h2>
        {forEstimate && (
          <p className="text-center text-sm text-gray-600">{t('estimateHint')}</p>
        )}
      </div>

      <ErrorMessage message={error || ''} />

      <div className="flex flex-col gap-4">
        <Button
          type="button"
          variant="primary"
          onClick={onSignUpWithForm}
          disabled={isLoading}
          className="flex w-full items-center justify-center whitespace-nowrap px-4 py-2.5 md:py-3"
        >
          <span className="inline-flex items-center justify-center gap-2">
            <ClipboardList className="h-5 w-5 shrink-0" aria-hidden="true" />
            {t('signUpWithForm')}
          </span>
        </Button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-black" />
          <span className="text-sm font-medium uppercase tracking-wide text-black">{t('or')}</span>
          <div className="h-px flex-1 bg-black" />
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={onGoogleSignUp}
          disabled={isLoading}
          className="flex w-full items-center justify-center whitespace-nowrap px-2 py-2 leading-none md:px-4 md:py-3"
        >
          <span className="inline-flex items-center justify-center gap-2">
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {tNav('signUpWithGoogle')}
          </span>
        </Button>

        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          disabled={isLoading}
          className="w-full"
        >
          {tNav('previous')}
        </Button>
      </div>
    </div>
  );
}
