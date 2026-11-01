import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { getPublicSiteUrlForEmail } from '@/lib/utils/publicSiteUrl';
import { sendEstimateReviewEmail } from '@/lib/services/emailService';

async function requireContractor() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) {
    return {
      error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }),
      user: null,
    };
  }
  return { error: null, user };
}

/**
 * POST /api/crm/estimates/[id]/send
 * Sends estimate review email to customer and marks draft estimates as sent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Estimate ID required' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim() || undefined : undefined;

    console.log('[POST /api/crm/estimates/[id]/send] start', { estimateId: id, userId: user.id });

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('pro_crm_estimates')
      .select('id, customer_id, display_id, amount_cents, status, due_date')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();
    if (error || !row) {
      console.error('[POST /api/crm/estimates/[id]/send] estimate load failed', { estimateId: id, error: error?.message });
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    if (!row.customer_id) return NextResponse.json({ error: 'Estimate has no customer' }, { status: 400 });

    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('email')
      .eq('id', row.customer_id)
      .single();
    const toEmail = customer?.email;
    if (!toEmail || typeof toEmail !== 'string') {
      console.warn('[POST /api/crm/estimates/[id]/send] customer missing email', { estimateId: id, customerId: row.customer_id });
      return NextResponse.json({ error: 'Customer has no email address' }, { status: 400 });
    }

    const { data: biz } = await supabase
      .from('businesses')
      .select('business_name')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    const businessName = biz?.business_name ?? 'Us';

    // Token insert uses service role: RLS INSERT on pro_estimate_view_tokens often fails because the
    // policy's EXISTS (…) subquery on pro_crm_estimates does not evaluate reliably under WITH CHECK.
    // Ownership is already enforced above via .eq('owner_id', user.id).
    const serviceSupabase = createServiceRoleClient();
    const { data: tokenRow, error: tokenErr } = await serviceSupabase
      .from('pro_estimate_view_tokens')
      .insert({ estimate_id: id, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
      .select('token')
      .single();
    if (tokenErr || !tokenRow) {
      console.error('[POST /api/crm/estimates/[id]/send] token insert/select failed', {
        estimateId: id,
        message: tokenErr?.message,
        code: tokenErr?.code,
        details: tokenErr?.details,
        hint: tokenErr?.hint,
      });
      return NextResponse.json(
        {
          error: 'Failed to create view token',
          details: process.env.NODE_ENV === 'development' ? tokenErr?.message : undefined,
        },
        { status: 500 }
      );
    }

    const baseUrl = getPublicSiteUrlForEmail(request);
    const locale = request.headers.get('x-next-intl-locale') || 'en';
    const reviewUrl = `${baseUrl}/${locale}/estimates/view?token=${(tokenRow as { token: string }).token}`;
    const estimateNumber = String(row.display_id ?? row.id.slice(0, 8));

    console.log('[POST /api/crm/estimates/[id]/send] sending email', { estimateId: id, toEmail });

    const emailResult = await sendEstimateReviewEmail(
      {
        businessName,
        estimateNumber,
        amountCents: row.amount_cents ?? 0,
        validUntilDate: row.due_date,
        reviewUrl,
        message,
      },
      toEmail
    );
    if (!emailResult.success) {
      console.error('[POST /api/crm/estimates/[id]/send] email failed', { estimateId: id, toEmail, error: emailResult.error });
      return NextResponse.json({ error: emailResult.error ?? 'Failed to send email' }, { status: 500 });
    }

    if (row.status === 'draft') {
      await supabase
        .from('pro_crm_estimates')
        .update({ status: 'sent' })
        .eq('id', id)
        .eq('owner_id', user.id);
    }

    console.log('[POST /api/crm/estimates/[id]/send] success', { estimateId: id, toEmail });
    return NextResponse.json({ ok: true, sentTo: toEmail });
  } catch (err) {
    console.error('POST /api/crm/estimates/[id]/send', err);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' && err instanceof Error ? err.message : undefined,
      },
      { status: 500 }
    );
  }
}
