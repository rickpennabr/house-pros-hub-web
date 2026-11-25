import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { actorLabel, loadScopedProject, UUID_RE } from '@/lib/crm/project-access';
import { parseDeliveryWrite } from '@/lib/crm/project-materials';

type Params = { params: Promise<{ id: string; materialId: string }> };

/**
 * POST /api/crm/projects/[id]/materials/[materialId]/deliveries — log what was sent
 * { quantity, deliveredOn, source, note }. Owner and crew; the crew member's name is kept.
 * DELETE ?deliveryId= — undo a delivery.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    const { id, materialId } = await params;
    const project = await loadScopedProject(scope, id);
    if (project instanceof NextResponse) return project;
    if (!UUID_RE.test(materialId)) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

    const { data: material } = await scope.supabase
      .from('pro_crm_project_materials')
      .select('id')
      .eq('id', materialId)
      .eq('project_id', project.id)
      .eq('owner_id', scope.ownerId)
      .maybeSingle();
    if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

    const parsed = parseDeliveryWrite(await request.json().catch(() => null), new Date().toISOString().slice(0, 10));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { data, error: insertError } = await scope.supabase
      .from('pro_crm_project_material_deliveries')
      .insert({
        owner_id: scope.ownerId,
        project_id: project.id,
        material_id: materialId,
        delivered_on: parsed.value.deliveredOn,
        quantity: parsed.value.quantity,
        source: parsed.value.source,
        note: parsed.value.note,
        created_by: scope.actorId,
        created_by_name: await actorLabel(scope),
      })
      .select('id')
      .single();
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 });
  } catch (err) {
    console.error('POST material delivery', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    const { id, materialId } = await params;
    const project = await loadScopedProject(scope, id);
    if (project instanceof NextResponse) return project;
    const deliveryId = request.nextUrl.searchParams.get('deliveryId') ?? '';
    if (!UUID_RE.test(deliveryId) || !UUID_RE.test(materialId)) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });

    let query = scope.supabase
      .from('pro_crm_project_material_deliveries')
      .delete()
      .eq('id', deliveryId)
      .eq('material_id', materialId)
      .eq('project_id', project.id)
      .eq('owner_id', scope.ownerId);
    // Crew can only undo what they logged themselves.
    if (scope.isCrew) query = query.eq('created_by', scope.actorId);
    const { error: deleteError } = await query;
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE material delivery', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
