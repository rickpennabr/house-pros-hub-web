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
 * PATCH /api/crm/items/[id]
 * Update a reusable product/service. Contractor only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const name = trim(body.name);
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const itemType = body.item_type ?? body.itemType ?? 'service';
    const validType = itemType === 'product' ? 'product' : 'service';
    const priceCents =
      typeof body.price_cents === 'number'
        ? Math.max(0, Math.round(body.price_cents))
        : typeof body.priceCents === 'number'
          ? Math.max(0, Math.round(body.priceCents))
          : 0;
    const unit = trim(body.unit) || 'each';

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('pro_crm_items')
      .update({
        name: String(name),
        item_type: validType,
        sku: trim(body.sku) || null,
        category: trim(body.category) || null,
        image_url: trim(body.image_url) || null,
        description: trim(body.description) || null,
        price_cents: priceCents,
        unit,
        display_order: typeof body.display_order === 'number' ? body.display_order : 0,
      })
      .eq('id', id)
      .eq('owner_id', user.id)
      .select('id, name, item_type, sku, category, image_url, description, price_cents, unit, display_order, created_at')
      .single();

    if (error || !row) {
      return NextResponse.json({ error: error?.message || 'Failed to update item' }, { status: 500 });
    }

    return NextResponse.json(row);
  } catch (err) {
    console.error('PATCH /api/crm/items/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/crm/items/[id]
 * Delete a reusable product/service. Contractor only.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase
      .from('pro_crm_items')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to delete item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/crm/items/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

