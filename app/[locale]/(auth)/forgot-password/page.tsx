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
        {/* Header with Logo and Navigation */}
        <div className="md:sticky md:top-0 md:z-20 md:bg-white">
          <div className="flex flex-col mb-2 gap-4 py-4 md:py-0">
            <div className="flex items-center justify-center h-[40px] md:h-[95px] mt-6 md:mt-4 mb-4 md:mb-0 animate-slide-down">
              <Link href={`/${locale}/businesslist`} className="cursor-pointer flex-shrink-0 w-full md:w-auto">
                <Logo width={400} height={100} className="h-full w-full md:w-auto max-w-full object-contain" />
              </Link>
            </div>
            <div className="animate-slide-in-right">
              <AuthNavigationButtons isLoading={isLoading} />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <h2 className="text-3xl font-semibold text-center text-black animate-fade-in">{t('title')}</h2>
        </div>

        <p className="text-center text-gray-600 mb-6 animate-fade-in">{t('subtitle')}</p>

        {success ? (
          <div className="space-y-6">
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center">
              <p className="text-green-800 font-medium">{t('success.message')}</p>
              <p className="text-green-700 text-sm mt-2">{t('success.checkEmail')}</p>
            </div>
            <div className="text-center">
              <Link
                href={`/${locale}/signin`}
                className="text-sm text-gray-600 hover:text-black underline transition-colors"
              >
                {t('backToSignIn')}
              </Link>
            </div>
          </div>
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

