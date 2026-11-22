/**
 * Proof that a person owns their account email. Server only.
 *
 * Signup confirms the Supabase email right away so people are signed in instantly, so
 * email_confirmed_at proves nothing: anyone can sign up with someone else's address. Anything
 * that hands out data by email (the CRM auto-claim in My Places) must call emailOwnershipProven().
 *
 * Ownership is proven by:
 * - clicking the verification link we email (signed token, 3 days),
 * - opening a password-reset link (it went to that inbox),
 * - signing in with Google for that address (Google verified it).
 * It is stored in profiles.verified_email (protected by a trigger: only the service role can set it).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { User } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getResendClient, getResendFromEmail } from '@/lib/utils/resend';
import { logger } from '@/lib/utils/logger';

type Admin = ReturnType<typeof createServiceRoleClient>;

const TOKEN_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const normEmail = (email: string | null | undefined) => (email ?? '').trim().toLowerCase();

function secret(): Buffer {
  const own = process.env.EMAIL_VERIFY_SECRET?.trim();
  const base = own || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base) throw new Error('EMAIL_VERIFY_SECRET (or SUPABASE_SERVICE_ROLE_KEY) is required');
  // Derived, so the service key itself is never used directly as an HMAC key elsewhere.
  return createHmac('sha256', base).update('hph-email-verify-v1').digest();
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** A link token binding user id + email + expiry. */
export function createEmailVerifyToken(userId: string, email: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: normEmail(email), x: now + TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readEmailVerifyToken(token: string): { userId: string; email: string } | null {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { u?: unknown; e?: unknown; x?: unknown };
    if (typeof data.u !== 'string' || typeof data.e !== 'string' || typeof data.x !== 'number') return null;
    if (Date.now() > data.x) return null;
    return { userId: data.u, email: data.e };
  } catch {
    return null;
  }
}

/** Google identity for the account's current address (Google verified that inbox). */
function hasGoogleForEmail(user: Pick<User, 'email' | 'identities'>): boolean {
  const email = normEmail(user.email);
  return Boolean(
    email &&
      user.identities?.some(
        (identity) => identity.provider === 'google' && normEmail(identity.identity_data?.email as string | undefined) === email
      )
  );
}

/** True when this person has proven they own their current account email. */
export async function emailOwnershipProven(user: Pick<User, 'id' | 'email' | 'identities'>, admin: Admin = createServiceRoleClient()): Promise<boolean> {
  const email = normEmail(user.email);
  if (!email) return false;
  if (hasGoogleForEmail(user)) return true;
  const { data } = await admin.from('profiles').select('verified_email').eq('id', user.id).maybeSingle();
  return normEmail(data?.verified_email) === email;
}

export async function markEmailVerified(userId: string, email: string, admin: Admin = createServiceRoleClient()): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .update({ verified_email: normEmail(email), email_verified_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) logger.warn('[email-ownership] could not mark verified', { userId, error: error.message });
}

/** The session id inside a Supabase access token (to keep the current session alive). */
function sessionIdFromAccessToken(accessToken: string | null | undefined): string | null {
  try {
    const payload = JSON.parse(Buffer.from((accessToken ?? '').split('.')[1] ?? '', 'base64url').toString('utf8')) as { session_id?: unknown };
    return typeof payload.session_id === 'string' ? payload.session_id : null;
  } catch {
    return null;
  }
}

/**
 * After a Google sign-in. If the account also has a password that was set before anyone proved
 * owning this address (someone may have signed up with it first), that password is replaced with
 * a random one and every other session is ended, so only the inbox owner keeps access.
 * Then the address counts as verified.
 */
export async function secureAfterGoogleSignIn(user: User, accessToken: string | null | undefined): Promise<void> {
  if (!hasGoogleForEmail(user)) return;
  const admin = createServiceRoleClient();
  const email = normEmail(user.email);
  const { data } = await admin.from('profiles').select('verified_email').eq('id', user.id).maybeSingle();
  const alreadyProven = normEmail(data?.verified_email) === email;
  const hasPassword = user.identities?.some((identity) => identity.provider === 'email') ?? false;

  if (hasPassword && !alreadyProven) {
    const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, {
      password: randomBytes(32).toString('base64url'),
    });
    const { error: sessionError } = await admin.rpc('revoke_other_sessions', {
      p_user_id: user.id,
      p_keep_session_id: sessionIdFromAccessToken(accessToken) ?? undefined,
    });
    logger.warn('[email-ownership] Google proved the address: reset the unverified password and other sessions', {
      userId: user.id,
      passwordError: passwordError?.message,
      sessionError: sessionError?.message,
    });
  }
  if (!alreadyProven) await markEmailVerified(user.id, email, admin);
}

function verifyEmailHtml(link: string, firstName: string): string {
  const name = firstName.replace(/[<>&"']/g, '');
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin:0 0 12px">Confirm your email</h2>
  <p>Hi${name ? ` ${name}` : ''}, tap the button to confirm this is your email. After that, work your pros saved for you (houses, estimates, invoices and documents) shows up in <b>My Places</b>.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Confirm my email</a></p>
  <p style="font-size:12px;color:#555">The link works for 3 days. If you did not create a House Pros Hub account, ignore this email: nothing will be shared.</p>
</div>`;
}

/** Email the verification link. Returns false when it could not be sent. */
export async function sendEmailVerification(input: {
  userId: string;
  email: string;
  origin: string;
  locale?: string;
  firstName?: string;
}): Promise<boolean> {
  const locale = input.locale === 'es' || input.locale === 'pt' ? input.locale : 'en';
  const token = createEmailVerifyToken(input.userId, input.email);
  const link = `${input.origin.replace(/\/+$/, '')}/api/auth/verify-email?token=${encodeURIComponent(token)}&locale=${locale}`;
  try {
    const { error } = await getResendClient().emails.send({
      from: getResendFromEmail(),
      to: normEmail(input.email),
      subject: 'Confirm your email for House Pros Hub',
      html: verifyEmailHtml(link, input.firstName ?? ''),
    });
    if (error) {
      logger.warn('[email-ownership] verification email failed', { userId: input.userId, error: error.message });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn('[email-ownership] verification email failed', {
      userId: input.userId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return false;
  }
}

/** emailOwnershipProven by user id (for code that only has the id). False when the user is gone. */
export async function userEmailOwned(userId: string, admin: Admin = createServiceRoleClient()): Promise<boolean> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user ? emailOwnershipProven(data.user, admin) : false;
}
