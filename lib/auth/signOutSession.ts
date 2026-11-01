import type { SupabaseClient } from '@supabase/supabase-js';

const SIGNOUT_TIMEOUT_MS = 4000;

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * End the session on the server (revokes the refresh token and expires auth cookies),
 * then drop the in-memory browser session.
 *
 * The browser client's signOut alone can leave the cookie in place when middleware
 * rewrote it, so the next navigation still looks like the previous user.
 */
export async function signOutSession(supabase: SupabaseClient): Promise<void> {
  let serverCleared = false;
  try {
    const response = await fetchWithTimeout(
      '/api/auth/logout',
      { method: 'POST', credentials: 'include' },
      SIGNOUT_TIMEOUT_MS
    );
    serverCleared = response.ok;
  } catch {
    serverCleared = false;
  }

  try {
    await Promise.race([
      supabase.auth.signOut(serverCleared ? { scope: 'local' } : undefined),
      new Promise<void>((resolve) => {
        setTimeout(resolve, SIGNOUT_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.error('Error signing out:', error);
  }
}
