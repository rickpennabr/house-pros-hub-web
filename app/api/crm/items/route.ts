import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

async function requireContractor() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) {
    return {
      error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }),
      user: null,
    };
  }
  return { error: null, user };
}

/**
 * GET /api/crm/items
 * List reusable products/services for the authenticated contractor. Used for invoice/estimate line item dropdown.
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from('pro_crm_items')
      .select('id, name, item_type, sku, category, image_url, description, price_cents, unit, display_order')
      .eq('owner_id', user.id)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to fetch items' }, { status: 500 });
    }

    return NextResponse.json({ items: rows ?? [] });
  } catch (err) {
    console.error('GET /api/crm/items', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/crm/items
 * Create a reusable product or service. Contractor only.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const body = await request.json().catch(() => ({}));
    const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const name = trim(body.name);
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const itemType = body.item_type ?? body.itemType ?? 'service';
    const validType = itemType === 'product' ? 'product' : 'service';
    const priceCents = typeof body.price_cents === 'number'
      ? Math.max(0, Math.round(body.price_cents))
      : typeof body.priceCents === 'number'
        ? Math.max(0, Math.round(body.priceCents))
        : 0;
    const unit = trim(body.unit) || 'each';

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('pro_crm_items')
      .insert({
        owner_id: user.id,
        name: String(name),
        item_type: validType,
        sku: trim(body.sku) || null,
        category: trim(body.category) || null,
        image_url: trim(body.image_url) || null,
        description: trim(body.description) || null,
        price_cents: priceCents,
        unit: unit || 'each',
        display_order: typeof body.display_order === 'number' ? body.display_order : 0,
      })
      .select('id, name, item_type, sku, category, image_url, description, price_cents, unit, display_order, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to create item' }, { status: 500 });
    }
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/items', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
