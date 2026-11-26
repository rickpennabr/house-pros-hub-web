import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { loadScopedProject, materialsSchemaMissing, MATERIALS_SETUP_ERROR } from '@/lib/crm/project-access';
import { parseMaterialWrite, summarizeMaterial } from '@/lib/crm/project-materials';

type Params = { params: Promise<{ id: string }> };

interface MaterialRow {
  id: string;
  name: string;
  unit: string;
  planned_qty: number | string;
  /** From the estimate (ProQuote materials list); null when added on the project. Migration 178. */
  estimated_qty?: number | string | null;
  note: string | null;
  sort_order: number;
  created_at: string;
}

interface DeliveryRow {
  id: string;
  material_id: string;
  delivered_on: string;
  quantity: number | string;
  source: string | null;
  note: string | null;
  created_by_name: string | null;
  created_at: string;
}

/**
 * GET /api/crm/projects/[id]/materials — every material with its deliveries and what is still to send.
 * POST — add a material { name, unit, plannedQty, note }. Owner and crew.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    const project = await loadScopedProject(scope, (await params).id);
    if (project instanceof NextResponse) return project;

    const materialQuery = (columns: string) =>
      scope.supabase
        .from('pro_crm_project_materials')
        .select(columns)
        .eq('owner_id', scope.ownerId)
        .eq('project_id', project.id)
        .order('sort_order')
        .order('created_at');
    const base = 'id, name, unit, planned_qty, note, sort_order, created_at';
    const [firstTry, deliveries] = await Promise.all([
      materialQuery(`${base}, estimated_qty`),
      scope.supabase
        .from('pro_crm_project_material_deliveries')
        .select('id, material_id, delivered_on, quantity, source, note, created_by_name, created_at')
        .eq('owner_id', scope.ownerId)
        .eq('project_id', project.id)
        .order('delivered_on')
        .order('created_at'),
    ]);
    // Before migration 178 there is no estimated_qty: read without it.
    const materials = firstTry.error && /estimated_qty/.test(firstTry.error.message ?? '') ? await materialQuery(base) : firstTry;
    const failure = materials.error ?? deliveries.error;
    if (failure) {
      if (materialsSchemaMissing(failure.message)) return NextResponse.json({ materials: [], setupError: MATERIALS_SETUP_ERROR });
      return NextResponse.json({ error: failure.message }, { status: 500 });
    }

    const byMaterial = new Map<string, DeliveryRow[]>();
    for (const row of (deliveries.data ?? []) as DeliveryRow[]) {
      const list = byMaterial.get(row.material_id) ?? [];
      list.push(row);
      byMaterial.set(row.material_id, list);
    }
    return NextResponse.json({
      materials: ((materials.data ?? []) as unknown as MaterialRow[]).map((row) => {
        const sent = byMaterial.get(row.id) ?? [];
        const estimated = row.estimated_qty == null ? null : Number(row.estimated_qty);
        return {
          id: row.id,
          name: row.name,
          unit: row.unit,
          note: row.note,
          ...summarizeMaterial(Number(row.planned_qty), sent),
          estimatedQty: estimated,
          deliveries: sent.map((delivery) => ({
            id: delivery.id,
            deliveredOn: delivery.delivered_on,
            quantity: Number(delivery.quantity),
            source: delivery.source,
            note: delivery.note,
            by: delivery.created_by_name,
          })),
        };
      }),
    });
  } catch (err) {
    console.error('GET project materials', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    const project = await loadScopedProject(scope, (await params).id);
    if (project instanceof NextResponse) return project;

    const parsed = parseMaterialWrite(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const value = parsed.value;

    const { data: last } = await scope.supabase
      .from('pro_crm_project_materials')
      .select('sort_order')
      .eq('project_id', project.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error: insertError } = await scope.supabase
      .from('pro_crm_project_materials')
      .insert({
        owner_id: scope.ownerId,
        project_id: project.id,
        name: value.name,
        unit: value.unit,
        planned_qty: value.plannedQty,
        note: value.note,
        sort_order: ((last as { sort_order?: number } | null)?.sort_order ?? 0) + 1,
        created_by: scope.actorId,
      })
      .select('id')
      .single();
    if (insertError) {
      if (materialsSchemaMissing(insertError.message)) return NextResponse.json({ error: MATERIALS_SETUP_ERROR }, { status: 400 });
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 });
  } catch (err) {
    console.error('POST project materials', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
