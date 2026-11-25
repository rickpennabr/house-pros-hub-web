import { NextRequest, NextResponse } from 'next/server';
import { isMorningNow, listCrmOwners, runMorningForPro } from '@/lib/probot/morning';
import { loadProbotSettings } from '@/lib/probot/settings';

/**
 * GET /api/cron/probot-morning
 * Hourly at :30. Every pro whose brief hour it is in their own time zone (settings, default
 * 6:30 AM Las Vegas) gets the morning brief and follow-up cards in their ProBot chat, plus a push.
 * Authorize with CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const owners = await listCrmOwners();
  const settings = await loadProbotSettings(owners);
  const due = owners.filter((ownerId) => {
    const mine = settings.get(ownerId)!;
    return mine.briefEnabled && isMorningNow(mine.timeZone, mine.briefHour);
  });

  const results = [];
  for (const ownerId of due) {
    try {
      results.push(await runMorningForPro(ownerId, { settings: settings.get(ownerId) }));
    } catch (error) {
      results.push({ ownerId, sent: false, cards: 0, reason: error instanceof Error ? error.message : 'failed' });
    }
  }
  return NextResponse.json({
    pros: owners.length,
    due: due.length,
    sent: results.filter((result) => result.sent).length,
    cards: results.reduce((sum, result) => sum + result.cards, 0),
    errors: results.filter((result) => result.reason && !['not morning', 'already sent', 'quiet day', 'off'].includes(result.reason)),
  });
}
