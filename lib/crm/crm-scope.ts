import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { userOwnsCrm } from '@/lib/crm/require-contractor';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

/** Untyped client until maintenance / crew tables are regenerated into supabase.ts. */
export type CrmDb = SupabaseClient<any>;

export type CrmScope = {
  user: User;
  /** Auth user making the request. */
  actorId: string;
  /** Owner whose CRM rows to read/write (business owner for crew). */
  ownerId: string;
  businessId: string | null;
  isCrew: boolean;
  crewMemberId: string | null;
  supabase: CrmDb;
};

/**
 * Resolve CRM data owner for the signed-in user.
 * Business owners use their own id. Active crew members act under the inviting owner.
 */
export async function requireCrmScope(): Promise<
  { error: NextResponse; scope: null } | { error: null; scope: CrmScope }
> {
  const session = await createClient();
  const {
    data: { user },
    error,
  } = await session.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), scope: null };
  }

  const service = createServiceRoleClient() as CrmDb;
  const canOwnCrm = await userOwnsCrm(user.id);

  if (canOwnCrm) {
    const { data: business } = await service
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle();

    return {
      error: null,
      scope: {
        user,
        actorId: user.id,
        ownerId: user.id,
        businessId: business?.id ?? null,
        isCrew: false,
        crewMemberId: null,
        supabase: service,
      },
    };
  }

  const { data: crew } = await service
    .from('business_crew_members')
    .select('id, owner_id, business_id, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!crew) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), scope: null };
  }

  return {
    error: null,
    scope: {
      user,
      actorId: user.id,
      ownerId: crew.owner_id as string,
      businessId: (crew.business_id as string | null) ?? null,
      isCrew: true,
      crewMemberId: crew.id as string,
      supabase: service,
    },
  };
}
