import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { lineKey } from '@/lib/crm/line-descriptions';

const SETUP_ERROR = 'Saved descriptions need a database update (migration 168) first.';

function missingTable(message: string | undefined): boolean {
  return Boolean(message && /pro_crm_line_descriptions/.test(message) && /does not exist|schema cache|Could not find/i.test(message));
}

/**
 * GET /api/crm/line-descriptions?item=<product or service name>
 * Descriptions saved for that item, most recently used first.
 */
export async function GET(request: NextRequest) {
  const { error, scope } = await requireCrmScope();
  if (error) return error;
  const item = new URL(request.url).searchParams.get('item')?.trim() ?? '';
  if (!item) return NextResponse.json({ descriptions: [] });
  const { data, error: dbError } = await scope.supabase
    .from('pro_crm_line_descriptions')
    .select('id, description, last_used_at')
    .eq('owner_id', scope.ownerId)
    .eq('item_key', lineKey(item))
    .order('last_used_at', { ascending: false })
    .limit(100);
  if (dbError) {
    if (missingTable(dbError.message)) return NextResponse.json({ descriptions: [], setupError: SETUP_ERROR });
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json({ descriptions: data ?? [] });
}

/** POST /api/crm/line-descriptions { item, description }: save one for later. */
export async function POST(request: NextRequest) {
  const { error, scope } = await requireCrmScope();
  if (error) return error;
  const body = (await request.json().catch(() => ({}))) as { item?: unknown; description?: unknown };
  const item = typeof body.item === 'string' ? body.item.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!item || !description) return NextResponse.json({ error: 'Type a description' }, { status: 400 });
  if (item.length > 200 || description.length > 2000) return NextResponse.json({ error: 'Too long' }, { status: 400 });
  const { data, error: dbError } = await scope.supabase
    .from('pro_crm_line_descriptions')
    .upsert(
      {
        owner_id: scope.ownerId,
        item_name: item,
        item_key: lineKey(item),
        description,
        description_key: lineKey(description),
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id,item_key,description_key' }
    )
    .select('id, description, last_used_at')
    .single();
  if (dbError) {
    if (missingTable(dbError.message)) return NextResponse.json({ error: SETUP_ERROR }, { status: 503 });
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json({ description: data }, { status: 201 });
}

/** DELETE /api/crm/line-descriptions?id=<id>: stop suggesting one. */
export async function DELETE(request: NextRequest) {
  const { error, scope } = await requireCrmScope();
  if (error) return error;
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error: dbError } = await scope.supabase
    .from('pro_crm_line_descriptions')
    .delete()
    .eq('id', id)
    .eq('owner_id', scope.ownerId);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
