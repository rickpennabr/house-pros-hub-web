'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { useAuth } from '@/contexts/AuthContext';
import { rememberFinishTarget } from '@/lib/auth/finishSetup';

function FinishSetupPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const { user, isLoading } = useAuth();
  const sawPending = useRef(false);

  useEffect(() => {
    rememberFinishTarget(locale, searchParams.get('next'), searchParams.get('welcome') === '1');
  }, [locale, searchParams]);

  useEffect(() => {
    if (user?.accountSetupPending) sawPending.current = true;
  }, [user?.accountSetupPending]);

  useEffect(() => {
    if (isLoading || sawPending.current) return;
    if (!user) {
      router.replace(`/${locale}/signin`);
      return;
    }
    if (!user.accountSetupPending) router.replace(`/${locale}`);
  }, [isLoading, user, locale, router]);

  // The setup modal covers this page while the account is still pending.
  // A finished or signed-out visit should not sit on a blank screen.
  const waiting = isLoading || user?.accountSetupPending === true;

  return (
    <AuthPageLayout>
      <div className="flex flex-1 items-center justify-center p-8">
        {waiting ? <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" /> : null}
      </div>
    </AuthPageLayout>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FinishSetupPage />
    </Suspense>
  );
}
