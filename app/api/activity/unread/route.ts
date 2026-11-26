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
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = supabase as unknown as AnyDb;

  const { data: seenRows } = await db.from('activity_seen').select('scope, seen_at').eq('user_id', user.id);
  const seen = new Map<string, string>(((seenRows ?? []) as Array<{ scope: string; seen_at: string }>).map((row) => [row.scope, row.seen_at]));

  // Homeowner: events from pros on each place.
  const places: Record<string, number> = {};
  type Recent = { id: string; title: string; detail: string | null; at: string; href: string; who: 'pro' | 'customer' };
  const recent: Recent[] = [];
  const { data: placeRows } = await supabase.from('customer_places').select('id').eq('user_id', user.id);
  const placeIds = (placeRows ?? []).map((row) => row.id);
  if (placeIds.length) {
    const { data: events } = await createServiceRoleClient()
      .from('customer_place_events')
      .select('id, place_id, kind, title, detail, pro_name, occurred_at')
      .in('place_id', placeIds)
      .order('occurred_at', { ascending: false })
      .limit(1000);
    for (const event of events ?? []) {
      if (placeEventBy(event.kind) !== 'pro') continue;
      const since = seen.get(`place:${event.place_id}:timeline`);
      if (since && Date.parse(event.occurred_at) <= Date.parse(since)) continue;
      places[event.place_id] = (places[event.place_id] ?? 0) + 1;
      if (recent.length < 6) {
        recent.push({
          id: `p-${event.id}`,
          title: event.title,
          detail: [event.pro_name, event.detail].filter(Boolean).join(' · ') || null,
          at: event.occurred_at,
          href: `/myplaces/${event.place_id}`,
          who: 'pro',
        });
      }
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

  // The latest important customer actions, for the feed card. With ?recent=1 (Customer portal),
  // nothing new still lists the last 30 days, so the portal always shows what customers did.
  const wantRecent = new URL(request.url).searchParams.get('recent') === '1';
  const listSince = crmTotal > 0 ? crmSince : wantRecent ? new Date(Date.now() - 30 * 86_400_000).toISOString() : null;
  if (listSince) {
    const { data: approved } = await supabase
      .from('pro_crm_estimates')
      .select('id, display_id, signer_name, signed_at, amount_cents')
      .eq('owner_id', user.id)
      .not('signer_name', 'is', null)
      .gt('signed_at', listSince)
      .order('signed_at', { ascending: false })
      .limit(5);
    for (const row of approved ?? []) {
      recent.push({ id: `e-${row.id}`, title: 'Estimate approved', detail: `#${row.display_id} · signed by ${row.signer_name}`, at: row.signed_at!, href: `/crm/estimates?id=${row.id}`, who: 'customer' });
    }
    const { data: paid } = await supabase
      .from('pro_crm_invoice_payments')
      .select('id, invoice_id, amount_cents, created_at')
      .eq('owner_id', user.id)
      .is('voided_at', null)
      .or('method.ilike.%card%,method.ilike.%stripe%,method.ilike.%online%')
      .gt('created_at', listSince)
      .order('created_at', { ascending: false })
      .limit(5);
    for (const row of paid ?? []) {
      recent.push({ id: `pay-${row.id}`, title: 'Paid online', detail: (row.amount_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }), at: row.created_at, href: `/crm/invoices/${row.invoice_id}`, who: 'customer' });
    }
    const { data: booked } = businessIds.length
      ? await createServiceRoleClient()
          .from('pro_estimate_bookings')
          .select('id, service_name, guest_first_name, created_at')
          .in('business_id', businessIds)
          .gt('created_at', listSince)
          .order('created_at', { ascending: false })
          .limit(5)
      : { data: [] };
    for (const row of booked ?? []) {
      recent.push({ id: `b-${row.id}`, title: 'Appointment booked', detail: [row.guest_first_name, row.service_name].filter(Boolean).join(' · ') || null, at: row.created_at, href: '/crm/calendar', who: 'customer' });
    }
  }
  recent.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return NextResponse.json({ places, placesTotal, crmTotal, recent: recent.slice(0, 8) });
}
