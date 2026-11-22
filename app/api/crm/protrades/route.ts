import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireContractor } from '@/lib/crm/require-contractor';
import { currentPlanForUser } from '@/lib/billing/plans';
import { activeTrades, setTradeActive, tradesOwnerFor, ProTradesError } from '@/lib/protrades/server';
import { TRADE_SLUGS } from '@/lib/protrades/trades';

async function summary(userId: string) {
  // Crew members see (but cannot change) the company owner's trades.
  const { ownerId, isOwner } = await tradesOwnerFor(userId);
  const [active, { plan }] = await Promise.all([activeTrades(ownerId), currentPlanForUser(ownerId)]);
  return {
    canManage: isOwner,
    trades: TRADE_SLUGS.map((slug) => ({ slug, active: active.includes(slug) })),
    active,
    // All trades are free for now: no limit.
    limit: null,
    planName: plan.name,
  };
}

/** GET /api/crm/protrades: every trade, which are on, and the plan's limit. */
export async function GET() {
  const { error, user } = await requireContractor();
  if (error || !user) return error;
  try {
    return NextResponse.json(await summary(user.id));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not load ProTrades' }, { status: 500 });
  }
}

const bodySchema = z.object({ trade: z.enum(TRADE_SLUGS), active: z.boolean() });

/** POST /api/crm/protrades { trade, active }: turn a trade on or off. */
export async function POST(request: NextRequest) {
  const { error, user } = await requireContractor();
  if (error || !user) return error;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  try {
    if (!(await tradesOwnerFor(user.id)).isOwner) {
      return NextResponse.json({ error: 'Only the company owner can change ProTrades.' }, { status: 403 });
    }
    await setTradeActive(user.id, parsed.data.trade, parsed.data.active);
    return NextResponse.json(await summary(user.id));
  } catch (err) {
    if (err instanceof ProTradesError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not update ProTrades' }, { status: 500 });
  }
}
