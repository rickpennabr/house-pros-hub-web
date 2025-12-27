'use client';

import { useState, Suspense, useEffect, useRef } from 'react';
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

function SignInForm() {
  const locale = useLocale();
  const t = useTranslations('auth.signin');
  const { login, signInWithGoogle } = useAuth();
  const { redirectAfterAuth } = useAuthRedirect();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      setError(err instanceof Error ? err.message : t('errors.generic'));
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await signInWithGoogle();
      // OAuth redirect will happen, so we don't need to redirect here
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
      setIsLoading(false);
    }
  };

  return (
    <AuthPageLayout>
      <div className="w-full max-w-md mx-auto flex flex-col text-black">
        {/* Header with Logo and Navigation */}
        <div className="md:sticky md:top-0 md:z-20 md:bg-white">
          <div className="flex flex-col mb-2 gap-4 py-4 md:py-0">
            <div className="flex items-center justify-center h-[40px] md:h-[95px] mt-6 md:mt-4 mb-4 md:mb-0 pb-4 md:pb-0 animate-slide-down">
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
          {/* Google OAuth Button */}
          <Button
            type="button"
            onClick={handleGoogleSignIn}
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

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

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
              placeholder={t('emailPlaceholder')}
              disabled={isLoading}
              error={fieldErrors.email}
            />
          </FormField>

          <PasswordInput
            id="password"
            label={t('passwordLabel')}
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            required
            placeholder={t('passwordPlaceholder')}
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
