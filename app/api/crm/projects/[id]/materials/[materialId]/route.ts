import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { loadScopedProject, UUID_RE } from '@/lib/crm/project-access';
import { parseMaterialWrite } from '@/lib/crm/project-materials';

type Params = { params: Promise<{ id: string; materialId: string }> };

/**
 * PATCH /api/crm/projects/[id]/materials/[materialId] — change name, unit, planned quantity or note.
 * DELETE — remove the material and its deliveries (owner only).
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    const { id, materialId } = await params;
    const project = await loadScopedProject(scope, id);
    if (project instanceof NextResponse) return project;
    if (!UUID_RE.test(materialId)) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

    const parsed = parseMaterialWrite(await request.json().catch(() => null), true);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const value = parsed.value;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (value.name !== undefined) patch.name = value.name;
    if (value.unit !== undefined) patch.unit = value.unit;
    if (value.plannedQty !== undefined) patch.planned_qty = value.plannedQty;
    if (value.note !== undefined) patch.note = value.note;

    const { data, error: updateError } = await scope.supabase
      .from('pro_crm_project_materials')
      .update(patch)
      .eq('id', materialId)
      .eq('project_id', project.id)
      .eq('owner_id', scope.ownerId)
      .select('id')
      .maybeSingle();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH project material', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    if (scope.isCrew) return NextResponse.json({ error: 'Only the business owner can delete materials.' }, { status: 403 });
    const { id, materialId } = await params;
    const project = await loadScopedProject(scope, id);
    if (project instanceof NextResponse) return project;
    if (!UUID_RE.test(materialId)) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

    const { error: deleteError } = await scope.supabase
      .from('pro_crm_project_materials')
      .delete()
      .eq('id', materialId)
      .eq('project_id', project.id)
      .eq('owner_id', scope.ownerId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE project material', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
