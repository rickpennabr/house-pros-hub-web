/**
 * Two-step sign-in for the admin account (Supabase TOTP MFA).
 *
 * The admin account can do everything (users, businesses, invoices, chat as ProBot, storage), so
 * a stolen password or Google session alone must not be enough. Until the admin finishes the
 * second step in this session (aal2), proxy.ts lets that account reach only the two-step page,
 * sign-in pages and auth APIs. Other accounts are not affected.
 *
 * Emergency switch (lost phone): set ADMIN_MFA_DISABLED=1 on the server and redeploy, or delete
 * the factor in Supabase Dashboard > Authentication > Users. Only someone with server or
 * dashboard access can do either.
 *
 * Edge-safe: no Node imports (proxy.ts uses it).
 */
export const ADMIN_MFA_PATH = '/admin-mfa';
/** Code page for everyone else who turned two-step on (under the locale: /en/two-step). */
export const TWO_STEP_SEGMENT = 'two-step';

export function adminMfaEnforced(): boolean {
  return process.env.ADMIN_MFA_DISABLED?.trim() !== '1';
}

export function adminEmailFromEnv(): string {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '';
}

const OPEN_API = ['/api/auth/', '/api/csrf-token', '/api/health', '/api/webhooks/', '/api/stripe/webhook', '/api/cron/'];
const OPEN_PAGE = /^\/(?:[a-z]{2}\/)?(?:signin|signup|reset-password|forgot-password|auth|two-step)(?:\/|$)/;

/** Paths the admin account may use before finishing the second step. */
export function allowedBeforeAdminMfa(pathname: string): boolean {
  if (pathname === ADMIN_MFA_PATH || pathname.startsWith(`${ADMIN_MFA_PATH}/`)) return true;
  if (OPEN_API.some((prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix))) return true;
  return OPEN_PAGE.test(pathname);
}

/** Server side: true when this session finished the second step (or enforcement is off). */
export async function adminSessionVerified(supabase: {
  auth: { mfa: { getAuthenticatorAssuranceLevel: () => Promise<{ data: { currentLevel: string | null } | null }> } };
}): Promise<boolean> {
  if (!adminMfaEnforced()) return true;
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === 'aal2';
}
