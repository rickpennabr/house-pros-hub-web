/** Where a Google customer lands while account setup is still open. */
export function finishSetupPath(
  locale: string,
  options: { welcome: boolean; nextPath: string }
): string {
  const params = new URLSearchParams();
  if (options.welcome) params.set('welcome', '1');
  const next = safeFinishNext(options.nextPath, locale);
  if (next) params.set('next', next);
  const query = params.toString();
  return `/${locale}/signup/finish${query ? `?${query}` : ''}`;
}

/** In-app path saved on the finish screen. Rejects off-site and home-only targets. */
export function safeFinishNext(value: string | null, locale: string): string | null {
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\') || decoded.includes('://')) {
    return null;
  }
  if (decoded === `/${locale}` || decoded === `/${locale}/`) return null;
  return decoded;
}

/**
 * After the person finishes setup: return to the estimate or repair they started,
 * show the thanks screen the first time, or follow the saved in-app path.
 */
export function afterFinishDestination(locale: string, nextPath: string | null, welcome: boolean): string {
  const next = safeFinishNext(nextPath, locale);
  if (next && (next.includes('/estimate') || next.includes('/quick-repair'))) return next;
  if (welcome) return `/${locale}/signup/success?role=customer`;
  if (next) return next;
  return `/${locale}`;
}

const NEXT_KEY = 'hph-finish-next';
const WELCOME_KEY = 'hph-finish-welcome';

export function rememberFinishTarget(locale: string, nextPath: string | null, welcome: boolean) {
  if (typeof window === 'undefined') return;
  const next = safeFinishNext(nextPath, locale);
  if (next) sessionStorage.setItem(NEXT_KEY, next);
  if (welcome) sessionStorage.setItem(WELCOME_KEY, '1');
}

export function readAfterFinishDestination(locale: string): string {
  if (typeof window === 'undefined') return `/${locale}`;
  const next = sessionStorage.getItem(NEXT_KEY);
  const welcome = sessionStorage.getItem(WELCOME_KEY) === '1';
  sessionStorage.removeItem(NEXT_KEY);
  sessionStorage.removeItem(WELCOME_KEY);
  return afterFinishDestination(locale, next, welcome);
}
