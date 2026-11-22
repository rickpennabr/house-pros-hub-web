import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import {
  emailOwnershipProven,
  markEmailVerified,
  readEmailVerifyToken,
  sendEmailVerification,
} from '@/lib/auth/email-ownership';
import { claimPortalCustomers } from '@/lib/places/portal';

/** Links in emails use the configured site, never the request Host header (it can be forged). */
function siteOrigin(request: NextRequest): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') throw new Error('NEXT_PUBLIC_SITE_URL is required');
  return request.nextUrl.origin;
}

function safeLocale(value: string | null): string {
  return value === 'es' || value === 'pt' ? value : 'en';
}

/**
 * GET /api/auth/verify-email?token=…&locale=…
 * The link from the verification email. The signed token is the proof (it works in any browser).
 * Marks the email verified, claims the CRM contacts saved under it, and opens My Places.
 */
export async function GET(request: NextRequest) {
  const rate = await checkRateLimit(request, 'auth');
  if (rate) return rate;
  const locale = safeLocale(request.nextUrl.searchParams.get('locale'));
  const origin = siteOrigin(request);
  const fail = NextResponse.redirect(new URL(`/${locale}/places?verified=0`, origin));
  const token = readEmailVerifyToken(request.nextUrl.searchParams.get('token') ?? '');
  if (!token) return fail;

  const admin = createServiceRoleClient();
  const { data } = await admin.auth.admin.getUserById(token.userId);
  const user = data.user;
  // The account must still use the address the link was sent to.
  if (!user || (user.email ?? '').trim().toLowerCase() !== token.email) return fail;

  await markEmailVerified(user.id, token.email, admin);
  try {
    await claimPortalCustomers({ id: user.id, email: user.email, emailOwned: true });
  } catch (error) {
    console.error('verify-email claim', error instanceof Error ? error.message : error);
  }
  return NextResponse.redirect(new URL(`/${locale}/places?verified=1`, origin));
}

/** POST /api/auth/verify-email: (re)send the verification email to the signed-in person. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rate = await checkRateLimit(request, 'auth', user.id);
  if (rate) return rate;
  if (await emailOwnershipProven(user)) return NextResponse.json({ ok: true, alreadyVerified: true });

  const body = (await request.json().catch(() => ({}))) as { locale?: unknown };
  const sent = await sendEmailVerification({
    userId: user.id,
    email: user.email,
    origin: siteOrigin(request),
    locale: typeof body.locale === 'string' ? body.locale : 'en',
    firstName: typeof user.user_metadata?.firstName === 'string' ? user.user_metadata.firstName : '',
  });
  if (!sent) return NextResponse.json({ error: 'Could not send the email. Try again in a minute.' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
