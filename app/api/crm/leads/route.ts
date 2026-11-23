import { NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { listOpenLeads } from '@/lib/leads/referrals';

/**
 * GET /api/crm/leads
 * Job requests the admin sent this business that still wait for an answer (owner only; crew see none).
 * Feeds the Contacts "pending approval" list and the badge on the Contacts menu item.
 */
export async function GET() {
  try {
    const { error: scopeError, scope } = await requireCrmScope();
    if (scopeError) return scopeError;
    if (scope.isCrew) return NextResponse.json({ leads: [] });
    const leads = await listOpenLeads(createServiceRoleClient(), scope.ownerId);
    return NextResponse.json({ leads }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('GET /api/crm/leads', err);
    return NextResponse.json({ leads: [] });
  }
}
