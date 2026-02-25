import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import type { Profile } from '@/lib/types/supabase';
import { getMessages } from 'next-intl/server';
import { sendSetPasswordEmail } from '@/lib/services/emailService';
import type { SetPasswordEmailTranslations } from '@/lib/utils/emailTemplates';
import { logger } from '@/lib/utils/logger';
import crypto from 'crypto';

export interface AdminCustomerRow extends Profile {
  email: string | null;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  if (user.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    return { error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }), user: null };
  }
  return { error: null, user };
}

/**
 * GET /api/admin/customers
 * List customers (profiles with role=customer) with email from auth. Admin only.
 * Query: page, pageSize, sortBy, sortDir, search
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)));
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortDir = (searchParams.get('sortDir') || 'desc') as 'asc' | 'desc';
    const search = (searchParams.get('search') || '').trim();

    const service = createServiceRoleClient();

    // Customer user ids
    const { data: roles, error: rolesError } = await service
      .from('user_roles')
      .select('user_id')
      .eq('role', 'customer')
      .eq('is_active', true);

    if (rolesError) {
      return NextResponse.json(
        { error: 'Failed to fetch customer roles' },
        { status: 500 }
      );
    }

    const customerIds = (roles || []).map((r) => r.user_id);
    if (customerIds.length === 0) {
      return NextResponse.json({
        customers: [],
        total: 0,
        page,
        pageSize,
      });
    }

    // Profiles for customers
    let query = service
      .from('profiles')
      .select('*', { count: 'exact' })
      .in('id', customerIds);

    const validSortColumns = [
      'created_at',
      'updated_at',
      'first_name',
      'last_name',
      'city',
      'state',
      'phone',
      'referral',
    ];
    const orderColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    query = query.order(orderColumn, { ascending: sortDir === 'asc' });

    if (search) {
      // Sanitize for PostgREST .or(): avoid %, comma, quotes which break the filter
      const safe = search.replace(/[%,"\\]/g, '').trim();
      if (safe) {
        const term = `%${safe}%`;
        query = query.or(
          `first_name.ilike.${term},last_name.ilike.${term},city.ilike.${term},state.ilike.${term}`
        );
      }
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: profiles, error: profilesError, count } = await query.range(from, to);

    if (profilesError) {
      return NextResponse.json(
        { error: 'Failed to fetch profiles' },
        { status: 500 }
      );
    }

    const total = count ?? 0;

    // Addresses: signup stores address in addresses table, not profiles — use for location when profile city/state are null
    const addressMap = new Map<string, { city: string | null; state: string | null }>();
    const { data: addresses } = await service
      .from('addresses')
      .select('user_id, city, state')
      .in('user_id', customerIds);
    addresses?.forEach((a) => {
      if (a.user_id && !addressMap.has(a.user_id) && (a.city || a.state)) {
        addressMap.set(a.user_id, { city: a.city ?? null, state: a.state ?? null });
      }
    });

    // Emails from Auth Admin API (non-fatal: if this fails, still return profiles with email null)
    const emailMap = new Map<string, string>();
    try {
      let pageNum = 1;
      const perPage = 1000;
      while (true) {
        const { data, error } = await service.auth.admin.listUsers({
          page: pageNum,
          perPage,
        });
        if (error || !data?.users?.length) break;
        for (const u of data.users) {
          if (u.email) emailMap.set(u.id, u.email);
        }
        if (data.users.length < perPage) break;
        pageNum++;
      }
    } catch {
      // Continue without emails; table still loads
    }

    const customers: AdminCustomerRow[] = (profiles || []).map((p) => {
      const fromAddress = addressMap.get(p.id);
      const city = p.city ?? fromAddress?.city ?? null;
      const state = p.state ?? fromAddress?.state ?? null;
      return {
        ...p,
        city,
        state,
        email: emailMap.get(p.id) ?? null,
      };
    });

    return NextResponse.json({
      customers,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('GET /api/admin/customers', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate a secure random password for admin-created users (never sent to user)
 */
