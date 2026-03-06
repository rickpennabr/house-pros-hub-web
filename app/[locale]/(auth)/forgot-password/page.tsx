'use client';

import { useState, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { FormField } from '@/components/ui/FormField';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { AuthNavigationButtons } from '@/components/auth/AuthNavigationButtons';
import { ConfirmationMessage } from '@/components/auth/ConfirmationMessage';
import { isValidEmail, isNotEmpty } from '@/lib/validation';
import { useTypingPlaceholder } from '@/hooks/useTypingPlaceholder';

function ForgotPasswordForm() {
  const locale = useLocale();
  const t = useTranslations('auth.forgotPassword');
  const { requestPasswordReset } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string }>({});

  // Typing animation for placeholder
  const emailPlaceholder = t('emailPlaceholder');
  const placeholders = useMemo(() => [emailPlaceholder], [emailPlaceholder]);
  const animatedPlaceholders = useTypingPlaceholder({
    placeholders,
    typingSpeed: 100,
    delayBetweenFields: 300,
    startDelay: 500,
  });

  const validateField = (field: 'email', value: string): string | undefined => {
    if (field === 'email') {
      if (!isNotEmpty(value)) {
        return t('validation.emailRequired');
      }
      if (!isValidEmail(value)) {
        return t('validation.emailInvalid');
      }
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const errors: { email?: string } = {};
    
    const emailError = validateField('email', email);
    if (emailError) errors.email = emailError;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    // Clear error when user starts typing
    if (fieldErrors.email) {
      setFieldErrors(prev => ({ ...prev, email: undefined }));
    }
    if (error) {
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    
    // Validate form before submitting
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await requestPasswordReset(email.trim());
      setSuccess(true);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPageLayout>
      <div className="w-full max-w-md mx-auto flex flex-col text-black">
        {/* Header with Logo and Navigation - constrained so logo does not overflow or cut off */}
        <div className="md:sticky md:top-0 md:z-20 md:bg-white flex-shrink-0">
          <div className="flex flex-col py-3 md:pt-6 md:pb-0 md:mb-2">
            <section className="flex items-center justify-center md:pt-0 pb-3 md:pb-2 w-full max-h-20 md:max-h-24 animate-slide-down">
              <Link href={`/${locale}/businesslist`} className="cursor-pointer flex-shrink-0 w-full flex items-center justify-center">
                <Logo width={280} height={70} className="h-auto w-full max-w-full max-h-20 md:max-h-24 object-contain" />
              </Link>
            </section>
            <section className="animate-slide-in-right">
              <AuthNavigationButtons isLoading={isLoading} />
            </section>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <h2 className="text-3xl font-semibold text-center text-black animate-fade-in">{t('title')}</h2>
        </div>

        <p className="text-center text-gray-600 mb-6 animate-fade-in">{t('subtitle')}</p>

        {success ? (
          <ConfirmationMessage
            title={t('success.message')}
            message={
              <>
                <p>{t('success.checkEmail')}</p>
                <p className="text-sm mt-2 text-gray-600">{t('success.sameBrowserHint')}</p>
              </>
            }
          >
            <Link
              href={`/${locale}/signin`}
              className="inline-flex justify-center rounded-lg border-2 border-black bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 text-center"
            >
              {t('backToSignIn')}
            </Link>
          </ConfirmationMessage>
        ) : (
          <>
            <ErrorMessage message={error || ''} />

            {/* Forgot Password Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <FormField label={t('emailLabel')} required error={fieldErrors.email}>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onClear={() => {
                    setEmail('');
                    setFieldErrors(prev => ({ ...prev, email: undefined }));
                  }}
                  showClear
                  required
                  placeholder={animatedPlaceholders[0]}
                  disabled={isLoading}
                  error={fieldErrors.email}
                  autoFocus
                />
              </FormField>

              {/* Submit Button */}
              <Button type="submit" variant="primary" disabled={isLoading} className="w-full">
                {isLoading ? t('submitting') : t('submit')}
              </Button>

              {/* Back to Sign In */}
              <div className="text-center">
                <Link
                  href={`/${locale}/signin`}
                  className="text-sm text-gray-600 hover:text-black underline transition-colors"
                >
                  {t('backToSignIn')}
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </AuthPageLayout>
  );
}

export default function ForgotPasswordPage() {
  const t = useTranslations('common');
  return (
    <Suspense fallback={
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-gray-600">{t('message.loading')}</p>
        </div>
      </AuthPageLayout>
    }>
      <ForgotPasswordForm />
    </Suspense>
  );
}

