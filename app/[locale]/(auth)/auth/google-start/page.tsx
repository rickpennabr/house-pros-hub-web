'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { GoogleHandoffOverlay } from '@/components/auth/GoogleHandoffOverlay';
import { createClient } from '@/lib/supabase/client';
import { startGoogleOAuth, type GoogleOAuthFlow } from '@/lib/auth/googleOAuth';

function safeFlow(value: string | null): GoogleOAuthFlow {
  return value === 'customer' ? 'customer' : 'signin';
}

/**
 * Quiet OAuth entry (same idea as BrazaLink `/auth/google-start`).
 * Phone LAN IPs hop here on sslip.io first so Google/Supabase get a hostname
 * redirect — without reloading the heavy sign-in/sign-up screens.
 */
function GoogleStartInner() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const tHandoff = useTranslations('auth.googleHandoff');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      const flow = safeFlow(searchParams.get('flow'));
      const returnUrl = searchParams.get('returnUrl');

      try {
        const supabase = createClient();
        // Drop stale/invalid cookies that can break the next exchange.
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Continue to Google even if local sign-out fails.
      }

      const failTo = (message: string) => {
        const path =
          flow === 'customer'
            ? `/${locale}/signup?role=customer&error=${encodeURIComponent(message)}`
            : `/${locale}/signin?error=${encodeURIComponent(message)}`;
        window.location.replace(path);
      };

      try {
        const result = await startGoogleOAuth({
          flow,
          locale,
          returnUrl,
        });
        if (result.ok || result.error === 'redirect_to_lan') return;
        failTo(
          result.error === 'redirect_not_allowlisted'
            ? result.message
            : result.message || 'Could not start Google sign-in'
        );
      } catch (error) {
        console.error('[GoogleStart]', error);
        failTo('Could not start Google sign-in');
      }
    })();
  }, [locale, searchParams]);

  return (
    <GoogleHandoffOverlay
      open
      title={tHandoff('title')}
      subtitle={tHandoff('subtitle')}
    />
  );
}

export default function GoogleStartPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
        </div>
      }
    >
      <GoogleStartInner />
    </Suspense>
  );
}
