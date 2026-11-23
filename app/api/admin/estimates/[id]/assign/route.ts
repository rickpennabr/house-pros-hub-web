import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/blog/admin';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  LEAD_ESTIMATE_COLUMNS,
  leadChatText,
  leadOfferCard,
  proProbotConversation,
  sendLeadOfferEmail,
  siteOrigin,
  markLeadMessageRead,
  updateLeadCard,
  userLocale,
  type LeadEstimate,
} from '@/lib/leads/referrals';
import type { Json } from '@/lib/types/supabase';

const bodySchema = z.object({ businessId: z.string().uuid() });

type Admin = ReturnType<typeof createServiceRoleClient>;

/** Cancel the open offer on this request (the pro's card then says it went to someone else). */
async function cancelOpenOffer(admin: Admin, estimateId: string): Promise<void> {
  const { data: open } = await admin
    .from('lead_referrals')
    .update({ status: 'cancelled', responded_at: new Date().toISOString() })
    .eq('estimate_id', estimateId)
    .eq('status', 'offered')
    .select('id, message_id');
  for (const row of open ?? []) {
    await updateLeadCard(admin, row.message_id, { status: 'cancelled' });
    await markLeadMessageRead(admin, row.message_id);
  }
}

/**
 * POST /api/admin/estimates/[id]/assign  { businessId }
 * Send this request to one pro: ProBot card (lights their bell) and an email, job details only.
 * An offer still waiting on another pro is cancelled first.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAdmin();
  if (error || !user) return error;
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const [{ data: estimate }, { data: business }] = await Promise.all([
    admin.from('estimates').select(LEAD_ESTIMATE_COLUMNS).eq('id', id).maybeSingle(),
    admin.from('businesses').select('id, owner_id, business_name, email, is_active').eq('id', parsed.data.businessId).maybeSingle(),
  ]);
  if (!estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
  if (!business || !business.is_active) return NextResponse.json({ error: 'Pro not found' }, { status: 404 });

  const { data: already } = await admin
    .from('lead_referrals')
    .select('id')
    .eq('estimate_id', id)
    .eq('business_id', business.id)
    .eq('status', 'accepted')
    .limit(1)
    .maybeSingle();
  if (already) return NextResponse.json({ error: `${business.business_name} already added this customer to their CRM.` }, { status: 409 });

  await cancelOpenOffer(admin, id);

  const { data: referral, error: insertError } = await admin
    .from('lead_referrals')
    .insert({ estimate_id: id, business_id: business.id, owner_id: business.owner_id, assigned_by: user.id })
    .select('id, created_at')
    .single();
  if (insertError || !referral) {
    console.error('[assign] insert', insertError?.message);
    return NextResponse.json({ error: 'Could not assign this request. Try again.' }, { status: 500 });
  }

  const proLocale = await userLocale(admin, business.owner_id);
  const card = leadOfferCard(estimate as LeadEstimate, referral.id, proLocale);
  try {
    const conversationId = await proProbotConversation(admin, business.owner_id);
    const { data: message, error: messageError } = await admin
      .from('probot_messages')
      .insert({
        conversation_id: conversationId,
        sender: 'admin',
        admin_sent_as: 'probot',
        body: leadChatText(card, proLocale),
        payload: { leadOffer: card } as unknown as Json,
      })
      .select('id')
      .single();
    if (messageError || !message) throw new Error(messageError?.message || 'message insert failed');
    await Promise.all([
      admin.from('lead_referrals').update({ message_id: message.id }).eq('id', referral.id),
      admin.from('probot_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId),
    ]);
  } catch (err) {
    // Without the ProBot card the pro cannot accept: undo the offer.
    console.error('[assign] probot card', err instanceof Error ? err.message : err);
    await admin.from('lead_referrals').delete().eq('id', referral.id);
    return NextResponse.json({ error: 'Could not message the pro. Try again.' }, { status: 500 });
  }

  const { data: owner } = await admin.auth.admin.getUserById(business.owner_id);
  const to = owner?.user?.email || business.email;
  if (to) await sendLeadOfferEmail(to, business.business_name, card, siteOrigin(request.nextUrl.origin), proLocale);

  return NextResponse.json({
    assignment: { referralId: referral.id, businessId: business.id, businessName: business.business_name, status: 'offered', at: referral.created_at },
  });
}

/** DELETE /api/admin/estimates/[id]/assign: take back an offer the pro has not answered. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  await cancelOpenOffer(createServiceRoleClient(), id);
  return NextResponse.json({ ok: true });
}