function generateRandomPassword(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * POST /api/admin/customers
 * Create a new customer (user + profile + address + customer role). Admin only.
 * Sends a "set your password" email with a one-time link; no password in email.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const body = await request.json();
    const {
      email,
      firstName,
      lastName,
      phone,
      referral,
      userPicture,
      streetAddress,
      apartment,
      city,
      state,
      zipCode,
    } = body;

    const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

    if (!trim(email)) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!trim(firstName)) {
      return NextResponse.json({ error: 'First name is required' }, { status: 400 });
    }
    if (!trim(lastName)) {
      return NextResponse.json({ error: 'Last name is required' }, { status: 400 });
    }

    const service = createServiceRoleClient();
    const normalizedEmail = String(email).trim().toLowerCase();
    const randomPassword = generateRandomPassword();

    const { data: authData, error: createError } = await service.auth.admin.createUser({
      email: normalizedEmail,
      password: randomPassword,
      email_confirm: true,
      user_metadata: {
        firstName: trim(firstName),
        lastName: trim(lastName),
        email: normalizedEmail,
      },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message || 'Failed to create user' }, { status: 400 });
    }
    if (!authData?.user?.id) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    const userId = authData.user.id;

    const { error: profileError } = await service
      .from('profiles')
      .upsert(
        {
          id: userId,
          first_name: trim(firstName),
          last_name: trim(lastName),
          phone: trim(phone) || null,
          referral: trim(referral) || null,
          user_picture: trim(userPicture) || null,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
    }

    const hasAddress = !!(trim(streetAddress) || trim(city) || trim(state) || trim(zipCode));
    if (hasAddress) {
      await service.from('addresses').insert({
        user_id: userId,
        address_type: 'personal',
        street_address: trim(streetAddress) || null,
        apartment: trim(apartment) || null,
        city: trim(city) || null,
        state: trim(state) || null,
        zip_code: trim(zipCode) || null,
        is_public: false,
        is_verified: false,
      });
    }

    const { error: roleError } = await service.from('user_roles').insert({
      user_id: userId,
      role: 'customer',
      is_active: true,
      activated_at: new Date().toISOString(),
    });

    if (roleError && roleError.code !== '23505') {
      return NextResponse.json({ error: 'Failed to assign customer role' }, { status: 500 });
    }

    // Generate "set your password" link and send email (no password in email)
    try {
      const requestUrl = new URL(request.url);
      const origin = requestUrl.origin;
      const locale = 'en';
      const redirectTo = `${origin}/${locale}/reset-password`;

      const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
        type: 'recovery',
        email: normalizedEmail,
        options: { redirectTo },
      });

      if (linkError || !linkData?.properties?.action_link) {
        logger.warn('Failed to generate set-password link', {
          endpoint: 'POST /api/admin/customers',
          userId,
          email: normalizedEmail,
          error: linkError?.message,
        });
      } else {
        const actionLink = linkData.properties.action_link;
        const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
        const setPasswordLink = actionLink.startsWith('http')
          ? actionLink
          : `${supabaseUrl}/${actionLink.replace(/^\//, '')}`;

        const messages = await getMessages({ locale });
        const setPasswordMessages = messages?.auth?.setPasswordEmail as Record<string, unknown> | undefined;
        const footerMessages = (setPasswordMessages as Record<string, Record<string, string>>)?.footer;

        const emailTranslations: SetPasswordEmailTranslations = {
          subject: (setPasswordMessages?.subject as string) || 'Set your password – House Pros Hub',
          greeting: (setPasswordMessages?.greeting as string) || 'Hello',
          body: (setPasswordMessages?.body as string) || 'Your House Pros Hub account has been created. Click the button below to set your password and sign in.',
          cta: (setPasswordMessages?.cta as string) || 'Set your password',
          footer: {
            companyName: footerMessages?.companyName || 'House Pros Hub',
            contactInfo: footerMessages?.contactInfo || 'If you have any questions, please contact us.',
            unsubscribe: footerMessages?.unsubscribe || 'You are receiving this email because an account was created for you on House Pros Hub.',
          },
        };

        const emailResult = await sendSetPasswordEmail(
          trim(firstName),
          normalizedEmail,
          setPasswordLink,
          emailTranslations
        );
        if (!emailResult.success) {
          logger.warn('Failed to send set-password email', {
            endpoint: 'POST /api/admin/customers',
            userId,
            email: normalizedEmail,
            error: emailResult.error,
          });
        }
      }
    } catch (emailErr) {
      logger.error('Error sending set-password email', {
        endpoint: 'POST /api/admin/customers',
        userId,
        email: normalizedEmail,
      }, emailErr as Error);
      // Don't fail creation – user can use "Forgot password" later
    }

    return NextResponse.json({ id: userId, email: normalizedEmail }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/customers', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
