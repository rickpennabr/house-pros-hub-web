import { NextResponse } from 'next/server';
import { requireContractor, userOwnsCrm } from '@/lib/crm/require-contractor';
import { runMorningForPro } from '@/lib/probot/morning';

/**
 * POST /api/crm/probot/morning — post this pro's morning brief and cards now (no 6:30 wait).
 * Cards already open are not repeated, so running it twice does not double them.
 */
export async function POST() {
  const { error: authError, user } = await requireContractor();
  if (authError || !user) return authError!;
  if (!(await userOwnsCrm(user.id))) return NextResponse.json({ error: 'Only the CRM owner gets the brief.' }, { status: 403 });
  try {
    const result = await runMorningForPro(user.id, { force: true });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not build the brief';
    const setup = /probot_followups|probot_morning_runs|schema cache|does not exist/i.test(message);
    return NextResponse.json({ error: setup ? 'Run migration 171_probot_followups.sql in Supabase first.' : message }, { status: 500 });
  }
}
