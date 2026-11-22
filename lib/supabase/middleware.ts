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

/**
 * Email and assurance level (aal1 = password/Google only, aal2 = second step done) from the
 * Supabase session cookie. Not verified here: every route still validates the token with
 * Supabase (getUser), so a forged token cannot get past the route even if it passes the proxy.
 */
export function sessionClaims(request: NextRequest): { userId: string; email: string; aal: string } | null {
  const chunks = request.cookies
    .getAll()
    .filter(
      (cookie) =>
        cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token') && !cookie.name.includes('code-verifier')
    );
  if (chunks.length === 0) return null;
  const base = chunks[0].name.replace(/\.\d+$/, '');
  const single = chunks.find((cookie) => cookie.name === base);
  const raw = single
    ? single.value
    : chunks
        .filter((cookie) => cookie.name.startsWith(`${base}.`))
        .sort((left, right) => Number(left.name.slice(base.length + 1)) - Number(right.name.slice(base.length + 1)))
        .map((cookie) => cookie.value)
        .join('');
  try {
    const payload = raw.startsWith('base64-') ? decodeBase64Url(raw.slice('base64-'.length)) : raw;
    const session = JSON.parse(payload) as { access_token?: string };
    const claims = JSON.parse(decodeBase64Url(session.access_token?.split('.')[1] ?? '')) as {
      sub?: unknown;
      email?: unknown;
      aal?: unknown;
    };
    return {
      userId: typeof claims.sub === 'string' ? claims.sub : '',
      email: typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '',
      aal: typeof claims.aal === 'string' ? claims.aal : 'aal1',
    };
  } catch {
    return null;
  }
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

