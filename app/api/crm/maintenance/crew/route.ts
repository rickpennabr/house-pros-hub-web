import { NextRequest, NextResponse } from 'next/server';
import { loadInvoiceEmailBranding } from '@/lib/invoices/reminder';
import { brandedEmail, hubEmailBrand } from '@/lib/email/branded-layout';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { getResendClient, getResendFromEmail } from '@/lib/utils/resend';

const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  displayName: z.string().trim().min(1).max(120),
  memberRole: z.enum(['crew', 'lead']).optional(),
  contactId: z.string().uuid().nullable().optional(),
});

/**
 * GET /api/crm/maintenance/crew
 * List crew members for the business.
 */
export async function GET() {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;

    const { data, error: queryError } = await scope.supabase
      .from('business_crew_members')
      .select('id, email, display_name, member_role, status, user_id, contact_id, invited_at, accepted_at')
      .eq('owner_id', scope.ownerId)
      .neq('status', 'disabled')
      .order('display_name', { ascending: true });

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    return NextResponse.json({
      crew: (data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        memberRole: row.member_role,
        status: row.status,
        userId: row.user_id,
        contactId: row.contact_id,
        invitedAt: row.invited_at,
        acceptedAt: row.accepted_at,
      })),
    });
  } catch (error) {
    console.error('GET /api/crm/maintenance/crew', error);
    return NextResponse.json({ error: 'Failed to load crew' }, { status: 500 });
  }
}

/**
 * POST /api/crm/maintenance/crew
 * Owner invites a crew member by email to use House Pros Hub.
 */
export async function POST(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    if (scope.isCrew) {
      return NextResponse.json({ error: 'Only the business owner can invite crew' }, { status: 403 });
    }
    if (!scope.businessId) {
      return NextResponse.json({ error: 'Add a business before inviting crew' }, { status: 400 });
    }

    const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid invite' }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    const inviteToken = randomBytes(24).toString('hex');

    const { data: existing } = await scope.supabase
      .from('business_crew_members')
      .select('id, status')
      .eq('business_id', scope.businessId)
      .ilike('email', email)
      .maybeSingle();

    let memberId = existing?.id ?? null;
    if (existing) {
      const { data: updated, error: updateError } = await scope.supabase
        .from('business_crew_members')
        .update({
          display_name: parsed.data.displayName,
          member_role: parsed.data.memberRole ?? 'crew',
          contact_id: parsed.data.contactId ?? null,
          status: 'invited',
          invite_token: inviteToken,
          invited_at: new Date().toISOString(),
          accepted_at: null,
          user_id: null,
        })
        .eq('id', existing.id)
        .select('id, email, display_name, member_role, status, user_id, contact_id, invited_at, accepted_at')
        .single();
      if (updateError || !updated) {
        return NextResponse.json({ error: updateError?.message ?? 'Could not update invite' }, { status: 500 });
      }
      memberId = updated.id;
    } else {
      const { data: created, error: insertError } = await scope.supabase
        .from('business_crew_members')
        .insert({
          business_id: scope.businessId,
          owner_id: scope.ownerId,
          email,
          display_name: parsed.data.displayName,
          member_role: parsed.data.memberRole ?? 'crew',
          contact_id: parsed.data.contactId ?? null,
          status: 'invited',
          invite_token: inviteToken,
        })
        .select('id, email, display_name, member_role, status, user_id, contact_id, invited_at, accepted_at')
        .single();
      if (insertError || !created) {
        return NextResponse.json({ error: insertError?.message ?? 'Could not create invite' }, { status: 500 });
      }
      memberId = created.id;
    }

    const origin = request.nextUrl.origin;
    const locale = request.cookies.get('NEXT_LOCALE')?.value || 'en';
    const acceptUrl = `${origin}/${locale}/crew-invite?token=${inviteToken}`;

    try {
      const resend = getResendClient();
      const fromEmail = getResendFromEmail();
      const brand = await loadInvoiceEmailBranding(scope.supabase as never, scope.ownerId, scope.businessId ?? null, null).catch(() => null);
      const businessName = brand?.businessName || 'House Pros Hub';

      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: `${businessName} invited you to the crew`,
        ...(brand?.businessEmail ? { replyTo: brand.businessEmail } : {}),
        html: brandedEmail({
          brand: brand ?? hubEmailBrand(),
          heading: 'You are invited to the crew',
          subheading: businessName,
          paragraphs: [
            `Hi ${parsed.data.displayName},`,
            `${businessName} invited you to join their maintenance crew on House Pros Hub.`,
            'After you accept, sign in to see your visits, check in on site and add photos.',
          ],
          button: { label: 'Accept invitation', url: acceptUrl },
        }),
      });
    } catch (emailError) {
      console.error('crew invite email', emailError);
    }

    const { data: member } = await scope.supabase
      .from('business_crew_members')
      .select('id, email, display_name, member_role, status, user_id, contact_id, invited_at, accepted_at')
      .eq('id', memberId!)
      .single();

    return NextResponse.json(
      {
        crew: {
          id: member!.id,
          email: member!.email,
          displayName: member!.display_name,
          memberRole: member!.member_role,
          status: member!.status,
          userId: member!.user_id,
          contactId: member!.contact_id,
          invitedAt: member!.invited_at,
          acceptedAt: member!.accepted_at,
        },
        inviteUrl: acceptUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/crm/maintenance/crew', error);
    return NextResponse.json({ error: 'Failed to invite crew' }, { status: 500 });
  }
}
