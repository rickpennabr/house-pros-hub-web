import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SCOPE = /^[a-z]+:[A-Za-z0-9:_-]{0,190}$/;

type SeenDb = {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

/** GET /api/activity/seen?prefix=crm:<customerId>:<propertyId>:  → { seen: { [scope]: iso } } */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const prefix = request.nextUrl.searchParams.get('prefix') ?? '';
  if (!SCOPE.test(prefix)) return NextResponse.json({ error: 'Bad prefix' }, { status: 400 });
  const { data, error } = await (supabase as unknown as SeenDb)
    .from('activity_seen')
    .select('scope, seen_at')
    .eq('user_id', auth.user.id)
    .like('scope', `${prefix.replace(/[%_]/g, '\$&')}%`);
  // Before migration 166 there is nothing seen: every badge just shows its total.
  if (error) return NextResponse.json({ seen: {} });
  const seen = Object.fromEntries((data as Array<{ scope: string; seen_at: string }>).map((row) => [row.scope, row.seen_at]));
  return NextResponse.json({ seen });
}

/** POST /api/activity/seen  { scopes: string[] }  → marks them seen now. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { scopes?: unknown };
  const scopes = (Array.isArray(body.scopes) ? body.scopes : []).filter(
    (scope): scope is string => typeof scope === 'string' && SCOPE.test(scope)
  ).slice(0, 20);
  if (scopes.length === 0) return NextResponse.json({ ok: true });
  const now = new Date().toISOString();
  const { error } = await (supabase as unknown as SeenDb)
    .from('activity_seen')
    .upsert(scopes.map((scope) => ({ user_id: auth.user!.id, scope, seen_at: now })), { onConflict: 'user_id,scope' });
  if (error) console.error('[activity/seen]', error.message);
  return NextResponse.json({ ok: true, seenAt: now });
}
