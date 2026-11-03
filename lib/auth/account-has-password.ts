interface AccountIdentity {
  provider?: string | null;
  last_sign_in_at?: string | null;
}

interface AccountForDelete {
  identities?: AccountIdentity[] | null;
  app_metadata?: {
    provider?: string | null;
    providers?: string[] | null;
  } | null;
}

function providersOf(user: AccountForDelete | null | undefined): Set<string> {
  const providers = new Set<string>();
  for (const identity of user?.identities ?? []) {
    if (identity.provider) providers.add(identity.provider);
  }
  for (const provider of user?.app_metadata?.providers ?? []) {
    if (provider) providers.add(provider);
  }
  if (user?.app_metadata?.provider) providers.add(user.app_metadata.provider);
  return providers;
}

function decodeTokenPayload(payload: string): { amr?: Array<{ method?: string }> } {
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const json = typeof atob === 'function'
    ? atob(padded)
    : Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json) as { amr?: Array<{ method?: string }> };
}

/** How this session was signed in. Google OAuth sessions use `oauth`. */
export function sessionSignInMethod(accessToken: string | null | undefined): 'password' | 'oauth' | 'unknown' {
  if (!accessToken) return 'unknown';
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return 'unknown';
    const json = decodeTokenPayload(payload);
    const methods = (json.amr ?? []).map((entry) => entry.method).filter((method): method is string => Boolean(method));
    if (methods.includes('oauth')) return 'oauth';
    if (methods.includes('password')) return 'password';
  } catch {
    return 'unknown';
  }
  return 'unknown';
}

/**
 * Password proof is only for accounts that can sign in with a password.
 * A Google-only account, or a linked account currently signed in with Google,
 * confirms by typing the account email instead.
 */
export function accountDeleteUsesPassword(
  user: AccountForDelete | null | undefined,
  accessToken?: string | null
): boolean {
  const providers = providersOf(user);
  const hasEmail = providers.has('email');
  const hasGoogle = providers.has('google');
  if (hasGoogle && !hasEmail) return false;
  if (hasEmail && !hasGoogle) return true;
  if (hasEmail && hasGoogle) {
    const method = sessionSignInMethod(accessToken);
    if (method === 'oauth') return false;
    if (method === 'password') return true;
    const latest = (provider: string) =>
      Math.max(
        0,
        ...(user?.identities ?? [])
          .filter((identity) => identity.provider === provider && identity.last_sign_in_at)
          .map((identity) => Date.parse(identity.last_sign_in_at as string))
      );
    const googleAt = latest('google');
    const emailAt = latest('email');
    if (googleAt > 0 && googleAt >= emailAt) return false;
    return emailAt > 0;
  }
  return false;
}
