import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { placeEventBy } from '@/lib/timeline/steps';

type AnyDb = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * GET /api/activity/unread
 * { places: { [placeId]: n }, placesTotal, crmTotal }
 * places: what pros did on each of the user's places since they last opened its timeline.
 * crmTotal (pros): what customers did since the pro last opened the feed banner.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = supabase as unknown as AnyDb;

  const { data: seenRows } = await db.from('activity_seen').select('scope, seen_at').eq('user_id', user.id);
  const seen = new Map<string, string>(((seenRows ?? []) as Array<{ scope: string; seen_at: string }>).map((row) => [row.scope, row.seen_at]));

  // Homeowner: events from pros on each place.
  const places: Record<string, number> = {};
  const { data: placeRows } = await supabase.from('customer_places').select('id').eq('user_id', user.id);
  const placeIds = (placeRows ?? []).map((row) => row.id);
  if (placeIds.length) {
    const { data: events } = await createServiceRoleClient()
      .from('customer_place_events')
      .select('place_id, kind, occurred_at')
      .in('place_id', placeIds)
      .order('occurred_at', { ascending: false })
      .limit(1000);
    for (const event of events ?? []) {
      if (placeEventBy(event.kind) !== 'pro') continue;
      const since = seen.get(`place:${event.place_id}:timeline`);
      if (since && Date.parse(event.occurred_at) <= Date.parse(since)) continue;
      places[event.place_id] = (places[event.place_id] ?? 0) + 1;
    }
  }
  const placesTotal = Object.values(places).reduce((sum, n) => sum + n, 0);

  // Pro: customer actions since the feed banner was last opened (first time: the last 7 days).
  let crmTotal = 0;
  const crmSince = seen.get('feed:crm') ?? new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { count: views } = await db
    .from('pro_crm_activity')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .in('kind', ['estimate_viewed', 'invoice_viewed'])
    .gt('occurred_at', crmSince)
    .then((res: { count: number | null }) => res, () => ({ count: 0 }));
  const { count: approvals } = await supabase
    .from('pro_crm_estimates')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .not('signer_name', 'is', null)
    .gt('signed_at', crmSince);
  const { count: payments } = await supabase
    .from('pro_crm_invoice_payments')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .is('voided_at', null)
    .or('method.ilike.%card%,method.ilike.%stripe%,method.ilike.%online%')
    .gt('created_at', crmSince);
  const { data: businesses } = await supabase.from('businesses').select('id').eq('owner_id', user.id);
  const businessIds = (businesses ?? []).map((row) => row.id);
  const { count: bookings } = businessIds.length
    ? await createServiceRoleClient()
        .from('pro_estimate_bookings')
        .select('id', { count: 'exact', head: true })
        .in('business_id', businessIds)
        .gt('created_at', crmSince)
    : { count: 0 };
  crmTotal = (views ?? 0) + (approvals ?? 0) + (payments ?? 0) + (bookings ?? 0);

  return NextResponse.json({ places, placesTotal, crmTotal });
}
