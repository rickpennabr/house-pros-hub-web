'use client';

import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/lib/types/supabase';

/**
 * Singleton browser client so that setSession() and subsequent getSession() calls
 * share the same in-memory state. Without a singleton, a second createClient() call
 * would return a cold instance that has no knowledge of the session set by the first
 * instance (e.g. on the reset-password page), causing spurious "invalid token" errors.
 *
 * detectSessionInUrl: false so the reset-password page can read recovery tokens from the
 * hash and call setSession() itself. Otherwise the client may consume or mishandle the
 * hash before our code runs.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    }
  );

  return browserClient;
}

