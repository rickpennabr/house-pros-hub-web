/**
 * Session snapshot: a small note on this device about who was signed in, so the next page can draw the
 * signed-in screen right away (photo, bell, buttons) while the server confirms the session in the
 * background. Only what is shown on screen: no tokens, email, phone or address. The server still checks
 * the real session on every request; this only decides what is drawn first.
 */

const KEY = 'hph_session_snapshot';
const VERSION = 1;
/** Older than this, start from the guest screen and wait for the server (a long-gone session). */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface SnapshotUser {
  id: string;
  firstName: string;
  lastName: string;
  userPicture?: string;
  businessId?: string;
  businessLogo?: string;
  companyName?: string;
  preferredLocale?: string;
  accountSetupPending?: boolean;
}

export interface SessionSnapshot {
  v: number;
  savedAt: number;
  user: SnapshotUser;
  isAdmin: boolean;
  roles: string[];
}

/** Only the fields that are safe and useful to draw the first screen. */
export function toSnapshotUser(user: SnapshotUser & Record<string, unknown>): SnapshotUser {
  return {
    id: user.id,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    ...(user.userPicture ? { userPicture: user.userPicture } : {}),
    ...(user.businessId ? { businessId: user.businessId } : {}),
    ...(user.businessLogo ? { businessLogo: user.businessLogo } : {}),
    ...(user.companyName ? { companyName: user.companyName } : {}),
    ...(user.preferredLocale ? { preferredLocale: user.preferredLocale } : {}),
    ...(user.accountSetupPending ? { accountSetupPending: true } : {}),
  };
}

/**
 * Supabase keeps the session in a readable cookie named sb-<project>-auth-token (split into .0, .1
 * when long). No cookie means signed out (here or in another tab): the snapshot must not be used.
 */
export function hasSessionCookie(cookie: string): boolean {
  return /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=[^;]+/.test(cookie);
}

/** The snapshot to draw from, or null when it is missing, old, broken, or there is no session cookie. */
export function parseSnapshot(raw: string | null, cookie: string, now: number): SessionSnapshot | null {
  if (!raw || !hasSessionCookie(cookie)) return null;
  try {
    const data = JSON.parse(raw) as Partial<SessionSnapshot>;
    if (data.v !== VERSION || typeof data.savedAt !== 'number' || now - data.savedAt > MAX_AGE_MS) return null;
    if (!data.user || typeof data.user.id !== 'string' || !data.user.id) return null;
    return {
      v: VERSION,
      savedAt: data.savedAt,
      user: data.user,
      isAdmin: data.isAdmin === true,
      roles: Array.isArray(data.roles) ? data.roles.filter((role): role is string => typeof role === 'string') : [],
    };
  } catch {
    return null;
  }
}

export function readSessionSnapshot(): SessionSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseSnapshot(window.localStorage.getItem(KEY), document.cookie, Date.now());
  } catch {
    return null;
  }
}

export function writeSessionSnapshot(user: SnapshotUser & Record<string, unknown>, isAdmin: boolean, roles: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const snapshot: SessionSnapshot = { v: VERSION, savedAt: Date.now(), user: toSnapshotUser(user), isAdmin, roles };
    window.localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Private mode or full storage: the next page just waits for the server, as before.
  }
}

export function clearSessionSnapshot(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
