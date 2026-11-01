import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/billing/stripe';
import { getAccountDriveUsageForUser } from '@/lib/drive/server';
import { overageGbForBilling } from '@/lib/drive/quota';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/cron/report-prodrive-usage
 * Report billable ProDrive gigabytes to Stripe. Authorize with CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = createServiceRoleClient();
  const stripe = getStripe();
  const { data: rows, error } = await service
    .from('pro_drive_billing')
    .select('user_id, overage_stripe_item_id')
    .eq('overage_enabled', true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let reported = 0;
  for (const row of rows ?? []) {
    if (!row.overage_stripe_item_id) continue;
    try {
      const usage = await getAccountDriveUsageForUser(row.user_id);
      const quantity = overageGbForBilling(usage.overageBytes);
      if (quantity <= 0) continue;
      await (
        stripe.subscriptionItems as unknown as {
          createUsageRecord: (
            id: string,
            params: { quantity: number; timestamp: number; action: 'set' | 'increment' }
          ) => Promise<unknown>;
        }
      ).createUsageRecord(row.overage_stripe_item_id, {
        quantity,
        timestamp: Math.floor(Date.now() / 1000),
        action: 'set',
      });
      await service
        .from('pro_drive_billing')
        .update({ last_usage_reported_gb: quantity, last_usage_reported_at: new Date().toISOString() })
        .eq('user_id', row.user_id);
      reported += 1;
    } catch (reportError) {
      logger.warn('ProDrive usage report failed', {
        userId: row.user_id,
        error: reportError instanceof Error ? reportError.message : 'unknown',
      });
    }
  }

  return NextResponse.json({ reported });
}
