import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendEstimateApprovalNotificationEmails } from '@/lib/services/emailService';

/**
 * POST /api/estimates/public/approve
 * Approves an estimate using a valid public token. No auth required.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('pro_estimate_view_tokens')
      .select('estimate_id, expires_at')
      .eq('token', token)
      .single();

    if (tokenErr || !tokenRow) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 404 });
    }

    const { data: estimate, error: estimateErr } = await supabase
      .from('pro_crm_estimates')
      .select('id, status, display_id, amount_cents, owner_id, customer_id')
      .eq('id', tokenRow.estimate_id)
      .single();
    if (estimateErr || !estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    if (estimate.status === 'accepted') {
      return NextResponse.json({ ok: true, status: 'already_accepted' });
    }
    if (estimate.status === 'declined') {
      return NextResponse.json({ error: 'This estimate is no longer available for approval' }, { status: 400 });
    }

    const { error: updateErr } = await supabase
      .from('pro_crm_estimates')
      .update({ status: 'accepted' })
      .eq('id', estimate.id);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message || 'Failed to approve estimate' }, { status: 500 });
    }

    const estimateNumber = String(estimate.display_id ?? estimate.id.slice(0, 8));

    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('first_name, last_name, email')
      .eq('id', estimate.customer_id)
      .single();

    const customerName =
      [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim() || 'Customer';
    const customerEmail =
      typeof customer?.email === 'string' && customer.email.trim() ? customer.email.trim() : null;

    const { data: biz } = await supabase
      .from('businesses')
      .select('business_name, email')
      .eq('owner_id', estimate.owner_id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    const businessName = biz?.business_name ?? 'Your contractor';

    let contractorEmail: string | null = null;
    const { data: ownerUser, error: ownerErr } = await supabase.auth.admin.getUserById(estimate.owner_id);
    if (!ownerErr && ownerUser?.user?.email) {
      contractorEmail = ownerUser.user.email.trim();
    }
    if (!contractorEmail && typeof biz?.email === 'string' && biz.email.trim()) {
      contractorEmail = biz.email.trim();
    }

    void sendEstimateApprovalNotificationEmails({
      businessName,
      estimateNumber,
      amountCents: estimate.amount_cents ?? 0,
      customerName,
      customerEmail,
      contractorEmail,
    }).catch((e) => console.error('[POST /api/estimates/public/approve] approval emails failed', e));

    return NextResponse.json({ ok: true, status: 'approved' });
  } catch (err) {
    console.error('POST /api/estimates/public/approve', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
