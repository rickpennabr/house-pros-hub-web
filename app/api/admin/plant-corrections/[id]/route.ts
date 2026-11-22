import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/blog/admin';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : undefined);

/** PATCH /api/admin/plant-corrections/[id]: edit the names or notes, or turn it off/on. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.active === 'boolean') patch.active = body.active;
  const common = text(body.correctCommonName, 120);
  if (common !== undefined) {
    if (!common) return NextResponse.json({ error: 'Enter the correct plant name.' }, { status: 400 });
    patch.correct_common_name = common;
  }
  const scientific = text(body.correctScientificName, 120);
  if (scientific !== undefined) patch.correct_scientific_name = scientific || null;
  const notes = text(body.notes, 600);
  if (notes !== undefined) patch.notes = notes || null;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  const { error: updateError } = await createServiceRoleClient().from('ai_plant_corrections').update(patch).eq('id', id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/plant-corrections/[id]: forget it (later identifications stop using it). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  const { error: deleteError } = await createServiceRoleClient().from('ai_plant_corrections').delete().eq('id', id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
