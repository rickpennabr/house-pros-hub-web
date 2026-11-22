/**
 * Optional two-step sign-in (TOTP) for any account: pros, installers, customers. Server only
 * (proxy.ts runs on Node).
 *
 * Once a person has a verified authenticator, a session that only used the password or Google
 * (aal1) can reach nothing but the code page until the code is entered (aal2). The session token
 * does not say whether someone has two-step on, and the factor list in the session cookie can be
 * edited by whoever holds the cookie, so the answer comes from Supabase's admin API, cached briefly.
 */
import { createClient } from '@supabase/supabase-js';
import { getResendClient, getResendFromEmail } from '@/lib/utils/resend';

const CACHE_MS = 60_000;
const CACHE_LIMIT = 5_000;
const cache = new Map<string, { on: boolean; expires: number }>();

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Verified authenticators straight from Supabase (no cache). */
export async function verifiedFactorCount(userId: string): Promise<number> {
  const { data, error } = await adminClient().auth.admin.mfa.listFactors({ userId });
  if (error) throw new Error(error.message);
  return (data?.factors ?? []).filter((factor) => factor.status === 'verified').length;
}

/**
 * True when this user turned on two-step sign-in. On a Supabase error it answers false (fails
 * open) so an outage does not lock every account out; the error is logged.
 */
export async function userHasTwoStep(userId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return false;
  const hit = cache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.on;
  try {
    const on = (await verifiedFactorCount(userId)) > 0;
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(userId, { on, expires: Date.now() + CACHE_MS });
    return on;
  } catch (error) {
    console.error('[two-step] could not read factors', error instanceof Error ? error.message : error);
    return false;
  }
}

/** After the person changed their authenticators (this server instance; others refresh within a minute). */
export function forgetTwoStep(userId: string): void {
  cache.delete(userId);
}

/** Security notice to the account email when two-step was turned on or off. */
export async function sendTwoStepNotice(email: string, enabled: boolean): Promise<void> {
  const html = enabled
    ? `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin:0 0 12px">Two-step sign-in is on</h2>
  <p>Your House Pros Hub account now asks for a code from your authenticator app after the password.</p>
  <p style="font-size:12px;color:#555">If you did not do this, reset your password right away and contact support.</p></div>`
    : `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin:0 0 12px">Two-step sign-in was turned off</h2>
  <p>Your House Pros Hub account no longer asks for an authenticator code.</p>
  <p style="font-size:12px;color:#555">If you did not do this, reset your password right away and turn two-step sign-in back on in Account management &gt; Settings.</p></div>`;
  try {
    await getResendClient().emails.send({
      from: getResendFromEmail(),
      to: email,
      subject: enabled ? 'Two-step sign-in is on' : 'Two-step sign-in was turned off',
      html,
    });
  } catch (error) {
    console.error('[two-step] notice email failed', error instanceof Error ? error.message : error);
  }
}
