import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { customerBelongsToOwner, listPlants } from '@/lib/crm/maintenance-plants-db';

const createSchema = z.object({
  customerId: z.string().uuid(),
  name: z.string().trim().min(1, 'Plant name is required').max(120),
  quantity: z.number().int().min(1).max(9999).optional().default(1),
  area: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

/**
 * GET /api/crm/maintenance/plants?customerId=
 * Plant inventory for one maintenance property, with photo links.
 */
export async function GET(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const customerId = request.nextUrl.searchParams.get('customerId') ?? '';
    if (!z.string().uuid().safeParse(customerId).success) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }
    if (!(await customerBelongsToOwner(scope.supabase, scope.ownerId, customerId))) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    const plants = await listPlants(scope.supabase, scope.ownerId, customerId);
    return NextResponse.json({ plants, businessId: scope.businessId });
  } catch (error) {
    console.error('GET /api/crm/maintenance/plants', error);
    return NextResponse.json({ error: 'Failed to load plants' }, { status: 500 });
  }
}

/**
 * POST /api/crm/maintenance/plants
 * Add a plant to the property. Owner and crew can both add.
 */
export async function POST(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid plant' }, { status: 400 });
    }
    const { customerId, name, quantity, area, notes } = parsed.data;
    if (!(await customerBelongsToOwner(scope.supabase, scope.ownerId, customerId))) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const { data: last } = await scope.supabase
      .from('pro_crm_maintenance_plants')
      .select('sort_order')
      .eq('owner_id', scope.ownerId)
      .eq('customer_id', customerId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: row, error: insertError } = await scope.supabase
      .from('pro_crm_maintenance_plants')
      .insert({
        owner_id: scope.ownerId,
        customer_id: customerId,
        name,
        quantity,
        area: area || null,
        notes: notes || null,
        sort_order: (last?.sort_order ?? -1) + 1,
        created_by: scope.actorId,
      })
      .select('id')
      .single();
    if (insertError || !row) {
      return NextResponse.json({ error: insertError?.message ?? 'Could not add plant' }, { status: 500 });
    }

    const plant = (await listPlants(scope.supabase, scope.ownerId, customerId)).find((item) => item.id === row.id);
    return NextResponse.json({ plant }, { status: 201 });
  } catch (error) {
    console.error('POST /api/crm/maintenance/plants', error);
    return NextResponse.json({ error: 'Failed to add plant' }, { status: 500 });
  }
}
