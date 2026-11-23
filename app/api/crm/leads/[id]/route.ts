import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { addProProperty } from '@/lib/places/contact-places';
import { autoNickname } from '@/lib/places/auto-nickname';
import {
  LEAD_ESTIMATE_COLUMNS,
  leadNote,
  markLeadMessageRead,
  notifyAdminOfLead,
  sendCustomerIntroEmail,
  updateLeadCard,
  userLocale,
  type LeadEstimate,
} from '@/lib/leads/referrals';

const bodySchema = z.object({ action: z.enum(['accept', 'decline']) });

/** Last 10 digits, so "(702) 555-0100" and "+1 702-555-0100" match. */
function phoneDigits(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

function sameText(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? '').trim().toLowerCase() === (right ?? '').trim().toLowerCase();
}

/**
 * POST /api/crm/leads/[id]  { action: 'accept' | 'decline' }
 * The pro answers a job request the admin sent them (lead_referrals). Accept adds the customer to
 * the CRM (or merges into the contact with the same email or phone), saves the request as a note,
 * and emails the customer who will contact them. Decline tells the admin to pick another pro.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: scopeError, scope } = await requireCrmScope();
    if (scopeError) return scopeError;
    if (scope.isCrew) return NextResponse.json({ error: 'Only the business owner can add customers.' }, { status: 403 });

    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || !z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const { data: referral } = await admin
      .from('lead_referrals')
      .select('id, estimate_id, business_id, owner_id, status, message_id, crm_customer_id, expires_at')
      .eq('id', id)
      .maybeSingle();
    if (!referral || referral.owner_id !== scope.ownerId) return NextResponse.json({ error: 'Job request not found' }, { status: 404 });

    if (referral.status === 'accepted' && referral.crm_customer_id) {
      return NextResponse.json({ status: 'accepted', customerId: referral.crm_customer_id });
    }
    // Past its 48 hours but the hourly cron has not run yet: expire it now.
    if (referral.status === 'offered' && new Date(referral.expires_at).getTime() <= Date.now()) {
      const { data: expired } = await admin
        .from('lead_referrals')
        .update({ status: 'expired', responded_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'offered')
        .select('id');
      if (expired?.length) {
        await updateLeadCard(admin, referral.message_id, { status: 'expired' });
        await markLeadMessageRead(admin, referral.message_id);
        await notifyAdminOfLead(admin, referral, 'lead_expired');
      }
      referral.status = 'expired';
    }
    if (referral.status !== 'offered') {
      const message =
        referral.status === 'cancelled'
          ? 'This job request was sent to another pro.'
          : referral.status === 'expired'
            ? 'This job request expired.'
            : 'You already declined this job request.';
      return NextResponse.json({ error: message, status: referral.status }, { status: 409 });
    }

    const now = new Date().toISOString();

    if (parsed.data.action === 'decline') {
      const { data: declined } = await admin
        .from('lead_referrals')
        .update({ status: 'declined', responded_at: now })
        .eq('id', id)
        .eq('status', 'offered')
        .select('id');
      if (!declined?.length) return NextResponse.json({ error: 'This job request is no longer open.' }, { status: 409 });
      await updateLeadCard(admin, referral.message_id, { status: 'declined' });
      await markLeadMessageRead(admin, referral.message_id);
      await notifyAdminOfLead(admin, referral, 'lead_declined');
      return NextResponse.json({ status: 'declined' });
    }

    // Claim it first so two taps (or a reassign at the same moment) cannot both win.
    const { data: claimed } = await admin
      .from('lead_referrals')
      .update({ status: 'accepted', responded_at: now })
      .eq('id', id)
      .eq('status', 'offered')
      .select('id');
    if (!claimed?.length) return NextResponse.json({ error: 'This job request is no longer open.' }, { status: 409 });

    const release = async () => {
      await admin.from('lead_referrals').update({ status: 'offered', responded_at: null }).eq('id', id).eq('status', 'accepted');
    };

    const { data: estimateRow } = await admin.from('estimates').select(LEAD_ESTIMATE_COLUMNS).eq('id', referral.estimate_id).maybeSingle();
    if (!estimateRow) {
      await release();
      return NextResponse.json({ error: 'The customer removed this request.' }, { status: 404 });
    }
    const estimate = estimateRow as LeadEstimate;
    const note = leadNote(estimate, await userLocale(admin, scope.ownerId));

    // Same person already in this CRM: same email, else same phone.
    const { data: contacts } = await admin
      .from('pro_crm_customers')
      .select('id, email, phone, notes, street_address, city, zip_code')
      .eq('owner_id', scope.ownerId)
      .order('created_at', { ascending: true });
    const email = estimate.email.trim().toLowerCase();
    const phone = phoneDigits(estimate.phone);
    const match =
      (email ? contacts?.find((row) => sameText(row.email, email)) : undefined) ??
      (phone ? contacts?.find((row) => phoneDigits(row.phone) === phone) : undefined);

    let customerId: string;
    try {
      if (match) {
        customerId = match.id;
        const notes = [match.notes?.trim(), note].filter(Boolean).join('\n\n').slice(0, 10000);
        const { error } = await admin.from('pro_crm_customers').update({ notes }).eq('id', match.id);
        if (error) throw new Error(error.message);
        // A different house than the one on file: add it to the contact's properties.
        const sameHouse = sameText(match.street_address, estimate.street_address) && sameText(match.zip_code, estimate.zip_code);
        if (!sameHouse && estimate.street_address.trim()) {
          const street = [estimate.street_address.trim(), estimate.apartment?.trim()].filter(Boolean).join(' ');
          await addProProperty(admin, {
            customerId: match.id,
            ownerId: scope.ownerId,
            input: {
              name: autoNickname(street, 'house').slice(0, 120) || 'Property',
              kind: 'house',
              street,
              city: estimate.city || null,
              state: estimate.state || null,
              zipCode: estimate.zip_code || null,
            },
          }).catch((err) => console.error('[leads] add property', err instanceof Error ? err.message : err));
        }
      } else {
        const { data: created, error } = await admin
          .from('pro_crm_customers')
          .insert({
            owner_id: scope.ownerId,
            first_name: estimate.first_name.trim() || 'Customer',
            last_name: estimate.last_name.trim(),
            email: estimate.email.trim() || null,
            phone: estimate.phone.trim() || null,
            street_address: estimate.street_address.trim() || null,
            apartment: estimate.apartment?.trim() || null,
            city: estimate.city || null,
            state: estimate.state || null,
            zip_code: estimate.zip_code || null,
            notes: note,
          })
          .select('id')
          .single();
        if (error || !created) throw new Error(error?.message || 'insert failed');
        customerId = created.id;
      }
    } catch (err) {
      console.error('[leads] accept', err instanceof Error ? err.message : err);
      await release();
      return NextResponse.json({ error: 'Could not add the customer. Try again.' }, { status: 500 });
    }

    const customerName = `${estimate.first_name} ${estimate.last_name}`.trim();
    await Promise.all([
      admin.from('lead_referrals').update({ crm_customer_id: customerId }).eq('id', id),
      updateLeadCard(admin, referral.message_id, { status: 'accepted', crmCustomerId: customerId, customerName }),
      markLeadMessageRead(admin, referral.message_id),
      notifyAdminOfLead(admin, referral, 'lead_accepted'),
    ]);

    const { data: business } = await admin
      .from('businesses')
      .select('business_name, phone, mobile_phone, email')
      .eq('id', referral.business_id)
      .maybeSingle();
    if (business && estimate.email.trim()) {
      await sendCustomerIntroEmail(
        estimate.email.trim(),
        estimate.first_name.trim(),
        { name: business.business_name, phone: business.mobile_phone || business.phone, email: business.email },
        estimate,
        await userLocale(admin, estimate.user_id)
      );
    }

    return NextResponse.json({ status: 'accepted', customerId, customerName, merged: Boolean(match) });
  } catch (err) {
    console.error('POST /api/crm/leads/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
