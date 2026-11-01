import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';

export async function requireInstaller(): Promise<
  | { error: NextResponse; user: null; supabase: null }
  | { error: null; user: { id: string; email?: string }; supabase: SupabaseClient<Database> }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      error: NextResponse.json({ error: 'installer_required' }, { status: 401 }),
      user: null,
      supabase: null,
    };
  }
  const allowed = await hasRole(user.id, 'installer');
  if (!allowed) {
    return {
      error: NextResponse.json({ error: 'installer_required' }, { status: 403 }),
      user: null,
      supabase: null,
    };
  }
  return { error: null, user, supabase };
}
