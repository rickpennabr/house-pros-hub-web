import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { getPublicSiteUrlForEmail } from '@/lib/utils/publicSiteUrl';

/**
 * POST /api/crm/estimates/[id]/share-link
 * Create a customer view link for chat (no email required). Draft estimates become sent.
 * Returns card fields so ProBot can render an in-chat approve flow.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Estimate ID required' }, { status: 400 });

    const { data: estimate, error } = await supabase
      .from('pro_crm_estimates')
      .select('id, status, amount_cents, deposit_cents, display_id, due_date, line_items')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();
    if (error || !estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    if (estimate.status === 'declined') {
      return NextResponse.json({ error: 'This estimate was declined' }, { status: 400 });
    }

    if (estimate.status === 'draft') {
      const { error: statusError } = await supabase
        .from('pro_crm_estimates')
        .update({ status: 'sent' })
        .eq('id', id)
        .eq('owner_id', user.id);
      if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 });
    }

    const service = createServiceRoleClient();
    const { data: tokenRow, error: tokenError } = await service
      .from('pro_estimate_view_tokens')
      .insert({
        estimate_id: id,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('token')
      .single();
    if (tokenError || !tokenRow) {
      return NextResponse.json({ error: 'Failed to create estimate link' }, { status: 500 });
    }

    const { data: biz } = await supabase
      .from('businesses')
      .select('business_name, business_logo')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    const businessName = biz?.business_name ?? null;
    const businessLogo = biz?.business_logo ?? null;

    const lineItems = Array.isArray(estimate.line_items) ? estimate.line_items : [];
    const lineItemsPreview = lineItems
      .flatMap((line) => {
        if (!line || typeof line !== 'object' || Array.isArray(line)) return [];
        const row = line as {
          product_or_service?: unknown;
          description?: unknown;
          amount_cents?: unknown;
        };
        return [
          {
            product_or_service: typeof row.product_or_service === 'string' ? row.product_or_service : null,
            description: typeof row.description === 'string' ? row.description : null,
            amount_cents: typeof row.amount_cents === 'number' ? row.amount_cents : null,
          },
        ];
      })
      .slice(0, 4);

    const baseUrl = getPublicSiteUrlForEmail(request);
    const locale = request.headers.get('x-next-intl-locale') || 'en';
    const token = tokenRow.token as string;
    const url = `${baseUrl}/${locale}/estimates/view?token=${token}`;
    const label = String(estimate.display_id ?? id.slice(0, 8));

    return NextResponse.json({
      url,
      token,
      label,
      estimateId: estimate.id,
      amountCents: estimate.amount_cents ?? 0,
      depositCents: estimate.deposit_cents ?? 0,
      status: estimate.status === 'draft' ? 'sent' : estimate.status,
      validUntilDate: estimate.due_date,
      businessName,
      businessLogo,
      lineItemsPreview,
    });
  } catch (err) {
    console.error('POST /api/crm/estimates/[id]/share-link', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
