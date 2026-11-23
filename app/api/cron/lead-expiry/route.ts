import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { markLeadMessageRead, notifyAdminOfLead, updateLeadCard } from '@/lib/leads/referrals';

/**
 * GET /api/cron/lead-expiry
 * Job requests a pro did not answer within 48 hours expire: the pro's ProBot card says so and
 * the admin bell asks for another pro. Schedule hourly. Authorize with CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const { data: expired, error } = await admin
    .from('lead_referrals')
    .update({ status: 'expired', responded_at: new Date().toISOString() })
    .eq('status', 'offered')
    .lte('expires_at', new Date().toISOString())
    .select('id, business_id, estimate_id, message_id')
    .limit(200);
  if (error) {
    console.error('[cron/lead-expiry]', error.message);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }

  for (const row of expired ?? []) {
    await updateLeadCard(admin, row.message_id, { status: 'expired' });
    await markLeadMessageRead(admin, row.message_id);
    await notifyAdminOfLead(admin, row, 'lead_expired');
  }
  return NextResponse.json({ expired: expired?.length ?? 0 });
}
