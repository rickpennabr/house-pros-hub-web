'use client';

import { useState, Suspense, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
import { GoogleHandoffOverlay } from '@/components/auth/GoogleHandoffOverlay';
import { isValidEmail, isNotEmpty } from '@/lib/validation';
import { useTypingPlaceholder } from '@/hooks/useTypingPlaceholder';
import { createClient } from '@/lib/supabase/client';

function SignInForm() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const t = useTranslations('auth.signin');
  const tHandoff = useTranslations('auth.googleHandoff');
  const { login } = useAuth();
  const { redirectAfterAuth } = useAuthRedirect();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [danceIndex, setDanceIndex] = useState(0);
  const DANCE_GIFS = ['/dance.gif', '/dance-1.gif'];
  const DANCE_DURATION_MS = 3000;

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
  const busy = isLoading || isGoogleLoading;

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (!oauthError) return;
    setError(oauthError === 'existing_account' ? t('errors.existingAccount') : oauthError);
  }, [searchParams, t]);

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

  // Alternate dance GIFs in sequence in the same spot
  useEffect(() => {
    const id = setInterval(() => {
      setDanceIndex((i) => (i + 1) % DANCE_GIFS.length);
    }, DANCE_DURATION_MS);
    return () => clearInterval(id);
  }, []);

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

  // Coming back from Google through the back button restores this page from the
  // bfcache with the handoff still on screen.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setIsGoogleLoading(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const handleGoogleSignIn = async () => {
    // A second OAuth start overwrites the PKCE verifier of the first one, so the
    // callback for the earlier code can no longer be exchanged.
    if (busy) return;
    setError(null);
    setIsGoogleLoading(true);
    const returnUrl = searchParams.get('returnUrl');
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `hph_oauth_flow=signin; Path=/; Max-Age=600; SameSite=Lax${secure}`;
    document.cookie = `hph_oauth_locale=${encodeURIComponent(locale)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
    if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
      document.cookie = `hph_oauth_next=${encodeURIComponent(returnUrl)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
    } else {
      document.cookie = 'hph_oauth_next=; Path=/; Max-Age=0; SameSite=Lax';
    }

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/api/auth/callback?locale=${encodeURIComponent(locale)}&flow=signin`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (oauthError) {
      setError(t('errors.google'));
      setIsGoogleLoading(false);
    }
  };

  return (
    <AuthPageLayout>
      <GoogleHandoffOverlay
        open={isGoogleLoading}
        title={tHandoff('title')}
        subtitle={tHandoff('subtitle')}
      />
      <div className="w-full max-w-md mx-auto flex flex-col text-black">
        {/* Header with Logo and Navigation */}
        <div className="md:sticky md:top-0 md:z-20 md:bg-white">
          <div className="flex flex-col py-4 md:pt-12 md:pb-0 md:mb-2">
            {/* Logo Section */}
            <section className="flex items-center justify-center md:pt-0 pb-4 md:pb-2 w-full animate-slide-down">
              <Link href={`/${locale}/businesslist`} className="cursor-pointer flex-shrink-0 w-full">
                <Logo src="/hph-logo-with-pro-bot-mobile.png" width={400} height={100} className="h-full w-full max-w-full object-contain" />
              </Link>
            </section>
            
            {/* Navigation Buttons Section */}
            <section className="animate-slide-in-right">
              <AuthNavigationButtons isLoading={busy} />
            </section>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <h2 className="text-3xl font-semibold text-center text-black animate-fade-in">{t('title')}</h2>
          <div className="relative h-12 w-12 flex-shrink-0">
            {DANCE_GIFS.map((src, i) => (
              <img
                key={src}
                src={src}
                alt="Robot dancing"
                className="absolute inset-0 h-full w-full object-contain transition-opacity duration-300"
                style={{ opacity: danceIndex === i ? 1 : 0, pointerEvents: 'none' }}
                width={48}
                height={48}
              />
            ))}
          </div>
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
              disabled={busy}
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
            disabled={busy}
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
          <Button type="submit" variant="primary" disabled={busy} className="w-full">
            {isLoading ? t('submitting') : t('submit')}
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-black" />
            <span className="text-sm font-medium uppercase tracking-wide text-black">{t('or')}</span>
            <div className="h-px flex-1 bg-black" />
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className="flex w-full items-center justify-center whitespace-nowrap px-2 py-2 leading-none md:px-4 md:py-3"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {isGoogleLoading ? t('submitting') : t('google')}
            </span>
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
