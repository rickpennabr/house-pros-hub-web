import { randomBytes } from 'crypto';
import { hashAgentKey, type AgentApp } from '@/lib/agent/auth';
import { PROAGENT_APP_NAME } from '@/lib/agent/constants';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * The in-chat agent files estimates under a reserved app row.
 * The raw key is discarded. Outside agents keep using keys from Admin → Agent apps.
 */
export async function ensureProAgentApp(): Promise<AgentApp | null> {
  const supabase = createServiceRoleClient();
  const { data: existing, error: readError } = await supabase
    .from('agent_apps')
    .select('id, name')
    .eq('name', PROAGENT_APP_NAME)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();
  if (readError) {
    console.error('ProAgent app lookup failed:', readError.message);
    return null;
  }
  if (existing) return { id: existing.id, name: existing.name };

  const { data: inserted, error } = await supabase
    .from('agent_apps')
    .insert({
      name: PROAGENT_APP_NAME,
      key_prefix: 'hph_proagent',
      key_hash: hashAgentKey(`hph_proagent_${randomBytes(32).toString('hex')}`),
    })
    .select('id, name')
    .single();
  if (!error && inserted) return { id: inserted.id, name: inserted.name };
  if (error?.code === '23505') {
    const { data: raced } = await supabase
      .from('agent_apps')
      .select('id, name')
      .eq('name', PROAGENT_APP_NAME)
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle();
    if (raced) return { id: raced.id, name: raced.name };
  }
  console.error('ProAgent app insert failed:', error?.message);
  return null;
}
