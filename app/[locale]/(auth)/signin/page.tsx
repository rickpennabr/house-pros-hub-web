'use client';

import { useState, Suspense, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { FormField } from '@/components/ui/FormField';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { AuthNavigationButtons } from '@/components/auth/AuthNavigationButtons';
import { isValidEmail, isNotEmpty } from '@/lib/validation';
import { useTypingPlaceholder } from '@/hooks/useTypingPlaceholder';

function SignInForm() {
  const locale = useLocale();
  const t = useTranslations('auth.signin');
  const { login } = useAuth();
  const { redirectAfterAuth } = useAuthRedirect();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Typing animation for placeholders
  const emailPlaceholder = t('emailPlaceholder');
  const passwordPlaceholder = t('passwordPlaceholder');
  const placeholders = useMemo(
    () => [emailPlaceholder, passwordPlaceholder],
    [emailPlaceholder, passwordPlaceholder]
  );
  const animatedPlaceholders = useTypingPlaceholder({
    placeholders,
    typingSpeed: 100,
    delayBetweenFields: 300,
    startDelay: 500,
  });

  const validateField = (field: 'email' | 'password', value: string): string | undefined => {
    if (field === 'email') {
      if (!isNotEmpty(value)) {
        return t('validation.emailRequired');
      }
      if (!isValidEmail(value)) {
        return t('validation.emailInvalid');
      }
    } else if (field === 'password') {
      if (!isNotEmpty(value)) {
        return t('validation.passwordRequired');
      }
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    
    const emailError = validateField('email', email);
    if (emailError) errors.email = emailError;
    
    const passwordError = validateField('password', password);
    if (passwordError) errors.password = passwordError;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    // Clear error when user starts typing
    if (fieldErrors.email) {
      setFieldErrors(prev => ({ ...prev, email: undefined }));
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    // Clear error when user starts typing
    if (fieldErrors.password) {
      setFieldErrors(prev => ({ ...prev, password: undefined }));
    }
  };

  // Safety timeout to reset loading state if it gets stuck
  useEffect(() => {
    if (isLoading) {
      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      // Set a safety timeout to reset loading after 10 seconds
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('Sign-in loading state stuck, resetting...');
        setIsLoading(false);
        setError('Sign-in is taking longer than expected. Please try again.');
      }, 10000);
    } else {
      // Clear timeout when loading is false
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [isLoading]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate form before submitting
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Trim email to remove any whitespace
      await login(email.trim(), password);
      // Clear safety timeout so it can't overwrite success/redirect
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      // Redirect after successful login
      // Reset loading state before redirect to prevent stuck state
      setIsLoading(false);
      // Use setTimeout to ensure state update completes before redirect
      setTimeout(() => {
        try {
          redirectAfterAuth();
        } catch (redirectError) {
          console.error('Redirect error:', redirectError);
          setError('Login successful but redirect failed. Please refresh the page.');
        }
      }, 50);
    } catch (err) {
      // Clear safety timeout so it can't overwrite the real error message
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setError(err instanceof Error ? err.message : t('errors.generic'));
      setIsLoading(false);
    }
  };

  return (
    <AuthPageLayout>
      <div className="w-full max-w-md mx-auto flex flex-col text-black">
        {/* Header with Logo and Navigation */}
        <div className="md:sticky md:top-0 md:z-20 md:bg-white">
          <div className="flex flex-col py-4 md:pt-12 md:pb-0 md:mb-2">
            {/* Logo Section */}
            <section className="flex items-center justify-center md:pt-0 pb-4 md:pb-2 w-full animate-slide-down">
              <Link href={`/${locale}/businesslist`} className="cursor-pointer flex-shrink-0 w-full">
                <Logo width={400} height={100} className="h-full w-full max-w-full object-contain" />
              </Link>
            </section>
            
            {/* Navigation Buttons Section */}
            <section className="animate-slide-in-right">
              <AuthNavigationButtons isLoading={isLoading} />
            </section>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <h2 className="text-3xl font-semibold text-center text-black animate-fade-in">{t('title')}</h2>
          <span 
            className="text-3xl animate-wave" 
            style={{ 
              display: 'inline-block', 
              transformOrigin: '70% 70%',
              fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Android Emoji, EmojiSymbols, EmojiOne Mozilla, Twemoji Mozilla, Segoe UI Symbol, sans-serif'
            }}
            role="img"
            aria-label="Waving hand"
          >
            👋
          </span>
        </div>

        <ErrorMessage message={error || ''} />

        {/* Sign In Form */}
        <form onSubmit={handleSignIn} className="space-y-6">
          <FormField 
            label={
              <span className="flex items-center">
                <span className="animate-icon-slide-in-email">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <span>{t('emailLabel')}</span>
              </span>
            } 
            required 
            error={fieldErrors.email}
          >
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
            />
          </FormField>

          <PasswordInput
            id="password"
            label={
              <span className="flex items-center">
                <span className="animate-icon-slide-in-password">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </span>
                <span>{t('passwordLabel')}</span>
              </span>
            }
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            required
            placeholder={animatedPlaceholders[1]}
            disabled={isLoading}
            error={fieldErrors.password}
          />

          {/* Forgot Password */}
          <div className="flex items-center justify-end">
            <Link
              href={`/${locale}/forgot-password`}
              className="text-sm text-gray-600 hover:text-black underline transition-colors"
            >
              {t('forgotPassword')}
            </Link>
          </div>

          {/* Submit Button */}
          <Button type="submit" variant="primary" disabled={isLoading} className="w-full">
            {isLoading ? t('submitting') : t('submit')}
          </Button>
        </form>
      </div>
    </AuthPageLayout>
  );
}

export default function SignInPage() {
  const t = useTranslations('common');
  return (
    <Suspense fallback={
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-gray-600">{t('message.loading')}</p>
        </div>
      </AuthPageLayout>
    }>
      <SignInForm />
    </Suspense>
  );
}
