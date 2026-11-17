import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import type { CrmDb } from '@/lib/crm/crm-scope';

const acceptSchema = z.object({
  token: z.string().trim().min(16).max(128),
});

type CrewInviteRow = {
  id: string;
  email: string;
  status: string;
  owner_id: string;
  business_id: string;
  display_name: string;
};

/**
 * POST /api/crm/maintenance/crew/accept
 * Signed-in user accepts a crew invitation token.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await createClient();
    const {
      data: { user },
      error: authError,
    } = await session.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Sign in to accept the invite' }, { status: 401 });
    }

    const parsed = acceptSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid invite token' }, { status: 400 });
    }

    const service = createServiceRoleClient() as CrmDb;
    const { data: invite } = await service
      .from('business_crew_members')
      .select('id, email, status, owner_id, business_id, display_name')
      .eq('invite_token', parsed.data.token)
      .maybeSingle();

    const row = invite as CrewInviteRow | null;
    if (!row) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }
    if (row.status === 'disabled') {
      return NextResponse.json({ error: 'Invite was disabled' }, { status: 400 });
    }

    const userEmail = (user.email ?? '').toLowerCase().trim();
    if (userEmail && userEmail !== row.email.toLowerCase()) {
      return NextResponse.json(
        { error: `Sign in with ${row.email} to accept this invite` },
        { status: 403 }
      );
    }

    const { data: updated, error: updateError } = await service
      .from('business_crew_members')
      .update({
        user_id: user.id,
        status: 'active',
        accepted_at: new Date().toISOString(),
        invite_token: null,
      })
      .eq('id', row.id)
      .select('id, email, display_name, member_role, status, business_id')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message ?? 'Could not accept invite' }, { status: 500 });
    }

    return NextResponse.json({
      crew: {
        id: updated.id,
        email: updated.email,
        displayName: updated.display_name,
        memberRole: updated.member_role,
        status: updated.status,
        businessId: updated.business_id,
      },
    });
  } catch (error) {
    console.error('POST /api/crm/maintenance/crew/accept', error);
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
  }
}
