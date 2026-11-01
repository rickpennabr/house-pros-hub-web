import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/types/supabase';

const REFRESH_WINDOW_MS = 60_000;

/**
 * True when a Supabase auth cookie is present and the access token is missing,
 * unreadable, or inside the refresh window. Anonymous requests stay false so
 * the proxy does not call the Auth server on every page view.
 */
export function sessionNeedsRefresh(request: NextRequest): boolean {
  const chunks = request.cookies
    .getAll()
    .filter(
      (cookie) =>
        cookie.name.startsWith('sb-') &&
        cookie.name.includes('-auth-token') &&
        !cookie.name.includes('code-verifier')
    );
  if (chunks.length === 0) return false;

  const bases = new Set(chunks.map((cookie) => cookie.name.replace(/\.\d+$/, '')));
  for (const base of bases) {
    const single = chunks.find((cookie) => cookie.name === base);
    const parts = single
      ? [single.value]
      : chunks
          .filter((cookie) => cookie.name.startsWith(`${base}.`))
          .sort((left, right) => {
            const leftIndex = Number(left.name.slice(base.length + 1));
            const rightIndex = Number(right.name.slice(base.length + 1));
            return leftIndex - rightIndex;
          })
          .map((cookie) => cookie.value);
    if (parts.length === 0 || parts.some((part) => part.length === 0)) return true;

    const raw = parts.join('');
    try {
      const payload = raw.startsWith('base64-') ? decodeBase64Url(raw.slice('base64-'.length)) : raw;
      const session = JSON.parse(payload) as { expires_at?: number };
      if (typeof session.expires_at !== 'number') return true;
      if (session.expires_at * 1000 <= Date.now() + REFRESH_WINDOW_MS) return true;
    } catch {
      return true;
    }
  }
  return false;
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Creates a Supabase client that writes session cookies onto the response
 * that middleware actually returns.
 *
 * Cookie options (path, maxAge, sameSite) must be copied through. Dropping them
 * turns a sign-out delete (maxAge: 0) into a normal cookie, so the next request
 * is still that user.
 */
export function createClient(request: NextRequest, response: NextResponse) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
}

