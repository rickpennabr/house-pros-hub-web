import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import type { CrmDb } from '@/lib/crm/crm-scope';
import { loadProbotSettingsFor, probotSettingsSchema, settingsToRow } from '@/lib/probot/settings';

const SETUP_ERROR = 'Run migration 172_probot_brief_week2.sql in Supabase to save these settings.';

/** GET — this pro's morning brief settings (defaults when none saved). */
export async function GET() {
  const { error: authError, user } = await requireContractor();
  if (authError || !user) return authError!;
  return NextResponse.json({ settings: await loadProbotSettingsFor(user.id) });
}

/** PUT { settings } — save them. */
export async function PUT(request: NextRequest) {
  const { error: authError, user } = await requireContractor();
  if (authError || !user) return authError!;
  const body = (await request.json().catch(() => null)) as { settings?: unknown } | null;
  const parsed = probotSettingsSchema.safeParse(body?.settings);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid settings' }, { status: 400 });
  const supabase = (await createClient()) as unknown as CrmDb;
  const { error } = await supabase.from('pro_probot_settings').upsert(settingsToRow(user.id, parsed.data), { onConflict: 'owner_id' });
  if (error) {
    const missing = /pro_probot_settings|schema cache|does not exist/i.test(error.message);
    return NextResponse.json({ error: missing ? SETUP_ERROR : error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: parsed.data });
}
