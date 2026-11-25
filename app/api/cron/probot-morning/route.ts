import { NextRequest, NextResponse } from 'next/server';
import { isMorningNow, listCrmOwners, runMorningForPro } from '@/lib/probot/morning';
import { DEFAULT_PRO_TIME_ZONE } from '@/lib/agent/pro-tools';

/**
 * GET /api/cron/probot-morning
 * Hourly at :30. For every pro whose local time is 6 AM, ProBot posts the morning brief and
 * follow-up cards in their ProBot chat and sends a push. Authorize with CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Every pro uses Las Vegas time for now; per-pro time zones come with the settings page.
  const timeZone = DEFAULT_PRO_TIME_ZONE;
  if (!isMorningNow(timeZone)) return NextResponse.json({ skipped: 'not morning', timeZone });

  const owners = await listCrmOwners();
  const results = [];
  for (const ownerId of owners) {
    try {
      results.push(await runMorningForPro(ownerId, { timeZone }));
    } catch (error) {
      results.push({ ownerId, sent: false, cards: 0, reason: error instanceof Error ? error.message : 'failed' });
    }
  }
  return NextResponse.json({
    pros: owners.length,
    sent: results.filter((result) => result.sent).length,
    cards: results.reduce((sum, result) => sum + result.cards, 0),
    errors: results.filter((result) => result.reason && !['not morning', 'already sent', 'quiet day'].includes(result.reason)),
  });
}
