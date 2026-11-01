import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Business id on the signed-in user's profile, only when that user owns it.
 * Profile.business_id is a preference, not proof of access.
 */
export async function getOwnedBusinessId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', userId)
    .maybeSingle();

  const businessId = (profile as { business_id?: string | null } | null)?.business_id ?? null;
  if (!businessId) return null;

  const service = createServiceRoleClient();
  const { data: business } = await service
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('owner_id', userId)
    .maybeSingle();

  return business?.id ?? null;
}
