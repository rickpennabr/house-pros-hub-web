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

  // Read error from URL (callback may redirect with ?error=... when code exchange fails)
  useEffect(() => {
    const urlError = searchParams.get('error');
    if (urlError) {
      const decoded = decodeURIComponent(urlError);
      console.log('[ResetPassword] error from URL (from callback):', decoded);
      setError(decoded);
      setIsValidatingToken(false);
      return;
    }
  }, [searchParams]);

  // Recover session from password reset link (Supabase puts tokens in URL hash, or sometimes in query when opening in new tab)
  useEffect(() => {
    if (searchParams.get('error')) {
      return;
    }

    const VALIDATION_TIMEOUT_MS = 15_000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const search = typeof window !== 'undefined' ? window.location.search : '';
    const hasHash = typeof window !== 'undefined' && !!window.location.hash;
    console.log('[ResetPassword] page load search=', search, 'hasHash=', hasHash);

    // Use URLSearchParams so values containing & or = (e.g. encoded refresh_token) are parsed correctly.
    const getParamFromHash = (name: string): string | null => {
      if (typeof window === 'undefined' || !window.location.hash) return null;
      try {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const value = params.get(name);
        if (value == null) return null;
        // JWTs can use + (base64); URLSearchParams decodes + as space, so restore + for tokens.
        if (name === 'access_token' || name === 'refresh_token') {
          return value.replace(/ /g, '+');
        }
        return value;
      } catch {
        return null;
      }
    };

    /** Read from query string (Supabase sometimes redirects with tokens in ? instead of #). Same + fix for tokens. */
    const getParamFromSearch = (name: string): string | null => {
      if (typeof window === 'undefined' || !window.location.search) return null;
      try {
        const params = new URLSearchParams(window.location.search);
        const value = params.get(name);
        if (value == null) return null;
        if (name === 'access_token' || name === 'refresh_token') {
          return value.replace(/ /g, '+');
        }
        return value;
      } catch {
        return null;
      }
    };

    /** Tokens may be in hash (primary) or query (fallback when e.g. opening link in new tab). */
    const getParamFromHashOrSearch = (name: string): string | null =>
      getParamFromHash(name) ?? getParamFromSearch(name);

    const clearValidationTimeout = () => {
      if (timeoutId != null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const succeedWithForm = () => {
      clearValidationTimeout();
      // Remove token params from URL (hash or query) so we don't leave secrets in the address bar
      if (typeof window !== 'undefined') {
        const search = new URLSearchParams(window.location.search);
        search.delete('access_token');
        search.delete('refresh_token');
        search.delete('type');
        const cleanSearch = search.toString();
        const cleanUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
        window.history.replaceState(null, '', cleanUrl);
      }
      setIsValidatingToken(false);
    };

    // Supabase may redirect with error in hash (e.g. otp_expired when redirect URL not allowlisted or token consumed).
    // Read hash first so we show that message instead of generic "invalid token".
    const hashError = getParamFromHash('error');
    const hashErrorCode = getParamFromHash('error_code');
    const hashErrorDescription = getParamFromHash('error_description');
    if (hashError || hashErrorCode || hashErrorDescription) {
      const message =
        hashErrorDescription ||
        (hashErrorCode === 'otp_expired' ? t('errors.invalidToken') : null) ||
        hashError ||
        t('errors.invalidToken');
      console.log('[ResetPassword] error from URL hash (Supabase redirect):', { hashError, hashErrorCode, hashErrorDescription });
      setError(typeof message === 'string' ? decodeURIComponent(message.replace(/\+/g, ' ')) : message);
      setIsValidatingToken(false);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return;
    }

    const checkSession = async () => {
      try {
        const supabase = createClient();

        const accessToken = getParamFromHashOrSearch('access_token');
        const refreshToken = getParamFromHashOrSearch('refresh_token');
        const type = getParamFromHashOrSearch('type');

        console.log('[ResetPassword] token params (hash or query)', {
          hasAccessToken: !!accessToken,
          accessTokenLen: accessToken?.length ?? 0,
          hasRefreshToken: !!refreshToken,
          refreshTokenLen: refreshToken?.length ?? 0,
          type,
        });

        if (accessToken && refreshToken && type === 'recovery') {
          const { data, error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionErr) {
            console.error('[ResetPassword] setSession failed', sessionErr.message, sessionErr);
            setError(sessionErr.message || t('errors.invalidToken'));
            setIsValidatingToken(false);
            clearValidationTimeout();
            return;
          }

          // Use session from setSession response, or fall back to getSession() from the same
          // singleton instance (both share in-memory state, so this is always fast/reliable).
          const session = data?.session ?? (await supabase.auth.getSession()).data.session;
          console.log('[ResetPassword] setSession ok, session userId:', session?.user?.id ?? null);
          if (session?.user) {
            succeedWithForm();
            return;
          }
        }

        // No tokens in hash or query — check if a session already exists (e.g. arrived via callback route)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        console.log('[ResetPassword] getSession (no hash tokens):', !!existingSession?.user);
        if (existingSession?.user) {
          succeedWithForm();
          return;
        }

        console.log('[ResetPassword] no valid session');
        setError(t('errors.invalidToken'));
        setIsValidatingToken(false);
        clearValidationTimeout();
      } catch (err) {
        console.error('[ResetPassword] Error checking session:', err);
        setError(err instanceof Error ? err.message : t('errors.invalidToken'));
        setIsValidatingToken(false);
        clearValidationTimeout();
      }
    };

    timeoutId = setTimeout(() => {
      timeoutId = null;
      setError(t('errors.invalidToken'));
      setIsValidatingToken(false);
    }, VALIDATION_TIMEOUT_MS);

    void checkSession();

    return () => clearValidationTimeout();
  }, [t, searchParams]);

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
    console.log('[ResetPassword] handleSubmit: form submitted');

    // Validate form before submitting
    if (!validateForm()) {
      console.log('[ResetPassword] handleSubmit: validation failed', fieldErrors);
      return;
    }

    setIsLoading(true);
    console.log('[ResetPassword] handleSubmit: calling resetPassword...');

    try {
      // Get token from URL hash (Supabase puts it there)
      // But actually, Supabase already created a session, so we don't need the token
      await resetPassword(password);
      console.log('[ResetPassword] handleSubmit: resetPassword succeeded');
      // Redirect after successful password reset
      const returnUrl = getReturnUrl(searchParams);
      const redirectPath = getRedirectPath(returnUrl, locale as 'en' | 'es');
      console.log('[ResetPassword] handleSubmit: redirecting to', redirectPath);
      router.push(redirectPath);
    } catch (err) {
      console.error('[ResetPassword] handleSubmit error:', err);
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
        {/* Header with Logo - constrained so it does not overflow or cut off */}
        <div className="md:sticky md:top-0 md:z-20 md:bg-white flex-shrink-0">
          <div className="flex flex-col py-3 md:pt-6 md:pb-0 md:mb-2">
            <section className="flex items-center justify-center md:pt-0 pb-3 md:pb-2 w-full max-h-20 md:max-h-24 animate-slide-down">
              <Link href={`/${locale}/businesslist`} className="cursor-pointer flex-shrink-0 w-full flex items-center justify-center">
                <Logo width={280} height={70} className="h-auto w-full max-w-full max-h-20 md:max-h-24 object-contain" />
              </Link>
            </section>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <h2 className="text-3xl font-semibold text-center text-black animate-fade-in">{t('title')}</h2>
        </div>

        <p className="text-center text-gray-600 mb-6 animate-fade-in">{t('subtitle')}</p>

        {/* Invalid/expired token (or error from callback or from Supabase hash): show message and link to request new reset */}
        {error && (error === t('errors.invalidToken') || searchParams.get('error') || /expired|invalid/i.test(error)) ? (
          <div className="space-y-6">
            <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 text-center">
              <p className="text-amber-800 font-medium">{error}</p>
              <p className="text-amber-700 text-sm mt-2">{t('invalidTokenHint')}</p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href={`/${locale}/forgot-password`}
                className="inline-flex justify-center rounded-lg border-2 border-black bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
              >
                {t('requestNewLink')}
              </Link>
              <Link
                href={`/${locale}/signin`}
                className="text-center text-sm text-gray-600 hover:text-black underline transition-colors"
              >
                {t('backToSignIn')}
              </Link>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
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

