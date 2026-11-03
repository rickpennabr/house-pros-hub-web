import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    return { error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }) };
  }
  return { user };
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function tradeLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'name' in item && typeof item.name === 'string') return item.name;
      return '';
    })
    .filter(Boolean);
}

/**
 * GET /api/admin/estimates/[id]
 * Full site estimate request for the admin detail view.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('estimates')
    .select(
      'id, first_name, last_name, email, phone, street_address, apartment, city, state, zip_code, project_type, project_type_other, project_description, additional_notes, budget_range, timeline, preferred_contact_method, requires_hoa_approval, wants_3d, trades, source, project_images, created_at'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('GET /api/admin/estimates/[id]', error);
    return NextResponse.json({ error: 'Failed to load estimate' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });

  const address = [data.street_address, data.apartment, data.city, data.state, data.zip_code]
    .filter(Boolean)
    .join(', ');

  return NextResponse.json({
    estimate: {
      id: data.id,
      name: `${data.first_name} ${data.last_name}`.trim(),
      email: data.email,
      phone: data.phone,
      address,
      project_type: data.project_type,
      project_type_other: data.project_type_other,
      description: data.project_description,
      additional_notes: data.additional_notes,
      budget_range: data.budget_range,
      timeline: data.timeline,
      preferred_contact_method: data.preferred_contact_method,
      requires_hoa_approval: data.requires_hoa_approval,
      wants_3d: data.wants_3d,
      trades: tradeLabels(data.trades),
      source: data.source,
      images: asStringList(data.project_images),
      created_at: data.created_at,
    },
  });
}

/**
 * DELETE /api/admin/estimates/[id]
 * Remove a site estimate request.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const service = createServiceRoleClient();
  const { error } = await service.from('estimates').delete().eq('id', id);
  if (error) {
    console.error('DELETE /api/admin/estimates/[id]', error);
    return NextResponse.json({ error: 'Failed to delete estimate' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
