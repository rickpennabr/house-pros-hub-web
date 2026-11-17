import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Business id for the signed-in pro.
 * Prefers profile.business_id when they own that business; otherwise any business they own.
 */
export async function getOwnedBusinessId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', userId)
    .maybeSingle();

  const preferredId = (profile as { business_id?: string | null } | null)?.business_id ?? null;
  const service = createServiceRoleClient();

  if (preferredId) {
    const { data: preferred } = await service
      .from('businesses')
      .select('id')
      .eq('id', preferredId)
      .eq('owner_id', userId)
      .maybeSingle();
    if (preferred?.id) return preferred.id;
  }

  const { data: owned } = await service
    .from('businesses')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .maybeSingle();

  return owned?.id ?? null;
}
