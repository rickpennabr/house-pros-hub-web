'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Logo from '@/components/Logo';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { isValidPassword, isNotEmpty } from '@/lib/validation';
import { createClient } from '@/lib/supabase/client';
import { useTypingPlaceholder } from '@/hooks/useTypingPlaceholder';
import { getReturnUrl, getRedirectPath } from '@/lib/redirect';

function ResetPasswordForm() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth.resetPassword');
  const { resetPassword } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});

  // Typing animation for placeholders
  const passwordPlaceholder = t('passwordPlaceholder');
  const confirmPasswordPlaceholder = t('confirmPasswordPlaceholder');
  const placeholders = useMemo(
    () => [passwordPlaceholder, confirmPasswordPlaceholder],
    [passwordPlaceholder, confirmPasswordPlaceholder]
  );
  const animatedPlaceholders = useTypingPlaceholder({
    placeholders,
    typingSpeed: 100,
    delayBetweenFields: 300,
    startDelay: 500,
  });

  // Check if user has a valid session (created by Supabase when clicking reset link)
  // Supabase automatically processes hash tokens when the client is created
  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient();
        
        // Give Supabase a moment to process hash tokens from URL
        // The client automatically handles tokens in the hash fragment
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session || !session.user) {
          setError(t('errors.invalidToken'));
          setIsValidatingToken(false);
          return;
        }

        setIsValidatingToken(false);
      } catch (err) {
        console.error('Error checking session:', err);
        setError(t('errors.invalidToken'));
        setIsValidatingToken(false);
      }
    };

    checkSession();
  }, [t]);

  const validateField = (field: 'password' | 'confirmPassword', value: string): string | undefined => {
    if (field === 'password') {
      if (!isNotEmpty(value)) {
        return t('validation.passwordRequired');
      }
      if (!isValidPassword(value)) {
        return t('validation.passwordInvalid');
      }
    } else if (field === 'confirmPassword') {
      if (!isNotEmpty(value)) {
        return t('validation.confirmPasswordRequired');
      }
      if (value !== password) {
        return t('validation.passwordsDoNotMatch');
      }
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const errors: { password?: string; confirmPassword?: string } = {};
    
    const passwordError = validateField('password', password);
    if (passwordError) errors.password = passwordError;
    
    const confirmPasswordError = validateField('confirmPassword', confirmPassword);
    if (confirmPasswordError) errors.confirmPassword = confirmPasswordError;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    // Clear error when user starts typing
    if (fieldErrors.password) {
      setFieldErrors(prev => ({ ...prev, password: undefined }));
    }
    // Re-validate confirm password if it has a value
    if (confirmPassword && fieldErrors.confirmPassword) {
      const confirmError = validateField('confirmPassword', confirmPassword);
      setFieldErrors(prev => ({ ...prev, confirmPassword: confirmError }));
    }
    if (error) {
      setError(null);
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    // Clear error when user starts typing
    if (fieldErrors.confirmPassword) {
      setFieldErrors(prev => ({ ...prev, confirmPassword: undefined }));
    }
    if (error) {
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate form before submitting
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Get token from URL hash (Supabase puts it there)
      // But actually, Supabase already created a session, so we don't need the token
      await resetPassword(password);
      // Redirect after successful password reset
      const returnUrl = getReturnUrl(searchParams);
      const redirectPath = getRedirectPath(returnUrl, locale as 'en' | 'es');
      router.push(redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidatingToken) {
    return (
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-gray-600">{t('validatingToken')}</p>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <div className="w-full max-w-md mx-auto flex flex-col text-black">
        {/* Header with Logo */}
        <div className="md:sticky md:top-0 md:z-20 md:bg-white">
          <div className="flex flex-col mb-2 gap-4 py-4 md:py-0">
            <div className="flex items-center justify-center h-[40px] md:h-[95px] mt-6 md:mt-4 mb-4 md:mb-0 animate-slide-down">
              <Link href={`/${locale}/businesslist`} className="cursor-pointer flex-shrink-0 w-full md:w-auto">
                <Logo width={400} height={100} className="h-full w-full md:w-auto max-w-full object-contain" />
              </Link>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <h2 className="text-3xl font-semibold text-center text-black animate-fade-in">{t('title')}</h2>
        </div>

        <p className="text-center text-gray-600 mb-6 animate-fade-in">{t('subtitle')}</p>

        <ErrorMessage message={error || ''} />

        {/* Reset Password Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <PasswordInput
            id="password"
            label={t('passwordLabel')}
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            required
            placeholder={animatedPlaceholders[0]}
            disabled={isLoading}
            error={fieldErrors.password}
            autoFocus
          />

          <PasswordInput
            id="confirmPassword"
            label={t('confirmPasswordLabel')}
            value={confirmPassword}
            onChange={(e) => handleConfirmPasswordChange(e.target.value)}
            required
            placeholder={animatedPlaceholders[1]}
            disabled={isLoading}
            error={fieldErrors.confirmPassword}
          />

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
      </div>
    </AuthPageLayout>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations('common');
  return (
    <Suspense fallback={
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-gray-600">{t('message.loading')}</p>
        </div>
      </AuthPageLayout>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

