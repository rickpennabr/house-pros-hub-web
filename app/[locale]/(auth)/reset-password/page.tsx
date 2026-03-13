'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import Logo from '@/components/Logo';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { createClient } from '@/lib/supabase/client';
import { updatePassword } from '@/app/actions/auth-actions';
import { passwordSchema } from '@/lib/schemas/auth';

const SESSION_STORAGE_KEY_DONE = 'hph_reset_session_done';
const SESSION_STORAGE_KEY_IN_PROGRESS = 'hph_reset_session_in_progress';
/** Give setSession time to complete; Supabase can be slow on first request or under load. */
const SET_SESSION_TIMEOUT_MS = 45000;
const POLL_INTERVAL_MS = 400;
const POLL_MAX_ATTEMPTS = 40; // ~16s

function ResetPasswordContent() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth.resetPassword');
  const tRef = useRef(t);
  tRef.current = t;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingSession, setIsValidatingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);

  useEffect(() => {
    const getT = () => tRef.current;

    const checkSession = async () => {
      if (typeof window === 'undefined') return;
      setIsValidatingSession(true);
      const supabase = createClient();
      console.info('[ResetPassword] checkSession', { pathname: window.location.pathname, hasHash: !!window.location.hash });
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashError = hashParams.get('error');
      const hashErrorCode = hashParams.get('error_code');
      const hashErrorDescription = hashParams.get('error_description');
      const queryError = searchParams.get('error');

      if (hashError || hashErrorCode || queryError) {
        const errorMessage =
          hashErrorDescription ||
          (typeof queryError === 'string' ? decodeURIComponent(queryError) : null) ||
          getT()('errors.invalidToken');
        console.info('[ResetPassword] error from URL', { hasHashError: !!hashError, hasQueryError: !!queryError });
        setError(errorMessage);
        window.history.replaceState(null, '', window.location.pathname);
        sessionStorage.removeItem(SESSION_STORAGE_KEY_DONE);
        sessionStorage.removeItem(SESSION_STORAGE_KEY_IN_PROGRESS);
        setIsValidatingSession(false);
        return;
      }

      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      if (accessToken && refreshToken && type === 'recovery') {
        const alreadyDone = sessionStorage.getItem(SESSION_STORAGE_KEY_DONE) === '1';
        if (alreadyDone) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.info('[ResetPassword] session restored from storage (post-HMR)');
            setIsValidToken(true);
          } else {
            sessionStorage.removeItem(SESSION_STORAGE_KEY_DONE);
            setError(getT()('errors.invalidToken'));
          }
          setIsValidatingSession(false);
          return;
        }

        const inProgress = sessionStorage.getItem(SESSION_STORAGE_KEY_IN_PROGRESS) === '1';
        if (inProgress) {
          for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              console.info('[ResetPassword] session found after in-progress (HMR recovery)');
              sessionStorage.setItem(SESSION_STORAGE_KEY_DONE, '1');
              sessionStorage.removeItem(SESSION_STORAGE_KEY_IN_PROGRESS);
              window.history.replaceState(null, '', window.location.pathname);
              setIsValidToken(true);
              setIsValidatingSession(false);
              return;
            }
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          }
          sessionStorage.removeItem(SESSION_STORAGE_KEY_IN_PROGRESS);
          setError(getT()('errors.invalidToken'));
          setIsValidatingSession(false);
          return;
        }

        sessionStorage.setItem(SESSION_STORAGE_KEY_IN_PROGRESS, '1');
        console.info('[ResetPassword] hash tokens present, setting session');
        try {
          const setSessionPromise = supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('setSession timeout')), SET_SESSION_TIMEOUT_MS)
          );
          const { data, error: setSessionError } = await Promise.race([
            setSessionPromise,
            timeoutPromise,
          ]);
          if (setSessionError) {
            console.error('[ResetPassword] setSession error', setSessionError);
            sessionStorage.removeItem(SESSION_STORAGE_KEY_IN_PROGRESS);
            setError(getT()('errors.invalidToken'));
            window.history.replaceState(null, '', window.location.pathname);
            setIsValidatingSession(false);
            return;
          }
          if (data?.session) {
            sessionStorage.setItem(SESSION_STORAGE_KEY_DONE, '1');
            sessionStorage.removeItem(SESSION_STORAGE_KEY_IN_PROGRESS);
            window.history.replaceState(null, '', window.location.pathname);
            console.info('[ResetPassword] session set from hash');
            setIsValidToken(true);
          }
        } catch (err) {
          console.info('[ResetPassword] setSession from hash failed', err);
          sessionStorage.removeItem(SESSION_STORAGE_KEY_IN_PROGRESS);
          const isTimeout = err instanceof Error && err.message === 'setSession timeout';
          setError(
            isTimeout
              ? getT()('errors.timeout') ?? getT()('errors.invalidToken')
              : getT()('errors.invalidToken')
          );
          // Don't clear hash on timeout so user can refresh and retry
          if (!isTimeout) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
        setIsValidatingSession(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.info('[ResetPassword] session from getSession (e.g. callback)');
        setIsValidToken(true);
      } else {
        console.info('[ResetPassword] no session, no hash tokens');
        setError(getT()('errors.invalidToken'));
      }
      setIsValidatingSession(false);
    };
    checkSession();
  }, [searchParams]);

  useEffect(() => {
    if (!newPassword) {
      setPasswordError(null);
      return;
    }
    const result = passwordSchema.safeParse(newPassword);
    setPasswordError(
      result.success ? null : (result.error.issues[0]?.message ?? t('validation.passwordInvalid'))
    );
  }, [newPassword, t]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setError(t('validation.passwordsDoNotMatch'));
      return;
    }
    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('validation.passwordInvalid'));
      return;
    }
    setIsLoading(true);
    try {
      const result = await updatePassword(newPassword);
      if (result.error) {
        const errLower = result.error.toLowerCase();
        if (
          errLower.includes('same') ||
          errLower.includes('previous') ||
          errLower.includes('current')
        ) {
          setError(t('errors.samePassword'));
        } else {
          setError(result.error);
        }
        return;
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SESSION_STORAGE_KEY_DONE);
        sessionStorage.removeItem(SESSION_STORAGE_KEY_IN_PROGRESS);
      }
      setSuccess(true);
      console.info('[ResetPassword] password updated, redirecting to signin');
      setTimeout(() => {
        router.push(`/${locale}/signin`);
      }, 3000);
    } catch {
      setError(t('errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto flex flex-col text-black">
          <div className="md:sticky md:top-0 md:z-20 md:bg-white flex-shrink-0">
            <div className="flex flex-col py-3 md:pt-6 md:pb-0 md:mb-2">
              <section className="flex items-center justify-center md:pt-0 pb-3 md:pb-2 w-full max-h-20 md:max-h-24 animate-slide-down">
                <Link
                  href={`/${locale}/businesslist`}
                  className="cursor-pointer flex-shrink-0 w-full flex items-center justify-center"
                >
                  <Logo src="/hph-logo-with-pro-bot-mobile.png" width={280} height={70} className="h-auto w-full max-w-full max-h-20 md:max-h-24 object-contain" />
                </Link>
              </section>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 mb-4">
            <h2 className="text-3xl font-semibold text-center text-black animate-fade-in">
              {t('success.title')}
            </h2>
          </div>
          <p className="text-center text-gray-600 mb-6 animate-fade-in">{t('success.message')}</p>
          <p className="text-center text-sm text-gray-500 mb-6">{t('success.redirecting')}</p>
          <Link
            href={`/${locale}/signin`}
            className="inline-flex justify-center rounded-lg border-2 border-black bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            {t('backToSignIn')}
          </Link>
        </div>
      </AuthPageLayout>
    );
  }

  if (isValidatingSession) {
    return (
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[300px] text-black">
          <p className="text-gray-600">{t('validatingToken')}</p>
        </div>
      </AuthPageLayout>
    );
  }

  if (!isValidToken) {
    return (
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto flex flex-col text-black">
          <div className="md:sticky md:top-0 md:z-20 md:bg-white flex-shrink-0">
            <div className="flex flex-col py-3 md:pt-6 md:pb-0 md:mb-2">
              <section className="flex items-center justify-center md:pt-0 pb-3 md:pb-2 w-full max-h-20 md:max-h-24 animate-slide-down">
                <Link
                  href={`/${locale}/businesslist`}
                  className="cursor-pointer flex-shrink-0 w-full flex items-center justify-center"
                >
                  <Logo src="/hph-logo-with-pro-bot-mobile.png" width={280} height={70} className="h-auto w-full max-w-full max-h-20 md:max-h-24 object-contain" />
                </Link>
              </section>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 mb-4">
            <h2 className="text-3xl font-semibold text-center text-black animate-fade-in">{t('title')}</h2>
          </div>
          <p className="text-center text-gray-600 mb-6 animate-fade-in">{t('subtitle')}</p>
          <div className="space-y-6">
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-800 font-medium">{error ?? t('errors.invalidToken')}</p>
              <p className="text-red-700 text-sm mt-2">{t('invalidTokenHint')}</p>
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
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <div className="w-full max-w-md mx-auto flex flex-col text-black">
        <div className="md:sticky md:top-0 md:z-20 md:bg-white flex-shrink-0">
          <div className="flex flex-col py-3 md:pt-6 md:pb-0 md:mb-2">
            <section className="flex items-center justify-center md:pt-0 pb-3 md:pb-2 w-full max-h-20 md:max-h-24 animate-slide-down">
              <Link
                href={`/${locale}/businesslist`}
                className="cursor-pointer flex-shrink-0 w-full flex items-center justify-center"
              >
                <Logo src="/hph-logo-with-pro-bot-mobile.png" width={280} height={70} className="h-auto w-full max-w-full max-h-20 md:max-h-24 object-contain" />
              </Link>
            </section>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 mb-4">
          <h2 className="text-3xl font-semibold text-center text-black animate-fade-in">{t('title')}</h2>
        </div>
        <p className="text-center text-gray-600 mb-6 animate-fade-in">{t('subtitle')}</p>
        <ErrorMessage message={error ?? ''} />
        <form onSubmit={handleSubmit} className="space-y-6">
          <PasswordInput
            id="new-password"
            label={t('passwordLabel')}
            required
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setError(null);
            }}
            placeholder={t('passwordPlaceholder')}
            disabled={isLoading}
            error={passwordError ?? undefined}
            autoComplete="new-password"
          />
          <PasswordInput
            id="confirm-password"
            label={t('confirmPasswordLabel')}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('confirmPasswordPlaceholder')}
            disabled={isLoading}
            autoComplete="new-password"
          />
          <Button type="submit" variant="primary" disabled={isLoading} className="w-full">
            {isLoading ? t('submitting') : t('submit')}
          </Button>
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
    <Suspense
      fallback={
        <AuthPageLayout>
          <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[400px]">
            <p className="text-gray-600">{t('message.loading')}</p>
          </div>
        </AuthPageLayout>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
