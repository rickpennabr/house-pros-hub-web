'use client';

const CSRF_COOKIE = 'hph_csrf';
const CSRF_HEADER = 'x-hph-csrf';
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const row = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  if (!row) return null;
  return decodeURIComponent(row.slice(prefix.length));
}

declare global {
  interface Window {
    __hphCsrfFetch?: boolean;
  }
}

if (typeof window !== 'undefined' && !window.__hphCsrfFetch) {
  window.__hphCsrfFetch = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    if (!MUTATING.has(method)) return original(input, init);

    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let path = rawUrl;
    try {
      path = new URL(rawUrl, window.location.origin).pathname;
    } catch {
      return original(input, init);
    }
    if (!path.startsWith('/api/') || path.startsWith('/api/webhooks/')) {
      return original(input, init);
    }

    const token = readCookie(CSRF_COOKIE);
    if (!token) return original(input, init);

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has(CSRF_HEADER)) headers.set(CSRF_HEADER, token);
    return original(input, { ...init, headers });
  };
}

/** Installs the double-submit CSRF header on same-origin API writes. */
export function CsrfFetchPatch() {
  return null;
}
